import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import { logAudit, getEnabledModuleCodes } from "@/lib/tenant";
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminBadge,
  AdminStatCard,
  AdminMiniBar,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

// Vista de soporte de una organización: acceso con autorización (solo super
// admin, verificado por el layout) y con auditoría (cada visita queda
// registrada en audit_logs).
export default async function SoporteOrganizacionPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  const admin = await getSessionProfile();
  const org = await db.organization.findUnique({
    where: { id: orgId },
    include: {
      subscription: { include: { plan: true } },
      settings: true,
      limitOverride: true,
      members: { include: { profile: { select: { email: true, fullName: true, status: true, lastLoginAt: true } } } },
    },
  });

  if (!org) notFound();

  if (admin) {
    await logAudit({
      action: "support_view_access",
      entity: "organizations",
      entityId: org.id,
      organizationId: org.id,
      changes: { name: org.name },
      actor: { id: admin.id, email: admin.email },
    });
  }

  const [productsCount, salesCount, customersCount, purchasesCount, recentSales, openTickets, enabledModules] =
    await Promise.all([
      db.product.count({ where: { organizationId: org.id } }),
      db.sale.count({ where: { organizationId: org.id } }),
      db.customer.count({ where: { organizationId: org.id } }),
      db.purchase.count({ where: { organizationId: org.id } }),
      db.sale.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.supportTicket.findMany({
        where: { organizationId: org.id, status: { in: ["abierto", "pendiente"] } },
        orderBy: { createdAt: "desc" },
      }),
      getEnabledModuleCodes(org.id),
    ]);

  const plan = org.subscription?.plan;
  const last30 = await db.sale.aggregate({
    where: { organizationId: org.id, status: "completada", createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    _sum: { total: true },
    _count: true,
  });

  const userLimit = org.limitOverride?.maxUsers ?? plan?.maxUsers ?? null;
  const productLimit = org.limitOverride?.maxProducts ?? plan?.maxProducts ?? null;

  return (
    <>
      <AdminPageHeader
        title={`Vista de soporte · ${org.name}`}
        description="Acceso autorizado y auditado a la información de la organización (solo lectura)"
      >
        <Link href="/admin/organizaciones" className="text-sm text-muted-foreground hover:text-foreground">
          ← Organizaciones
        </Link>
      </AdminPageHeader>

      <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-300">
        Estás viendo los datos del negocio con privilegios de soporte. Este acceso queda registrado en la auditoría.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Estado de la cuenta" value={org.status} tone={org.status === "activa" ? "positive" : org.status === "suspendida" ? "negative" : "warning"} />
        <AdminStatCard label="Plan" value={plan?.name ?? "—"} hint={plan ? `${formatMoney(plan.monthlyPrice)}/mes · suscripción ${org.subscription?.status}` : "sin suscripción"} />
        <AdminStatCard label="Ventas últimos 30 días" value={String(last30._count)} hint={formatMoney(last30._sum?.total ?? 0)} />
        <AdminStatCard label="Tickets abiertos" value={String(openTickets.length)} tone={openTickets.length > 0 ? "warning" : "positive"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Consumo y límites">
          <ul className="space-y-3 text-sm">
            <li>
              <div className="mb-1 flex justify-between"><span>Usuarios</span><span className="text-muted-foreground tabular-nums">{org.members.length} / {userLimit ?? "∞"}</span></div>
              {userLimit ? <AdminMiniBar pct={(org.members.length / userLimit) * 100} /> : null}
            </li>
            <li>
              <div className="mb-1 flex justify-between"><span>Productos</span><span className="text-muted-foreground tabular-nums">{productsCount} / {productLimit ?? "∞"}</span></div>
              {productLimit ? <AdminMiniBar pct={(productsCount / productLimit) * 100} /> : null}
            </li>
            <li className="flex justify-between"><span>Clientes</span><span className="text-muted-foreground tabular-nums">{customersCount}</span></li>
            <li className="flex justify-between"><span>Compras</span><span className="text-muted-foreground tabular-nums">{purchasesCount}</span></li>
            <li className="flex justify-between">
              <span>Módulos habilitados</span>
              <span className="text-muted-foreground tabular-nums">{enabledModules.length}</span>
            </li>
          </ul>
        </AdminCard>

        <AdminCard title="Usuarios del negocio">
          <AdminTable
            head={<><AdminTh>Usuario</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Último acceso</AdminTh></>}
            empty={org.members.length === 0}
          >
            {org.members.map((m) => (
              <tr key={m.id}>
                <AdminTd>
                  <p className="font-medium">{m.profile.fullName ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{m.profile.email} · {m.role}</p>
                </AdminTd>
                <AdminTd><AdminBadge tone={m.profile.status}>{m.profile.status}</AdminBadge></AdminTd>
                <AdminTd className="text-xs text-muted-foreground">
                  {m.profile.lastLoginAt ? formatDate(m.profile.lastLoginAt) : "nunca"}
                </AdminTd>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Últimas ventas">
          <AdminTable
            head={<><AdminTh>Folio</AdminTh><AdminTh>Cliente</AdminTh><AdminTh>Total</AdminTh><AdminTh>Fecha</AdminTh></>}
            empty={recentSales.length === 0}
          >
            {recentSales.map((s) => (
              <tr key={s.id}>
                <AdminTd className="font-mono text-xs">{s.folio}</AdminTd>
                <AdminTd className="text-xs">{s.customerName}</AdminTd>
                <AdminTd className="tabular-nums">{formatMoney(s.total, org.currency)}</AdminTd>
                <AdminTd className="text-xs text-muted-foreground">{formatDate(s.createdAt, false)}</AdminTd>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>

        <AdminCard title="Tickets abiertos">
          {openTickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tickets abiertos.</p>
          ) : (
            <ul className="space-y-2">
              {openTickets.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <Link href={`/admin/soporte/${t.id}`} className="text-sm font-medium hover:underline">
                      {t.subject}
                    </Link>
                    <p className="text-xs text-muted-foreground">{t.number} · {formatDate(t.createdAt, false)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <AdminBadge tone={t.status}>{t.status}</AdminBadge>
                    <AdminBadge tone={t.priority}>{t.priority}</AdminBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </>
  );
}
