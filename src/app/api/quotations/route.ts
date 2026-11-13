import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/quotations — lista de cotizaciones con líneas
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Number(searchParams.get("limit")) || 100);

  const quotations = await db.quotation.findMany({
    where: { organizationId: orgId },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ quotations });
}

// POST /api/quotations — crear cotización (no reserva stock ni descuenta)
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { customerId, items, discount, validUntil, note } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "La cotización debe incluir al menos un producto." }, { status: 400 });
    }

    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.product.findMany({ where: { id: { in: productIds }, organizationId: orgId } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const quotationItems = (items as Array<{ productId: string; quantity: number; unitPrice?: number }>).map(
      (item) => {
        const p = byId.get(item.productId);
        if (!p) throw new Error("Producto no encontrado.");
        const unitPrice = Number(item.unitPrice) > 0 ? Number(item.unitPrice) : p.salePrice;
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity,
          unitPrice,
          subtotal: quantity * unitPrice,
        };
      }
    );

    const subtotal = quotationItems.reduce((a: number, it: { subtotal: number }) => a + it.subtotal, 0);
    const disc = Math.max(0, Number(discount) || 0);
    const taxRate = (ctx.settings.taxRate ?? 19) / 100;
    const tax = Math.round((subtotal - disc) * taxRate);
    const total = subtotal - disc + tax;

    let customerName = "Cliente de mostrador";
    if (customerId) {
      const c = await db.customer.findFirst({ where: { id: customerId, organizationId: orgId } });
      if (c) customerName = c.name;
    }

    const count = await db.quotation.count({ where: { organizationId: orgId } });
    const folio = `COT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    const quotation = await db.quotation.create({
      data: {
        organizationId: orgId,
        folio,
        customerId: customerId || null,
        customerName,
        subtotal,
        discount: disc,
        tax,
        total,
        validUntil: validUntil ? new Date(validUntil) : null,
        note: note || null,
        items: { create: quotationItems },
      },
      include: { items: true },
    });

    return NextResponse.json({ quotation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo crear la cotización." }, { status: 400 });
  }
}
