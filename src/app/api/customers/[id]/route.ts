import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/customers/[id]
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
    for (const key of ["name", "email", "phone", "docId", "address", "notes"] as const) {
      if (body[key] !== undefined) data[key] = body[key] || null;
    }
    if (body.type !== undefined) data.type = body.type === "empresa" ? "empresa" : "particular";

    const existing = await db.customer.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }

    const customer = await db.customer.update({ where: { id: existing.id }, data });
    return NextResponse.json({ customer });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el cliente." }, { status: 400 });
  }
}

// DELETE /api/customers/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const existing = await db.customer.findFirst({ where: { id, organizationId: orgId } });
    if (!existing) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    await db.customer.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el cliente." }, { status: 400 });
  }
}
