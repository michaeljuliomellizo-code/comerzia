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
import { generateInvoices, voidInvoice, registerPayment } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function FacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; estado?: string }>;
}) {
  const { msg, err, estado = "todas" } = await searchParams;

  const [invoices, totals] = await Promise.all([
    db.saasInvoice.findMany({
      where: estado !== "todas" ? { status: estado } : undefined,
      include: { organization: true },
      orderBy: { issuedAt: "desc" },
      take: 200,
    }),
    db.saasInvoice.aggregate({ _count: true, _sum: { total: true } }),
  ]);

  const dueCount = await db.saasInvoice.count({ where: { status: { in: ["pendiente", "vencida"] } } });

  return (
    <>
      <AdminPageHeader
        title="Facturación SaaS"
        description="Cobros de suscripciones: generar facturas del período, anular y registrar pagos rápidos"
      />

      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Facturas emitidas" value={String(totals._count)} hint={`Total facturado: ${formatMoney(totals._sum.total ?? 0)}`} />
        <AdminStatCard label="Por recaudar" value={String(dueCount)} hint="Pendientes + vencidas" tone="warning" />
        <AdminStatCard
          label="Filtro activo"
          value={estado === "todas" ? "Todas" : estado}
          hint="Filtra por estado en la tabla"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {["todas", "pendiente", "pagada", "vencida", "anulada"].map((s) => (
          <a
            key={s}
            href={`/admin/facturacion?estado=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
              estado === s ? "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300" : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            {s}
          </a>
        ))}
        <form action={generateInvoices} className="ml-auto">
          <input type="hidden" name="back" value="/admin/facturacion" />
          <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
            Generar facturas del período
          </button>
        </form>
      </div>

      <AdminCard className="mt-3" title={`${invoices.length} facturas`}>
        <AdminTable
          head={
            <>
              <AdminTh>Número</AdminTh>
              <AdminTh>Organización</AdminTh>
              <AdminTh>Período</AdminTh>
              <AdminTh>Total</AdminTh>
              <AdminTh>Estado</AdminTh>
              <AdminTh>Acciones</AdminTh>
            </>
          }
          empty={invoices.length === 0}
        >
          {invoices.map((i) => (
            <tr key={i.id}>
              <AdminTd className="font-mono text-xs">{i.number}</AdminTd>
              <AdminTd className="font-medium">{i.organization.name}</AdminTd>
              <AdminTd className="text-xs text-muted-foreground">
                {formatDate(i.periodStart, false)} → {formatDate(i.periodEnd, false)}
                <p className="text-[11px]">vence {formatDate(i.dueAt, false)}</p>
              </AdminTd>
              <AdminTd>
                <p className="font-medium tabular-nums">{formatMoney(i.total)}</p>
                <p className="text-[11px] text-muted-foreground">
                  base {formatMoney(i.amount)} + IVA {formatMoney(i.taxAmount)}
                </p>
              </AdminTd>
              <AdminTd>
                <AdminBadge tone={i.status}>{i.status}</AdminBadge>
                {i.paidAt && <p className="mt-0.5 text-[11px] text-muted-foreground">pagada {formatDate(i.paidAt, false)}</p>}
              </AdminTd>
              <AdminTd>
                <div className="flex flex-wrap items-center gap-1.5">
                  {["pendiente", "vencida"].includes(i.status) && (
                    <form action={registerPayment}>
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <input type="hidden" name="back" value="/admin/facturacion" />
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
                  )}
                  {i.status !== "anulada" && i.status !== "pagada" && (
                    <form action={voidInvoice}>
                      <input type="hidden" name="invoiceId" value={i.id} />
                      <input type="hidden" name="back" value="/admin/facturacion" />
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400">
                        Anular
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
