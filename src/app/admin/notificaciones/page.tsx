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
import { sendNotification } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function NotificacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [notifications, orgs] = await Promise.all([
    db.platformNotification.findMany({
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Notificaciones"
        description="Comunicaciones a clientes: anuncios globales o mensajes a una organización"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Enviar notificación">
        <form action={sendNotification} className="grid items-end gap-3 md:grid-cols-5">
          <div className="space-y-1 md:col-span-2">
            <label className={adminLabel} htmlFor="n-title">Título *</label>
            <input id="n-title" name="title" required className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="n-audience">Destinatarios</label>
            <select id="n-audience" name="audience" className={adminField} defaultValue="todas">
              <option value="todas">Todas las organizaciones</option>
              <option value="organizacion">Una organización</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="n-org">Organización (si aplica)</label>
            <select id="n-org" name="organizationId" className={adminField} defaultValue="">
              <option value="">—</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="n-channel">Canal</label>
            <select id="n-channel" name="channel" className={adminField} defaultValue="in_app">
              <option value="in_app">En la aplicación</option>
              <option value="email">Correo electrónico</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-4">
            <label className={adminLabel} htmlFor="n-body">Mensaje</label>
            <textarea id="n-body" name="body" rows={3} className={`${adminField} h-auto py-2`} />
          </div>
          <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
            Enviar
          </button>
        </form>
      </AdminCard>

      <AdminCard className="mt-6" title={`${notifications.length} notificaciones enviadas`}>
        <AdminTable
          head={<><AdminTh>Título</AdminTh><AdminTh>Destinatarios</AdminTh><AdminTh>Canal</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Enviada</AdminTh></>}
          empty={notifications.length === 0}
        >
          {notifications.map((n) => (
            <tr key={n.id}>
              <AdminTd>
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="max-w-md truncate text-xs text-muted-foreground">{n.body}</p>}
              </AdminTd>
              <AdminTd className="text-xs">
                {n.audience === "todas" ? "Todas las organizaciones" : n.organization?.name ?? "—"}
              </AdminTd>
              <AdminTd className="text-xs capitalize">{n.channel === "in_app" ? "En la app" : "Correo"}</AdminTd>
              <AdminTd><AdminBadge tone={n.status}>{n.status}</AdminBadge></AdminTd>
              <AdminTd className="text-xs text-muted-foreground">
                {n.sentAt ? formatDate(n.sentAt) : "—"}
                {n.createdBy && <span className="block text-[11px]">por {n.createdBy}</span>}
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
