import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/suppliers/[id]
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
    for (const key of ["name", "taxId", "contactName", "email", "phone", "address", "notes"] as const) {
      if (body[key] !== undefined) data[key] = body[key] || null;
    }
    if (body.paymentTerms !== undefined) {
      data.paymentTerms = ["contado", "credito_15", "credito_30"].includes(body.paymentTerms)
        ? body.paymentTerms
        : "contado";
    }
    if (body.active !== undefined) data.active = Boolean(body.active);

    const existing = await db.supplier.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }

    const supplier = await db.supplier.update({ where: { id: existing.id }, data });
    return NextResponse.json({ supplier });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el proveedor." }, { status: 400 });
  }
}

// DELETE /api/suppliers/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const existing = await db.supplier.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    const purchases = await db.purchase.count({ where: { supplierId: existing.id, organizationId: orgId } });
    if (purchases > 0) {
      // Tiene compras asociadas: se desactiva en lugar de eliminar
      await db.supplier.update({ where: { id: existing.id }, data: { active: false } });
      return NextResponse.json({
        ok: true,
        deactivated: true,
        message: "El proveedor tiene compras asociadas y fue desactivado en lugar de eliminarse.",
      });
    }
    await db.supplier.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el proveedor." }, { status: 400 });
  }
}
