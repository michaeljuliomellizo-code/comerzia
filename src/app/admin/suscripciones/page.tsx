import { formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminBadge,
  AdminFlash,
} from "@/components/admin/ui";
import { renewSubscription, cancelSubscription, toggleAutoRenew, assignTrial } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function SuscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const subs = await db.subscription.findMany({
    include: { organization: true, plan: true },
    orderBy: [{ status: "asc" }, { currentPeriodEnd: "asc" }],
  });

  return (
    <>
      <AdminPageHeader
        title="Suscripciones"
        description="Planes contratados por organización: renovar, cancelar y ajustar renovación automática"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title={`${subs.length} suscripciones`}>
        <AdminTable
          head={
            <>
              <AdminTh>Organización</AdminTh>
              <AdminTh>Plan</AdminTh>
              <AdminTh>Estado</AdminTh>
              <AdminTh>Período actual</AdminTh>
              <AdminTh>Renovación automática</AdminTh>
              <AdminTh>Acciones</AdminTh>
            </>
          }
          empty={subs.length === 0}
        >
          {subs.map((s) => (
            <tr key={s.id} className="align-top">
              <AdminTd className="font-medium">{s.organization.name}</AdminTd>
              <AdminTd>
                <p className="font-medium">{s.plan.name}</p>
                <p className="text-xs text-muted-foreground">
                  ${s.plan.monthlyPrice.toLocaleString("es-CO")}/mes
                </p>
              </AdminTd>
              <AdminTd>
                <AdminBadge tone={s.status}>{s.status}</AdminBadge>
              </AdminTd>
              <AdminTd>
                {s.currentPeriodEnd ? formatDate(s.currentPeriodEnd, false) : "—"}
                {s.status === "prueba" && s.organization.trialEndsAt && (
                  <p className="text-xs text-muted-foreground">Prueba: {formatDate(s.organization.trialEndsAt, false)}</p>
                )}
              </AdminTd>
              <AdminTd>
                <form action={toggleAutoRenew}>
                  <input type="hidden" name="subscriptionId" value={s.id} />
                  <input type="hidden" name="back" value="/admin/suscripciones" />
                  <button
                    className={`rounded-md border px-2 py-1 text-xs ${
                      s.cancelAtPeriodEnd
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {s.cancelAtPeriodEnd ? "Cancelación programada" : "Activa"}
                  </button>
                </form>
              </AdminTd>
              <AdminTd>
                <div className="flex flex-wrap items-center gap-1.5">
                  <form action={renewSubscription}>
                    <input type="hidden" name="subscriptionId" value={s.id} />
                    <input type="hidden" name="back" value="/admin/suscripciones" />
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                      Renovar 30 días
                    </button>
                  </form>
                  <form action={assignTrial} className="flex items-center gap-1">
                    <input type="hidden" name="organizationId" value={s.organizationId} />
                    <input type="hidden" name="back" value="/admin/suscripciones" />
                    <input name="days" type="number" min={1} max={180} defaultValue={15} className="h-7 w-14 rounded-md border bg-transparent px-1.5 text-xs" />
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-400">
                      Prueba
                    </button>
                  </form>
                  {s.status !== "cancelada" && (
                    <form action={cancelSubscription} className="flex items-center gap-1">
                      <input type="hidden" name="subscriptionId" value={s.id} />
                      <input type="hidden" name="back" value="/admin/suscripciones" />
                      <select name="type" className="h-7 rounded-md border bg-transparent px-1.5 text-xs" defaultValue="fin_periodo">
                        <option value="fin_periodo">Fin de período</option>
                        <option value="inmediata">Inmediata</option>
                      </select>
                      <input name="reason" placeholder="Motivo" className="h-7 w-28 rounded-md border bg-transparent px-1.5 text-xs" />
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400">
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
