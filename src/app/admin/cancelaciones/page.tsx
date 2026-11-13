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
  adminField,
} from "@/components/admin/ui";
import { cancelSubscription, revokeCancellation } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function CancelacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [cancellations, activeSubs] = await Promise.all([
    db.saasCancellation.findMany({
      include: { organization: true },
      orderBy: { requestedAt: "desc" },
      take: 100,
    }),
    db.subscription.findMany({
      where: { status: { in: ["activa", "vencida", "prueba"] } },
      include: { organization: true, plan: true },
      orderBy: { organization: { name: "asc" } },
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Cancelaciones"
        description="Gestión de bajas: cancelar inmediatamente, programar fin de período y revertir"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Registrar una cancelación">
        <form action={cancelSubscription} className="grid items-end gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="cx-sub">Suscripción</label>
            <select id="cx-sub" name="subscriptionId" className={adminField} defaultValue="">
              <option value="">Selecciona la suscripción…</option>
              {activeSubs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.organization.name} · {s.plan.name} ({s.status})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="cx-type">Tipo</label>
            <select id="cx-type" name="type" className={adminField} defaultValue="fin_periodo">
              <option value="fin_periodo">Fin de período</option>
              <option value="inmediata">Inmediata</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="cx-reason">Motivo</label>
            <input id="cx-reason" name="reason" className={adminField} placeholder="Baja voluntaria, migración…" />
          </div>
          <button className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white shadow hover:bg-red-500">
            Cancelar suscripción
          </button>
        </form>
      </AdminCard>

      <AdminCard className="mt-6" title={`${cancellations.length} cancelaciones`}>
        <AdminTable
          head={<><AdminTh>Organización</AdminTh><AdminTh>Tipo</AdminTh><AdminTh>Motivo</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Solicitada</AdminTh><AdminTh>Efectiva</AdminTh><AdminTh>Acción</AdminTh></>}
          empty={cancellations.length === 0}
        >
          {cancellations.map((c) => (
            <tr key={c.id}>
              <AdminTd className="font-medium">{c.organization.name}</AdminTd>
              <AdminTd className="text-xs capitalize">{c.type.replace("_", " ")}</AdminTd>
              <AdminTd className="max-w-56 text-xs text-muted-foreground">{c.reason ?? "—"}</AdminTd>
              <AdminTd><AdminBadge tone={c.status}>{c.status}</AdminBadge></AdminTd>
              <AdminTd className="text-xs text-muted-foreground">{formatDate(c.requestedAt, false)}</AdminTd>
              <AdminTd className="text-xs">{c.effectiveAt ? formatDate(c.effectiveAt, false) : "—"}</AdminTd>
              <AdminTd>
                {c.status === "programada" && (
                  <form action={revokeCancellation}>
                    <input type="hidden" name="cancellationId" value={c.id} />
                    <input type="hidden" name="back" value="/admin/cancelaciones" />
                    <button className="rounded-md border px-2.5 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                      Revertir
                    </button>
                  </form>
                )}
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
