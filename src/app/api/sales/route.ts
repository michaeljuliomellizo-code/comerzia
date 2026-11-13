import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";
import type { Coupon } from "@prisma/client";

// GET /api/sales — lista de ventas con líneas
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Number(searchParams.get("limit")) || 50);

  const sales = await db.sale.findMany({
    where: { organizationId: orgId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ sales });
}

// POST /api/sales — registrar una venta (descuenta stock, aplica cupón y registra movimiento de caja)
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { customerId, items, paymentMethod, discount, status, note, couponCode } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "La venta debe incluir al menos un producto." }, { status: 400 });
    }

    // Validar stock disponible antes de crear la venta
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds }, organizationId: orgId } });
    const byId = new Map(products.map((p) => [p.id, p]));

    for (const item of items as Array<{ productId: string; quantity: number; unitPrice?: number }>) {
      const p = byId.get(item.productId);
      if (!p) {
        return NextResponse.json({ error: "Producto no encontrado." }, { status: 400 });
      }
      if (p.stock < item.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente de "${p.name}" (disponible: ${p.stock}).` },
          { status: 409 }
        );
      }
    }

    const saleItems = (items as Array<{ productId: string; quantity: number; unitPrice?: number }>).map((item) => {
      const p = byId.get(item.productId)!;
      const unitPrice = Number(item.unitPrice) || p.salePrice;
      return {
        organizationId: orgId,
        productId: p.id,
        name: p.name,
        sku: p.sku,
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        unitPrice,
        subtotal: unitPrice * Math.max(1, Math.floor(Number(item.quantity) || 1)),
      };
    });

    const subtotal = saleItems.reduce((a, it) => a + it.subtotal, 0);
    const disc = Math.max(0, Number(discount) || 0);

    // Cupón de descuento (validación autoritativa en servidor)
    let coupon: Coupon | null = null;
    let couponDiscount = 0;
    const code = String(couponCode ?? "").trim().toUpperCase();
    if (code) {
      coupon = await db.coupon.findFirst({ where: { organizationId: orgId, code } });
      if (!coupon || !coupon.active) {
        return NextResponse.json({ error: "Cupón no válido o inactivo." }, { status: 409 });
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        return NextResponse.json({ error: "El cupón está vencido." }, { status: 409 });
      }
      if (subtotal < coupon.minTotal) {
        return NextResponse.json({ error: "El subtotal no alcanza el mínimo del cupón." }, { status: 409 });
      }
      couponDiscount =
        coupon.type === "porcentaje"
          ? Math.round((subtotal * coupon.value) / 100)
          : Math.min(coupon.value, subtotal);
    }

    const taxRate = (ctx.settings.taxRate ?? 19) / 100;
    const tax = Math.round((subtotal - disc - couponDiscount) * taxRate);
    const total = subtotal - disc - couponDiscount + tax;

    let customerName = "Cliente de mostrador";
    if (customerId) {
      const c = await db.customer.findFirst({ where: { id: customerId, organizationId: orgId } });
      if (c) customerName = c.name;
    }

    const count = await db.sale.count({ where: { organizationId: orgId } });
    const folio = `F-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

    // Sesión de caja abierta (para vincular la venta y el movimiento de efectivo)
    const openSession = (status || "completada") === "completada"
      ? await db.cashSession.findFirst({ where: { organizationId: orgId, status: "abierta" } })
      : null;

    const sale = await db.$transaction(async (tx) => {
      const created = await tx.sale.create({
        data: {
          organizationId: orgId,
          folio,
          customerId: customerId || null,
          customerName,
          subtotal,
          discount: disc,
          couponCode: coupon ? coupon.code : null,
          couponDiscount,
          tax,
          total,
          paymentMethod: paymentMethod || "efectivo",
          status: status || "completada",
          note: note || null,
          cashSessionId: openSession?.id ?? null,
          items: { create: saleItems },
        },
        include: { items: true },
      });

      // Descuento de stock + movimiento solo para ventas completadas
      if ((status || "completada") === "completada") {
        for (const it of saleItems) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { decrement: it.quantity } },
          });
          await tx.movement.create({
            data: {
              organizationId: orgId,
              productId: it.productId,
              type: "salida",
              quantity: it.quantity,
              note: `Venta ${folio}`,
            },
          });
        }

        // Movimiento de caja para pagos en efectivo
        if (openSession && (paymentMethod || "efectivo") === "efectivo") {
          await tx.cashMovement.create({
            data: {
              organizationId: orgId,
              sessionId: openSession.id,
              type: "ingreso",
              amount: total,
              concept: `Venta ${folio}`,
              source: "venta",
            },
          });
        }

        // Contabilizar el uso del cupón
        if (coupon) {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usageCount: { increment: 1 } },
          });
        }
      }

      return created;
    });

    return NextResponse.json({ sale }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la venta." }, { status: 400 });
  }
}
