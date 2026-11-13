import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// GET /api/movements — últimos movimientos de inventario
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(200, Number(searchParams.get("limit")) || 50);

  const movements = await db.movement.findMany({
    where: { organizationId: orgId },
    include: { product: { select: { name: true, sku: true, stock: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ movements });
}

// POST /api/movements — registrar entrada / salida / ajuste de inventario
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const { productId, type, quantity, note } = body;

    if (!productId || !["entrada", "salida", "ajuste"].includes(type)) {
      return NextResponse.json({ error: "Producto o tipo de movimiento inválido." }, { status: 400 });
    }
    const qty = Math.floor(Number(quantity) || 0);
    if (qty <= 0) {
      return NextResponse.json({ error: "La cantidad debe ser mayor que cero." }, { status: 400 });
    }

    const product = await db.product.findFirst({ where: { id: productId, organizationId: orgId } });
    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }

    let delta = qty;
    if (type === "entrada") delta = qty;
    if (type === "salida") {
      delta = -qty;
      if (product.stock < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente (disponible: ${product.stock}).` },
          { status: 409 }
        );
      }
    }
    if (type === "ajuste") delta = qty - product.stock; // fija el stock al valor indicado

    const movement = await db.$transaction(async (tx) => {
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: delta } },
      });
      return tx.movement.create({
        data: {
          organizationId: orgId,
          productId,
          type,
          quantity: type === "ajuste" ? Math.abs(delta) : qty,
          note: note || null,
        },
      });
    });

    return NextResponse.json({ movement }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar el movimiento." }, { status: 400 });
  }
}
