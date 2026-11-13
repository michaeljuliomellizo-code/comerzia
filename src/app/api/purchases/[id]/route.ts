import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/purchases/[id] — acciones: receive (recibir), cancel (anular), pay (registrar pago)
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
    const action = body.action;

    const purchase = await db.purchase.findFirst({ where: { id, organizationId: orgId }, include: { items: true } });
    if (!purchase) {
      return NextResponse.json({ error: "Orden de compra no encontrada." }, { status: 404 });
    }

    // Recibir mercancía: aumenta stock, registra movimientos y actualiza costo
    if (action === "receive") {
      if (purchase.status !== "pendiente") {
        return NextResponse.json({ error: "Solo se pueden recibir órdenes pendientes." }, { status: 409 });
      }
      const received = await db.$transaction(async (tx) => {
        for (const it of purchase.items) {
          if (!it.productId) continue;
          await tx.product.update({
            where: { id: it.productId },
            data: {
              stock: { increment: it.quantity },
              costPrice: it.unitCost, // última compra define el costo de adquisición
            },
          });
          await tx.movement.create({
            data: {
              organizationId: orgId,
              productId: it.productId,
              type: "entrada",
              quantity: it.quantity,
              note: `Compra ${purchase.folio}`,
            },
          });
        }
        return tx.purchase.update({
          where: { id },
          data: { status: "recibida", receivedAt: new Date() },
          include: { items: true },
        });
      });
      return NextResponse.json({ purchase: received });
    }

    // Anular orden pendiente
    if (action === "cancel") {
      if (purchase.status === "recibida") {
        return NextResponse.json(
          { error: "No se puede anular una orden ya recibida. Registra una devolución al proveedor." },
          { status: 409 }
        );
      }
      const cancelled = await db.purchase.update({
        where: { id },
        data: { status: "cancelada" },
        include: { items: true },
      });
      return NextResponse.json({ purchase: cancelled });
    }

    // Registrar pago a proveedor (cuentas por pagar)
    if (action === "pay") {
      if (purchase.status !== "recibida") {
        return NextResponse.json({ error: "Solo se pagan compras ya recibidas." }, { status: 409 });
      }
      if (purchase.paid) {
        return NextResponse.json({ error: "Esta compra ya está pagada." }, { status: 409 });
      }
      const [, tx] = await db.$transaction([
        db.financeTransaction.create({
          data: {
            organizationId: orgId,
            type: "egreso",
            category: "pago_proveedor",
            amount: purchase.total,
            method: body.method || "transferencia",
            description: `Pago compra ${purchase.folio} — ${purchase.supplierName}`,
            refType: "purchase",
            refId: purchase.id,
          },
        }),
        db.purchase.update({ where: { id }, data: { paid: true } }),
      ]);
      return NextResponse.json({ purchase: { ...tx, paid: true } });
    }

    if (body.note !== undefined) {
      const updated = await db.purchase.update({
        where: { id },
        data: { note: body.note || null },
        include: { items: true },
      });
      return NextResponse.json({ purchase: updated });
    }

    return NextResponse.json({ error: "Acción no reconocida." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la orden de compra." }, { status: 400 });
  }
}
