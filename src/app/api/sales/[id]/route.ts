import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/sales/[id] — detalle de una venta
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { id } = await params;
  const sale = await db.sale.findFirst({ where: { id, organizationId: orgId }, include: { items: true } });
  if (!sale) {
    return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ sale });
}

// PATCH /api/sales/[id] — cambiar estado (completada | pendiente | cancelada)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const { status } = await req.json();

    if (!["completada", "pendiente", "cancelada"].includes(status)) {
      return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
    }

    const sale = await db.sale.findFirst({ where: { id, organizationId: orgId }, include: { items: true } });
    if (!sale) {
      return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });
    }

    const updated = await db.$transaction(async (tx) => {
      // Al cancelar una venta completada se devuelve el stock
      if (sale.status === "completada" && status === "cancelada") {
        for (const it of sale.items) {
          if (it.productId) {
            await tx.product.update({
              where: { id: it.productId },
              data: { stock: { increment: it.quantity } },
            });
            await tx.movement.create({
              data: {
                organizationId: orgId,
                productId: it.productId,
                type: "entrada",
                quantity: it.quantity,
                note: `Reversión por cancelación ${sale.folio}`,
              },
            });
          }
        }
      }
      return tx.sale.update({ where: { id }, data: { status } });
    });

    return NextResponse.json({ sale: updated });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la venta." }, { status: 400 });
  }
}

// DELETE /api/sales/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const existing = await db.sale.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    await db.sale.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar la venta." }, { status: 400 });
  }
}
