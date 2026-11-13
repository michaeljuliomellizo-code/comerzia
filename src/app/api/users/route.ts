import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOrgApi } from "@/lib/tenant";

const ROLES = [
  "OWNER",
  "ADMIN",
  "CAJERO",
  "VENDEDOR",
  "INVENTARIO",
  "COMPRAS",
  "CONTADOR",
  "LOGISTICA",
  "AUDITOR",
];

// GET /api/users — usuarios del panel (RBAC)
export async function GET() {
  const { ctx, error } = await requireOrgApi();
  if (error) return error;
  const orgId = ctx.organization.id;

  const members = await db.organizationMember.findMany({
    where: { organizationId: orgId },
    include: { profile: { select: { id: true, email: true, fullName: true, status: true, lastLoginAt: true } } },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });

  const users = members.map((m) => ({
    id: m.id,
    name: m.profile.fullName,
    email: m.profile.email,
    role: m.role,
    branch: m.branchId,
    active: m.active,
    lastAccess: m.profile.lastLoginAt,
    canViewCosts: m.canViewCosts,
    canAuthorize: m.canAuthorize,
    discountLimitPct: m.discountLimitPct,
    status: m.profile.status,
  }));

  return NextResponse.json({ users });
}

// POST /api/users — crear usuario
export async function POST(req: NextRequest) {
  try {
    const { ctx, error } = await requireOrgApi();
    if (error) return error;
    const orgId = ctx.organization.id;

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!body.name?.trim() || !email) {
      return NextResponse.json({ error: "El nombre y el correo son obligatorios." }, { status: 400 });
    }
    if (!ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Rol no válido." }, { status: 400 });
    }
    if (body.role === "OWNER") {
      return NextResponse.json(
        { error: "El rol OWNER no puede asignarse desde el panel: la propiedad de la organización tiene controles especiales." },
        { status: 403 }
      );
    }

    // Buscar el perfil por correo; si no existe, crearlo (la contraseña se configura al primer ingreso)
    let profile = await db.profile.findUnique({ where: { email } });
    if (!profile) {
      profile = await db.profile.create({
        data: {
          fullName: String(body.name).trim(),
          email,
          status: "activo",
        },
      });
    }

    const branch = body.branch || null;

    const member = await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: profile.id } },
      update: { active: true, role: body.role },
      create: { organizationId: orgId, userId: profile.id, role: body.role, branchId: branch },
    });

    const user = {
      id: member.id,
      name: profile.fullName,
      email: profile.email,
      role: member.role,
      branch: member.branchId,
      active: member.active,
      lastAccess: profile.lastLoginAt,
      canViewCosts: member.canViewCosts,
      canAuthorize: member.canAuthorize,
      discountLimitPct: member.discountLimitPct,
      status: profile.status,
    };

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 400 });
  }
}
