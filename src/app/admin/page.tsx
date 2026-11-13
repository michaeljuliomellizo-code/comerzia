import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminBadge,
  AdminMiniBar,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function SaasDashboardPage() {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);

  const [
    orgsTotal,
    orgsActive,
    orgsTrial,
    orgsSuspended,
    plans,
    subsForMrr,
    trialSubs,
    pendingInvoices,
    overdueInvoices,
    openTickets,
    recentOrgs,
    upcomingRenewals,
  ] = await Promise.all([
    db.organization.count(),
    db.organization.count({ where: { status: "activa" } }),
    db.organization.count({ where: { status: "prueba" } }),
    db.organization.count({ where: { status: "suspendida" } }),
    db.plan.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { subscriptions: true } } } }),
    db.subscription.findMany({ where: { status: { in: ["activa", "vencida"] } }, include: { plan: true } }),
    db.subscription.findMany({
      where: { status: "prueba" },
      include: { organization: true, plan: true },
      orderBy: { organization: { trialEndsAt: "asc" } },
      take: 6,
    }),
    db.saasInvoice.aggregate({ where: { status: "pendiente" }, _count: true, _sum: { total: true } }),
    db.saasInvoice.aggregate({ where: { status: "vencida" }, _count: true, _sum: { total: true } }),
    db.supportTicket.count({ where: { status: { in: ["abierto", "pendiente"] } } }),
    db.organization.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { subscription: { include: { plan: true } } } }),
    db.subscription.findMany({
      where: { status: "activa", currentPeriodEnd: { gte: now, lte: in7Days } },
      include: { organization: true, plan: true },
      orderBy: { currentPeriodEnd: "asc" },
      take: 6,
    }),
  ]);

  const mrr = subsForMrr.reduce((a, s) => a + s.plan.monthlyPrice, 0);
  const totalSubs = await db.subscription.count();
  const maxPlanSubs = Math.max(1, ...plans.map((p) => p._count.subscriptions));
  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? "Plan";

  return (
    <>
      <AdminPageHeader
        title="Dashboard SaaS"
        description="Estadísticas generales de la plataforma COMERZIA"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <AdminStatCard label="Organizaciones activas" value={String(orgsActive)} hint={`${orgsTotal} registradas`} tone="positive" />
        <AdminStatCard label="MRR" value={formatMoney(mrr)} hint={`ARR ≈ ${formatMoney(mrr * 12)}`} tone="info" />
        <AdminStatCard label="En prueba" value={String(orgsTrial)} hint="Períodos de prueba vigentes" tone="default" />
        <AdminStatCard label="Suspendidas" value={String(orgsSuspended)} hint="Por morosidad" tone={orgsSuspended > 0 ? "negative" : "default"} />
        <AdminStatCard
          label="Por cobrar"
          value={formatMoney(pendingInvoices._sum.total ?? 0)}
          hint={`${pendingInvoices._count} facturas pendientes`}
          tone="warning"
        />
        <AdminStatCard
          label="Morosidad"
          value={formatMoney(overdueInvoices._sum.total ?? 0)}
          hint={`${overdueInvoices._count} facturas vencidas · ${openTickets} tickets abiertos`}
          tone={overdueInvoices._count > 0 ? "negative" : "default"}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <AdminCard title="Distribución por plan" description={`${totalSubs} suscripciones totales`} className="lg:col-span-1">
          <ul className="space-y-3">
            {plans.map((p) => (
              <li key={p.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">
                    {p._count.subscriptions} · {formatMoney(p.monthlyPrice)}/mes
                  </span>
                </div>
                <AdminMiniBar pct={(p._count.subscriptions / maxPlanSubs) * 100} />
              </li>
            ))}
          </ul>
        </AdminCard>

        <AdminCard title="Pruebas activas" description="Organizaciones en período de prueba">
          <AdminTable
            head={<><AdminTh>Organización</AdminTh><AdminTh>Plan</AdminTh><AdminTh>Termina</AdminTh></>}
            empty={trialSubs.length === 0}
          >
            {trialSubs.map((s) => {
              const days = s.organization.trialEndsAt
                ? Math.ceil((s.organization.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
                : null;
              return (
                <tr key={s.id}>
                  <AdminTd className="font-medium">{s.organization.name}</AdminTd>
                  <AdminTd>{s.plan.name}</AdminTd>
                  <AdminTd>
                    {days !== null ? (
                      <span className={days <= 5 ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
                        {days <= 0 ? "vencida" : `${days} días`}
                      </span>
                    ) : "—"}
                  </AdminTd>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>

        <AdminCard title="Renovaciones próximas" description="Siguientes 7 días">
          <AdminTable
            head={<><AdminTh>Organización</AdminTh><AdminTh>Plan</AdminTh><AdminTh>Vence</AdminTh></>}
            empty={upcomingRenewals.length === 0}
          >
            {upcomingRenewals.map((s) => (
              <tr key={s.id}>
                <AdminTd className="font-medium">{s.organization.name}</AdminTd>
                <AdminTd>{s.plan.name}</AdminTd>
                <AdminTd>{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd, false) : "—"}</AdminTd>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </div>

      <div className="mt-6">
        <AdminCard
          title="Últimas organizaciones registradas"
          action={
            <Link href="/admin/organizaciones" className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
              Ver todas →
            </Link>
          }
        >
          <AdminTable
            head={
              <>
                <AdminTh>Negocio</AdminTh>
                <AdminTh>Estado</AdminTh>
                <AdminTh>Plan</AdminTh>
                <AdminTh>Registrada</AdminTh>
              </>
            }
            empty={recentOrgs.length === 0}
          >
            {recentOrgs.map((o) => (
              <tr key={o.id}>
                <AdminTd>
                  <Link href={`/admin/soporte-organizacion/${o.id}`} className="font-medium hover:underline">
                    {o.name}
                  </Link>
                </AdminTd>
                <AdminTd>
                  <AdminBadge tone={o.status}>{o.status}</AdminBadge>
                </AdminTd>
                <AdminTd>{o.subscription?.plan.name ?? "—"}</AdminTd>
                <AdminTd>{formatDate(o.createdAt, false)}</AdminTd>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </div>
    </>
  );
}
