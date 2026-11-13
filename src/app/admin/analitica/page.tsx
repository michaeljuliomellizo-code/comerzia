import { formatMoney, formatCompact } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminStatCard,
  AdminMiniBar,
  AdminTable,
  AdminTd,
  AdminTh,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AnaliticaPage() {
  const now = new Date();

  const [subs, orgs, cancellations] = await Promise.all([
    db.subscription.findMany({ include: { plan: true, organization: true } }),
    db.organization.findMany({ select: { id: true, createdAt: true, status: true } }),
    db.saasCancellation.findMany({ where: { status: { in: ["efectiva", "programada"] } } }),
  ]);

  // MRR: suscripciones activas y vencidas (siguen facturando)
  const activeSubs = subs.filter((s) => ["activa", "vencida"].includes(s.status));
  const mrr = activeSubs.reduce((a, s) => a + s.plan.monthlyPrice, 0);
  const arr = mrr * 12;

  // Churn: cancelaciones efectivas o programadas / total de suscripciones
  const churnPct = subs.length > 0 ? (cancellations.length / subs.length) * 100 : 0;

  // Recaudo real de los últimos meses (pagos confirmados por mes)
  const months: Array<{ key: string; label: string; income: number; newOrgs: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("es-CO", { month: "short" }).format(d),
      income: 0,
      newOrgs: 0,
    });
  }

  const payments = await db.saasPayment.findMany({ where: { status: "confirmado" } });
  for (const p of payments) {
    const key = `${p.receivedAt.getFullYear()}-${String(p.receivedAt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) m.income += p.amount;
  }
  for (const o of orgs) {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.find((x) => x.key === key);
    if (m) m.newOrgs += 1;
  }

  const maxIncome = Math.max(1, ...months.map((m) => m.income));
  const maxNewOrgs = Math.max(1, ...months.map((m) => m.newOrgs));

  // Distribución por plan
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  const byPlan = plans.map((p) => ({
    plan: p,
    subs: activeSubs.filter((s) => s.planId === p.id).length,
  }));

  // ARPU
  const arpu = activeSubs.length > 0 ? mrr / activeSubs.length : 0;

  // Retención aproximada: organizaciones activas vs total
  const retentionPct = orgs.length > 0 ? (orgs.filter((o) => o.status !== "cancelada").length / orgs.length) * 100 : 0;

  return (
    <>
      <AdminPageHeader
        title="Analítica"
        description="MRR, ARR, churn y crecimiento de la plataforma"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard label="MRR" value={formatMoney(mrr)} hint={`${activeSubs.length} suscripciones facturables`} tone="positive" />
        <AdminStatCard label="ARR" value={formatCompact(arr)} hint="MRR anualizado" tone="info" />
        <AdminStatCard label="Churn" value={`${churnPct.toFixed(1)}%`} hint={`${cancellations.length} cancelaciones de ${subs.length} suscripciones`} tone={churnPct > 10 ? "negative" : "default"} />
        <AdminStatCard label="ARPU" value={formatMoney(arpu)} hint="Ingreso promedio por suscripción" />
        <AdminStatCard label="Retención de cuentas" value={`${retentionPct.toFixed(0)}%`} hint="Organizaciones no canceladas" tone={retentionPct >= 90 ? "positive" : "warning"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Recaudo mensual" description="Pagos confirmados de suscripciones (6 meses)">
          <div className="flex h-48 items-end gap-3 px-2">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                  {m.income > 0 ? formatCompact(m.income) : "—"}
                </span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-violet-600/60 to-violet-400"
                  style={{ height: `${Math.max(3, (m.income / maxIncome) * 100)}%` }}
                  title={formatMoney(m.income)}
                />
                <span className="text-xs capitalize text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="Nuevas organizaciones" description="Crecimiento de clientes del SaaS (6 meses)">
          <div className="flex h-48 items-end gap-3 px-2">
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{m.newOrgs}</span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-emerald-600/60 to-emerald-400"
                  style={{ height: `${Math.max(3, (m.newOrgs / maxNewOrgs) * 100)}%` }}
                />
                <span className="text-xs capitalize text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AdminCard title="Suscripciones por plan">
          <ul className="space-y-3">
            {byPlan.map(({ plan, subs }) => {
              const max = Math.max(1, ...byPlan.map((b) => b.subs));
              return (
                <li key={plan.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-muted-foreground">
                      {subs} · MRR {formatMoney(subs * plan.monthlyPrice)}
                    </span>
                  </div>
                  <AdminMiniBar pct={(subs / max) * 100} tone="violet" />
                </li>
              );
            })}
          </ul>
        </AdminCard>

        <AdminCard title="Detalle por plan">
          <AdminTable
            head={<><AdminTh>Plan</AdminTh><AdminTh>Precio</AdminTh><AdminTh>Suscripciones</AdminTh><AdminTh>MRR del plan</AdminTh><AdminTh>ARR del plan</AdminTh></>}
            empty={byPlan.length === 0}
          >
            {byPlan.map(({ plan, subs }) => (
              <tr key={plan.id}>
                <AdminTd className="font-medium">{plan.name}</AdminTd>
                <AdminTd className="tabular-nums">{formatMoney(plan.monthlyPrice)}</AdminTd>
                <AdminTd className="tabular-nums">{subs}</AdminTd>
                <AdminTd className="tabular-nums">{formatMoney(subs * plan.monthlyPrice)}</AdminTd>
                <AdminTd className="tabular-nums">{formatCompact(subs * plan.monthlyPrice * 12)}</AdminTd>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </div>
    </>
  );
}
