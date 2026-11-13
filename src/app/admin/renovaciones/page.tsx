import { formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminFlash,
} from "@/components/admin/ui";
import { renewSubscription, toggleAutoRenew } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function RenovacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);

  const [upcoming, history] = await Promise.all([
    db.subscription.findMany({
      where: { status: "activa", currentPeriodEnd: { gte: now, lte: in30 } },
      include: { organization: true, plan: true },
      orderBy: { currentPeriodEnd: "asc" },
    }),
    db.saasRenewal.findMany({
      include: { organization: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Renovaciones"
        description="Renovación de suscripciones próximas a vencer e historial de renovaciones"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title={`${upcoming.length} suscripciones por renovar (30 días)`}>
        <AdminTable
          head={<><AdminTh>Organización</AdminTh><AdminTh>Plan</AdminTh><AdminTh>Vence</AdminTh><AdminTh>Auto-renovación</AdminTh><AdminTh>Acción</AdminTh></>}
          empty={upcoming.length === 0}
        >
          {upcoming.map((s) => (
            <tr key={s.id}>
              <AdminTd className="font-medium">{s.organization.name}</AdminTd>
              <AdminTd>
                {s.plan.name}
                <p className="text-xs text-muted-foreground">${s.plan.monthlyPrice.toLocaleString("es-CO")}/mes</p>
              </AdminTd>
              <AdminTd>{s.currentPeriodEnd ? formatDate(s.currentPeriodEnd, false) : "—"}</AdminTd>
              <AdminTd>
                <form action={toggleAutoRenew}>
                  <input type="hidden" name="subscriptionId" value={s.id} />
                  <input type="hidden" name="back" value="/admin/renovaciones" />
                  <button className={`rounded-md border px-2 py-1 text-xs ${s.cancelAtPeriodEnd ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                    {s.cancelAtPeriodEnd ? "Cancelación programada" : "Activa"}
                  </button>
                </form>
              </AdminTd>
              <AdminTd>
                <form action={renewSubscription}>
                  <input type="hidden" name="subscriptionId" value={s.id} />
                  <input type="hidden" name="back" value="/admin/renovaciones" />
                  <button className="rounded-md border px-2.5 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                    Renovar ahora (+30 días y factura)
                  </button>
                </form>
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>

      <AdminCard className="mt-6" title="Historial de renovaciones" description={`Últimos ${history.length} movimientos`}>
        <AdminTable
          head={<><AdminTh>Fecha</AdminTh><AdminTh>Organización</AdminTh><AdminTh>Período anterior</AdminTh><AdminTh>Nuevo período</AdminTh><AdminTh>Factura</AdminTh></>}
          empty={history.length === 0}
        >
          {history.map((r) => (
            <tr key={r.id}>
              <AdminTd className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</AdminTd>
              <AdminTd className="font-medium">{r.organization.name}</AdminTd>
              <AdminTd className="text-xs">{r.previousPeriodEnd ? formatDate(r.previousPeriodEnd, false) : "—"}</AdminTd>
              <AdminTd className="text-xs">{formatDate(r.newPeriodEnd, false)}</AdminTd>
              <AdminTd className="font-mono text-xs">{r.invoiceNumber ?? "—"}</AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
