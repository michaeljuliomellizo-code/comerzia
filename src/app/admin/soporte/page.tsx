import Link from "next/link";
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
  adminLabel,
} from "@/components/admin/ui";
import { createTicket, setTicketStatus, setTicketPriority } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; estado?: string }>;
}) {
  const { msg, err, estado = "todas" } = await searchParams;

  const [tickets, orgs] = await Promise.all([
    db.supportTicket.findMany({
      where: estado !== "todas" ? { status: estado } : undefined,
      include: { organization: true, messages: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const openCount = await db.supportTicket.count({ where: { status: { in: ["abierto", "pendiente"] } } });

  return (
    <>
      <AdminPageHeader
        title="Soporte"
        description={`Tickets de atención · ${openCount} abiertos o en gestión`}
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Crear ticket para un cliente">
        <form action={createTicket} className="grid items-end gap-3 md:grid-cols-6">
          <div className="space-y-1 md:col-span-2">
            <label className={adminLabel} htmlFor="t-org">Organización *</label>
            <select id="t-org" name="organizationId" required className={adminField} defaultValue="">
              <option value="">Selecciona…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={adminLabel} htmlFor="t-subject">Asunto *</label>
            <input id="t-subject" name="subject" required className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="t-priority">Prioridad</label>
            <select id="t-priority" name="priority" className={adminField} defaultValue="media">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="t-category">Categoría</label>
            <select id="t-category" name="category" className={adminField} defaultValue="general">
              <option value="general">General</option>
              <option value="facturacion">Facturación</option>
              <option value="reportes">Reportes</option>
              <option value="capacitacion">Capacitación</option>
              <option value="suscripciones">Suscripciones</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-5">
            <label className={adminLabel} htmlFor="t-desc">Descripción</label>
            <input id="t-desc" name="description" className={adminField} />
          </div>
          <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
            Crear ticket
          </button>
        </form>
      </AdminCard>

      <div className="mt-4 flex flex-wrap gap-2">
        {["todas", "abierto", "pendiente", "resuelto", "cerrado"].map((s) => (
          <Link
            key={s}
            href={`/admin/soporte?estado=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              estado === s ? "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300" : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <AdminCard className="mt-3" title={`${tickets.length} tickets`}>
        <AdminTable
          head={<><AdminTh>Número</AdminTh><AdminTh>Organización</AdminTh><AdminTh>Asunto</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Prioridad</AdminTh><AdminTh>Actualizado</AdminTh><AdminTh>Acciones rápidas</AdminTh></>}
          empty={tickets.length === 0}
        >
          {tickets.map((t) => (
            <tr key={t.id}>
              <AdminTd className="font-mono text-xs">
                <Link href={`/admin/soporte/${t.id}`} className="hover:underline">{t.number}</Link>
                <p className="text-[11px] text-muted-foreground">{t.messages.length} mensajes</p>
              </AdminTd>
              <AdminTd className="text-xs">{t.organization.name}</AdminTd>
              <AdminTd>
                <Link href={`/admin/soporte/${t.id}`} className="font-medium hover:underline">
                  {t.subject}
                </Link>
              </AdminTd>
              <AdminTd><AdminBadge tone={t.status}>{t.status}</AdminBadge></AdminTd>
              <AdminTd><AdminBadge tone={t.priority}>{t.priority}</AdminBadge></AdminTd>
              <AdminTd className="text-xs text-muted-foreground">{formatDate(t.updatedAt)}</AdminTd>
              <AdminTd>
                <div className="flex flex-wrap items-center gap-1">
                  <form action={setTicketStatus} className="flex items-center gap-1">
                    <input type="hidden" name="ticketId" value={t.id} />
                    <input type="hidden" name="back" value={`/admin/soporte?estado=${estado}`} />
                    <input type="hidden" name="status" value={t.status === "abierto" ? "pendiente" : t.status === "pendiente" ? "resuelto" : "abierto"} />
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">
                      {t.status === "abierto" ? "Tomar" : t.status === "pendiente" ? "Resolver" : "Reabrir"}
                    </button>
                  </form>
                  <form action={setTicketPriority} className="flex items-center gap-1">
                    <input type="hidden" name="ticketId" value={t.id} />
                    <input type="hidden" name="back" value={`/admin/soporte?estado=${estado}`} />
                    <select name="priority" defaultValue={t.priority} className="h-7 rounded-md border bg-transparent px-1 text-xs">
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">OK</button>
                  </form>
                </div>
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
