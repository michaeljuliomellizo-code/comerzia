import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/coupons/[id] — editar o activar/desactivar
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
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.value !== undefined) data.value = Math.max(0, Number(body.value) || 0);
    if (body.minTotal !== undefined) data.minTotal = Math.max(0, Number(body.minTotal) || 0);
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

    const existing = await db.coupon.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }

    const coupon = await db.coupon.update({ where: { id: existing.id }, data });
    return NextResponse.json({ coupon });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el cupón." }, { status: 400 });
  }
}

// DELETE /api/coupons/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const existing = await db.coupon.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    await db.coupon.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el cupón." }, { status: 400 });
  }
}
