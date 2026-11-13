import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import type {
  Organization,
  OrganizationMember,
  OrganizationSetting,
  Plan,
  Profile,
  Subscription,
} from "@prisma/client";

// ── Contexto multi-tenant de la solicitud ────────────────────────────────────

export interface OrgContext {
  profile: Profile;
  organization: Organization;
  member: OrganizationMember | null; // null cuando el super admin visita una organización
  settings: OrganizationSetting;
  subscription: Subscription | null;
  plan: Plan | null;
  enabledModules: string[]; // códigos de módulos activos para la organización
}

// Configuración del comercio; crea el registro por defecto si no existe.
export async function getOrCreateOrgSettings(organizationId: string): Promise<OrganizationSetting> {
  const existing = await db.organizationSetting.findUnique({ where: { organizationId } });
  if (existing) return existing;
  const org = await db.organization.findUnique({ where: { id: organizationId } });
  return db.organizationSetting.create({
    data: { organizationId, storeName: org?.name ?? "Mi Comercio", taxId: org?.taxId, address: org?.address },
  });
}

// Códigos de módulos habilitados para una organización:
// el módulo debe estar activo en la plataforma Y habilitado para la organización.
export async function getEnabledModuleCodes(organizationId: string): Promise<string[]> {
  const rows = await db.organizationModule.findMany({
    where: { organizationId, enabled: true, module: { isActive: true } },
    include: { module: { select: { code: true } } },
  });
  return rows.map((r) => r.module.code);
}

export async function isModuleEnabled(organizationId: string, code: string): Promise<boolean> {
  const codes = await getEnabledModuleCodes(organizationId);
  return codes.includes(code);
}

// ── API guards (Route Handlers) ──────────────────────────────────────────────

export type ApiGuard<T> = { ctx: T; error: null } | { ctx: null; error: NextResponse };

/** Guard para rutas de negocio del panel: exige sesión + organización activa. */
export async function requireOrgApi(): Promise<ApiGuard<OrgContext>> {
  const profile = await getSessionProfile();
  if (!profile) {
    return { ctx: null, error: NextResponse.json({ error: "Sesión requerida. Inicia sesión de nuevo." }, { status: 401 }) };
  }

  // Super administrador: gestiona la plataforma y no opera un comercio concreto.
  if (profile.isSuperAdmin) {
    return {
      ctx: null,
      error: NextResponse.json({ error: "El administrador de la plataforma debe usar el panel del SaaS (/admin)." }, { status: 403 }),
    };
  }

  const member = await db.organizationMember.findFirst({
    where: { userId: profile.id, active: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!member) {
    return { ctx: null, error: NextResponse.json({ error: "No perteneces a ninguna organización activa." }, { status: 403 }) };
  }

  const organization = member.organization;
  if (organization.status === "suspendida") {
    return {
      ctx: null,
      error: NextResponse.json(
        { error: "La organización está suspendida. Contacta a soporte@comerzia.com para reactivarla." },
        { status: 403 }
      ),
    };
  }

  const settings = await getOrCreateOrgSettings(organization.id);
  const subscription = await db.subscription.findUnique({
    where: { organizationId: organization.id },
    include: { plan: true },
  });

  const ctx: OrgContext = {
    profile,
    organization,
    member,
    settings,
    subscription: subscription ?? null,
    plan: subscription?.plan ?? null,
    enabledModules: await getEnabledModuleCodes(organization.id),
  };
  return { ctx, error: null };
}

/** Guard para rutas administrativas del SaaS: exige perfil super admin. */
export async function requireSuperAdminApi(): Promise<ApiGuard<Profile>> {
  const profile = await getSessionProfile();
  if (!profile) {
    return { ctx: null, error: NextResponse.json({ error: "Sesión requerida. Inicia sesión de nuevo." }, { status: 401 }) };
  }
  if (!profile.isSuperAdmin) {
    return { ctx: null, error: NextResponse.json({ error: "Solo el administrador de la plataforma puede realizar esta acción." }, { status: 403 }) };
  }
  return { ctx: profile, error: null };
}

// ── Page guards (Server Components / Actions) ────────────────────────────────

export async function requireSuperAdminPage(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/admin");
  if (!profile.isSuperAdmin) redirect("/panel");
  return profile;
}

export async function requireOrgPage(): Promise<OrgContext | null> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?next=/panel");
  if (profile.isSuperAdmin) redirect("/admin");

  const member = await db.organizationMember.findFirst({
    where: { userId: profile.id, active: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member) redirect("/login?error=org");

  const organization = member.organization;
  if (organization.status === "suspendida") return null; // /panel muestra la pantalla de bloqueo

  const settings = await getOrCreateOrgSettings(organization.id);
  const subscription = await db.subscription.findUnique({
    where: { organizationId: organization.id },
    include: { plan: true },
  });

  return {
    profile,
    organization,
    member,
    settings,
    subscription: subscription ?? null,
    plan: subscription?.plan ?? null,
    enabledModules: await getEnabledModuleCodes(organization.id),
  };
}

// ── Auditoría ────────────────────────────────────────────────────────────────

export interface AuditEntry {
  action: string; // login | login_fallido | create | update | delete | suspend | activate | ...
  entity: string; // organizations | subscriptions | saas_invoices | profiles | ...
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  organizationId?: string | null;
  actor?: { id: string; email: string } | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        changes: entry.changes ? (entry.changes as object) : undefined,
        organizationId: entry.organizationId ?? null,
        userId: entry.actor?.id ?? null,
      },
    });
  } catch {
    // La auditoría nunca debe romper la operación principal.
  }
}
