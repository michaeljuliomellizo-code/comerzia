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
  adminField,
  adminLabel,
} from "@/components/admin/ui";
import { registerPayment, setPaymentStatus } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [payments, pendingInvoices] = await Promise.all([
    db.saasPayment.findMany({
      include: { organization: true, invoice: true },
      orderBy: { receivedAt: "desc" },
      take: 120,
    }),
    db.saasInvoice.findMany({
      where: { status: { in: ["pendiente", "vencida"] } },
      include: { organization: true },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const received = payments.filter((p) => p.status === "confirmado").reduce((a, p) => a + p.amount, 0);

  return (
    <>
      <AdminPageHeader
        title="Pagos"
        description="Seguimiento de pagos de suscripciones: registrar, confirmar o rechazar"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard
        title="Registrar pago de una factura"
        description={`${pendingInvoices.length} facturas por cobrar · ${formatMoney(received)} recaudados (confirmados, últimos ${payments.length} pagos)`}
      >
        {pendingInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay facturas pendientes de pago.</p>
        ) : (
          <form action={registerPayment} className="grid items-end gap-3 md:grid-cols-5">
            <div className="space-y-1 md:col-span-2">
              <label className={adminLabel} htmlFor="pay-invoice">Factura</label>
              <select id="pay-invoice" name="invoiceId" className={adminField}>
                {pendingInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · {i.organization.name} · {formatMoney(i.total)} ({i.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="pay-method">Método</label>
              <select id="pay-method" name="method" className={adminField} defaultValue="transferencia">
                <option value="transferencia">Transferencia</option>
                <option value="pse">PSE</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="pay-ref">Referencia</label>
              <input id="pay-ref" name="reference" placeholder="TRX-123456" className={adminField} />
            </div>
            <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
              Registrar pago
            </button>
          </form>
        )}
      </AdminCard>

      <AdminCard className="mt-6" title={`${payments.length} pagos registrados`}>
        <AdminTable
          head={
            <>
              <AdminTh>Fecha</AdminTh>
              <AdminTh>Organización</AdminTh>
              <AdminTh>Factura</AdminTh>
              <AdminTh>Monto</AdminTh>
              <AdminTh>Método / referencia</AdminTh>
              <AdminTh>Estado</AdminTh>
              <AdminTh>Acciones</AdminTh>
            </>
          }
          empty={payments.length === 0}
        >
          {payments.map((p) => (
            <tr key={p.id}>
              <AdminTd className="text-xs text-muted-foreground">{formatDate(p.receivedAt, false)}</AdminTd>
              <AdminTd className="font-medium">{p.organization.name}</AdminTd>
              <AdminTd className="font-mono text-xs">{p.invoice?.number ?? "—"}</AdminTd>
              <AdminTd className="tabular-nums">{formatMoney(p.amount)}</AdminTd>
              <AdminTd className="text-xs capitalize">
                {p.method}
                {p.reference && <span className="text-muted-foreground"> · {p.reference}</span>}
              </AdminTd>
              <AdminTd>
                <AdminBadge tone={p.status}>{p.status}</AdminBadge>
              </AdminTd>
              <AdminTd>
                <div className="flex gap-1.5">
                  {p.status !== "confirmado" && (
                    <form action={setPaymentStatus}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="back" value="/admin/pagos" />
                      <input type="hidden" name="status" value="confirmado" />
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                        Confirmar
                      </button>
                    </form>
                  )}
                  {p.status !== "rechazado" && (
                    <form action={setPaymentStatus}>
                      <input type="hidden" name="paymentId" value={p.id} />
                      <input type="hidden" name="back" value="/admin/pagos" />
                      <input type="hidden" name="status" value="rechazado" />
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400">
                        Rechazar
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
