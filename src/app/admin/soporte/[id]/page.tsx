import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminBadge,
  AdminFlash,
  adminField,
} from "@/components/admin/ui";
import { replyTicket, setTicketStatus, setTicketPriority } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { id } = await params;
  const { msg, err } = await searchParams;

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      organization: true,
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) notFound();

  return (
    <>
      <AdminPageHeader
        title={`Ticket ${ticket.number}`}
        description={`${ticket.organization.name} · ${ticket.category ?? "general"}`}
      >
        <Link href="/admin/soporte" className="text-sm text-muted-foreground hover:text-foreground">
          ← Volver a soporte
        </Link>
      </AdminPageHeader>

      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <AdminCard title={ticket.subject}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <AdminBadge tone={ticket.status}>{ticket.status}</AdminBadge>
              <AdminBadge tone={ticket.priority}>{ticket.priority}</AdminBadge>
              <span className="text-xs text-muted-foreground">
                creado {formatDate(ticket.createdAt)} por {ticket.createdBy ?? "—"}
              </span>
            </div>
            <p className="whitespace-pre-line text-sm">{ticket.description || "(Sin descripción)"}</p>
          </AdminCard>

          <AdminCard title={`Conversación (${ticket.messages.length})`}>
            {ticket.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin mensajes todavía.</p>
            ) : (
              <ul className="space-y-3">
                {ticket.messages.map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-lg border p-3",
                      m.authorRole === "soporte"
                        ? m.isInternal
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-violet-500/30 bg-violet-500/5"
                        : "bg-muted/40"
                    )}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {m.authorName}
                        {m.authorRole === "soporte" && (
                          <span className="ml-1.5 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                            SOPORTE
                          </span>
                        )}
                        {m.isInternal && (
                          <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            INTERNA
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-line text-sm">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Responder">
            <form action={replyTicket} className="space-y-3">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input type="hidden" name="back" value={`/admin/soporte/${ticket.id}`} />
              <textarea
                name="body"
                rows={4}
                required
                placeholder="Escribe la respuesta para el cliente o una nota interna…"
                className={`${adminField} h-auto w-full py-2`}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="isInternal" />
                  Nota interna (no visible para el cliente)
                </label>
                <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
                  Enviar respuesta
                </button>
              </div>
            </form>
          </AdminCard>
        </div>

        <div className="space-y-4">
          <AdminCard title="Gestión">
            <div className="space-y-3">
              <form action={setTicketStatus} className="flex items-center gap-1.5">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="hidden" name="back" value={`/admin/soporte/${ticket.id}`} />
                <select name="status" defaultValue={ticket.status} className={adminField}>
                  <option value="abierto">Abierto</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
                <button className="h-9 shrink-0 rounded-md border px-3 text-sm hover:bg-accent">Cambiar</button>
              </form>
              <form action={setTicketPriority} className="flex items-center gap-1.5">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <input type="hidden" name="back" value={`/admin/soporte/${ticket.id}`} />
                <select name="priority" defaultValue={ticket.priority} className={adminField}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
                <button className="h-9 shrink-0 rounded-md border px-3 text-sm hover:bg-accent">Cambiar</button>
              </form>
            </div>
          </AdminCard>

          <AdminCard title="Cliente">
            <Link href={`/admin/soporte-organizacion/${ticket.organization.id}`} className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
              {ticket.organization.name}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              Estado de la cuenta: {ticket.organization.status}
            </p>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
