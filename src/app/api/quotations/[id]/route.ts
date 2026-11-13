import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/quotations/[id] — cambiar estado: enviada | aprobada | rechazada
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const body = await req.json();

    if (!["borrador", "enviada", "aprobada", "rechazada"].includes(body.status)) {
      return NextResponse.json({ error: "Estado no válido." }, { status: 400 });
    }

    const existing = await db.quotation.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }

    const quotation = await db.quotation.update({
      where: { id: existing.id },
      data: { status: body.status },
      include: { items: true },
    });
    return NextResponse.json({ quotation });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la cotización." }, { status: 400 });
  }
}

// DELETE /api/quotations/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const q = await db.quotation.findFirst({ where: { id, organizationId: orgId } });
    if (!q) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    if (q.status === "convertida") {
      return NextResponse.json(
        { error: "No se puede eliminar una cotización ya convertida en venta." },
        { status: 409 }
      );
    }
    await db.quotation.delete({ where: { id: q.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la cotización." }, { status: 400 });
  }
}

// PUT /api/quotations/[id] — convertir cotización en venta (descuenta stock)
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;

    const quotation = await db.quotation.findFirst({ where: { id, organizationId: orgId }, include: { items: true } });
    if (!quotation) {
      return NextResponse.json({ error: "Cotización no encontrada." }, { status: 404 });
    }
    if (quotation.status === "convertida") {
      return NextResponse.json({ error: "Esta cotización ya fue convertida en venta." }, { status: 409 });
    }
    if (quotation.status === "rechazada") {
      return NextResponse.json({ error: "No se puede convertir una cotización rechazada." }, { status: 409 });
    }

    // Validar stock disponible
    const productIds = quotation.items.map((i) => i.productId).filter((x): x is string => Boolean(x));
    const products = await db.product.findMany({ where: { id: { in: productIds }, organizationId: orgId } });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const it of quotation.items) {
      if (!it.productId) continue;
      const p = byId.get(it.productId);
      if (!p || p.stock < it.quantity) {
        return NextResponse.json(
          { error: `Stock insuficiente de "${it.name}" para convertir la cotización.` },
          { status: 409 }
        );
      }
    }

    const saleCount = await db.sale.count({ where: { organizationId: orgId } });
    const folio = `F-${new Date().getFullYear()}-${String(saleCount + 1).padStart(5, "0")}`;

    const result = await db.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          organizationId: orgId,
          folio,
          customerId: quotation.customerId,
          customerName: quotation.customerName,
          subtotal: quotation.subtotal,
          discount: quotation.discount,
          tax: quotation.tax,
          total: quotation.total,
          paymentMethod: "transferencia",
          status: "completada",
          note: `Convertida desde cotización ${quotation.folio}`,
          items: {
            create: quotation.items.map((it) => ({
              organizationId: orgId,
              productId: it.productId,
              name: it.name,
              sku: it.sku,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.subtotal,
            })),
          },
        },
        include: { items: true },
      });

      for (const it of quotation.items) {
        if (!it.productId) continue;
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
            note: `Venta ${folio} (cotización ${quotation.folio})`,
          },
        });
      }

      await tx.quotation.update({ where: { id }, data: { status: "convertida" } });
      return sale;
    });

    return NextResponse.json({ sale: result }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo convertir la cotización en venta." }, { status: 400 });
  }
}
