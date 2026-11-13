import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/products/[id] — actualizar producto
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

    const data: Record<string, unknown> = {};
    for (const key of ["name", "sku", "category", "description"] as const) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    for (const key of ["costPrice", "salePrice"] as const) {
      if (body[key] !== undefined) data[key] = Number(body[key]) || 0;
    }
    for (const key of ["stock", "minStock"] as const) {
      if (body[key] !== undefined) data[key] = Math.max(0, Math.floor(Number(body[key]) || 0));
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const existing = await db.product.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }

    const product = await db.product.update({ where: { id: existing.id }, data });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el producto." }, { status: 400 });
  }
}

// DELETE /api/products/[id] — eliminar producto (y sus movimientos)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const existing = await db.product.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    await db.product.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el producto." }, { status: 400 });
  }
}
