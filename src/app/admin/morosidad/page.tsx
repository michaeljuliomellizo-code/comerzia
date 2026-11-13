import Link from "next/link";
import { formatMoney, formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminBadge,
  AdminFlash,
  AdminStatCard,
} from "@/components/admin/ui";
import { processDelinquency, registerPayment, setOrganizationStatus } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function MorosidadPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [overdueInvoices, delinquentOrgs] = await Promise.all([
    db.saasInvoice.findMany({
      where: { status: "vencida" },
      include: { organization: true },
      orderBy: { dueAt: "asc" },
    }),
    db.organization.findMany({
      where: { status: { in: ["suspendida", "cancelada"] } },
      include: { subscription: { include: { plan: true } } },
      orderBy: { suspendedAt: "desc" },
    }),
  ]);

  const overdueTotal = overdueInvoices.reduce((a, i) => a + i.total, 0);

  return (
    <>
      <AdminPageHeader
        title="Morosidad"
        description="Suspensión y recuperación de organizaciones con pagos atrasados"
      >
        <form action={processDelinquency}>
          <input type="hidden" name="back" value="/admin/morosidad" />
          <button className="inline-flex h-9 items-center rounded-md bg-amber-600 px-4 text-sm font-medium text-white shadow hover:bg-amber-500">
            Procesar morosidad automática
          </button>
        </form>
      </AdminPageHeader>

      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Facturas vencidas" value={String(overdueInvoices.length)} tone="negative" />
        <AdminStatCard label="Monto en mora" value={formatMoney(overdueTotal)} tone="negative" />
        <AdminStatCard label="Organizaciones suspendidas" value={String(delinquentOrgs.filter((o) => o.status === "suspendida").length)} tone="warning" />
      </div>

      <AdminCard className="mt-4" title={`Facturas vencidas (${overdueInvoices.length})`} description="Registra el pago para recuperar la cuenta automáticamente">
        <AdminTable
          head={<><AdminTh>Factura</AdminTh><AdminTh>Organización</AdminTh><AdminTh>Venció</AdminTh><AdminTh>Total</AdminTh><AdminTh>Acción</AdminTh></>}
          empty={overdueInvoices.length === 0}
        >
          {overdueInvoices.map((i) => {
            const daysOverdue = Math.floor((Date.now() - i.dueAt.getTime()) / 86_400_000);
            return (
              <tr key={i.id}>
                <AdminTd className="font-mono text-xs">{i.number}</AdminTd>
                <AdminTd className="font-medium">{i.organization.name}</AdminTd>
                <AdminTd>
                  {formatDate(i.dueAt, false)}
                  <p className={`text-xs ${daysOverdue > 10 ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                    hace {daysOverdue} días
                  </p>
                </AdminTd>
                <AdminTd className="font-medium tabular-nums">{formatMoney(i.total)}</AdminTd>
                <AdminTd>
                  <form action={registerPayment} className="flex items-center gap-1">
                    <input type="hidden" name="invoiceId" value={i.id} />
                    <input type="hidden" name="back" value="/admin/morosidad" />
                    <select name="method" className="h-7 rounded-md border bg-transparent px-1.5 text-xs" defaultValue="transferencia">
                      <option value="transferencia">Transferencia</option>
                      <option value="pse">PSE</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="efectivo">Efectivo</option>
                    </select>
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                      Registrar pago
                    </button>
                  </form>
                </AdminTd>
              </tr>
            );
          })}
        </AdminTable>
      </AdminCard>

      <AdminCard className="mt-6" title={`Organizaciones suspendidas / canceladas (${delinquentOrgs.length})`}>
        <AdminTable
          head={<><AdminTh>Organización</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Plan</AdminTh><AdminTh>Suspendida</AdminTh><AdminTh>Acción</AdminTh></>}
          empty={delinquentOrgs.length === 0}
        >
          {delinquentOrgs.map((o) => (
            <tr key={o.id}>
              <AdminTd>
                <Link href={`/admin/soporte-organizacion/${o.id}`} className="font-medium hover:underline">
                  {o.name}
                </Link>
                <p className="text-xs text-muted-foreground">{o.email ?? ""}</p>
              </AdminTd>
              <AdminTd><AdminBadge tone={o.status}>{o.status}</AdminBadge></AdminTd>
              <AdminTd>{o.subscription?.plan.name ?? "—"}</AdminTd>
              <AdminTd className="text-xs text-muted-foreground">{o.suspendedAt ? formatDate(o.suspendedAt) : "—"}</AdminTd>
              <AdminTd>
                {o.status !== "activa" && (
                  <form action={setOrganizationStatus}>
                    <input type="hidden" name="organizationId" value={o.id} />
                    <input type="hidden" name="back" value="/admin/morosidad" />
                    <input type="hidden" name="status" value="activa" />
                    <button className="rounded-md border px-2.5 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                      Reactivar cuenta
                    </button>
                  </form>
                )}
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>

      <p className="mt-4 text-xs text-muted-foreground">
        Regla automática: facturas pendientes con vencimiento cumplido pasan a «vencida»; las suscripciones con período
        terminado hace más del período de gracia pasan a «vencida»; y las organizaciones con período terminado hace más
        del doble del período de gracia se suspenden. Configura la gracia en{" "}
        <Link href="/admin/configuracion" className="underline">Configuración</Link>.
      </p>
    </>
  );
}
