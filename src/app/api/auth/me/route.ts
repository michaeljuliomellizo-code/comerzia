import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getOrCreateOrgSettings } from "@/lib/tenant";
import { db } from "@/lib/db";

// GET /api/auth/me — contexto de sesión para el panel del negocio
export async function GET() {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (profile.isSuperAdmin) {
    return NextResponse.json({
      profile: { id: profile.id, email: profile.email, fullName: profile.fullName, isSuperAdmin: true },
      organization: null,
      plan: null,
      subscription: null,
      modules: [],
    });
  }

  const member = await db.organizationMember.findFirst({
    where: { userId: profile.id, active: true },
    include: { organization: true },
    orderBy: { createdAt: "asc" },
  });

  if (!member) {
    return NextResponse.json({ error: "Sin organización activa." }, { status: 403 });
  }

  const subscription = await db.subscription.findUnique({
    where: { organizationId: member.organization.id },
    include: { plan: true },
  });

  const enabledModules = await db.organizationModule.findMany({
    where: { organizationId: member.organization.id, enabled: true, module: { isActive: true } },
    include: { module: { select: { code: true } } },
  });

  const settings = await getOrCreateOrgSettings(member.organization.id);

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      isSuperAdmin: false,
      role: member.role,
    },
    organization: {
      id: member.organization.id,
      name: member.organization.name,
      slug: member.organization.slug,
      status: member.organization.status,
      trialEndsAt: member.organization.trialEndsAt,
      currency: member.organization.currency,
    },
    settings: { storeName: settings.storeName, currency: settings.currency, taxRate: settings.taxRate },
    plan: subscription?.plan ? { code: subscription.plan.code, name: subscription.plan.name, monthlyPrice: subscription.plan.monthlyPrice } : null,
    subscription: subscription
      ? { status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd }
      : null,
    modules: enabledModules.map((m) => m.module.code),
  });
}
