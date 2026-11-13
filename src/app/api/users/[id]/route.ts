import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

// PATCH /api/users/[id] — editar usuario (rol, sucursal, activo)
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

    const member = await db.organizationMember.findFirst({
      where: { id, organizationId: orgId },
      include: { profile: true },
    });
    if (!member) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.branch !== undefined) data.branchId = body.branch || null;
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.role !== undefined) {
      if (body.role === "OWNER" && member.role !== "OWNER") {
        return NextResponse.json(
          { error: "El rol OWNER no puede asignarse desde el panel." },
          { status: 403 }
        );
      }
      if (member.role === "OWNER" && body.role !== "OWNER") {
        return NextResponse.json(
          { error: "No se puede degradar al propietario de la organización." },
          { status: 403 }
        );
      }
      data.role = body.role;
    }

    const updated = await db.organizationMember.update({
      where: { id: member.id },
      data,
      include: { profile: true },
    });

    // El nombre se guarda en el perfil (compartido entre organizaciones)
    if (body.name !== undefined) {
      await db.profile.update({
        where: { id: member.profile.id },
        data: { fullName: String(body.name).trim() },
      });
    }

    const user = {
      id: updated.id,
      name: body.name !== undefined ? String(body.name).trim() : updated.profile.fullName,
      email: updated.profile.email,
      role: updated.role,
      branch: updated.branchId,
      active: updated.active,
      lastAccess: updated.profile.lastLoginAt,
      canViewCosts: updated.canViewCosts,
      canAuthorize: updated.canAuthorize,
      discountLimitPct: updated.discountLimitPct,
      status: updated.profile.status,
    };
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar el usuario." }, { status: 400 });
  }
}

// DELETE /api/users/[id] — elimina la membresía (el perfil no se elimina)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const { id } = await params;
    const member = await db.organizationMember.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!member) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "El propietario no puede eliminarse. Transfiere la propiedad con controles especiales." },
        { status: 403 }
      );
    }
    await db.organizationMember.delete({ where: { id: member.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo eliminar el usuario." }, { status: 400 });
  }
}
