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
import { logAudit } from "@/lib/tenant";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; entidad?: string; accion?: string }>;
}) {
  const { msg, err, entidad, accion } = await searchParams;

  // Registrar la consulta de auditoría (actividad global auditada)
  const admin = await getSessionProfile();
  if (admin) {
    await logAudit({
      action: "view_audit",
      entity: "audit_logs",
      actor: { id: admin.id, email: admin.email },
    });
  }

  const where = {
    ...(entidad ? { entity: entidad } : {}),
    ...(accion ? { action: { contains: accion } } : {}),
  };

  const [logs, orgs] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    db.auditLog.groupBy({ by: ["entity"] }),
  ]);

  const entityNames = orgs.map((o) => o.entity);

  return (
    <>
      <AdminPageHeader
        title="Auditoría"
        description="Actividad global de la plataforma: accesos, cambios y operaciones del Super Admin"
      />
      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Registros recientes" value={String(logs.length)} hint="Últimos 150" />
        <AdminStatCard label="Entidades auditadas" value={String(entityNames.length)} />
        <AdminStatCard label="Filtro" value={`${entidad ?? "todas"} / ${accion ?? "todas"}`} tone="info" />
      </div>

      <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="a-entity">Entidad</label>
          <select id="a-entity" name="entidad" defaultValue={entidad ?? ""} className="h-9 rounded-md border bg-transparent px-3 text-sm">
            <option value="">Todas</option>
            {entityNames.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="a-action">Acción contiene</label>
          <input id="a-action" name="accion" defaultValue={accion ?? ""} placeholder="login, suspend…" className="h-9 rounded-md border bg-transparent px-3 text-sm" />
        </div>
        <button className="h-9 rounded-md border px-3 text-sm hover:bg-accent">Filtrar</button>
      </form>

      <AdminCard className="mt-3" title="Bitácora global">
        <AdminTable
          head={<><AdminTh>Fecha</AdminTh><AdminTh>Acción</AdminTh><AdminTh>Entidad</AdminTh><AdminTh>Organización</AdminTh><AdminTh>Detalle</AdminTh></>}
          empty={logs.length === 0}
        >
          {logs.map((l) => (
            <tr key={l.id}>
              <AdminTd className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(l.createdAt)}</AdminTd>
              <AdminTd>
                <span className="rounded-md border px-1.5 py-0.5 font-mono text-xs">{l.action}</span>
              </AdminTd>
              <AdminTd className="text-xs">{l.entity}</AdminTd>
              <AdminTd className="text-xs">{l.organization?.name ?? "—"}</AdminTd>
              <AdminTd className="max-w-md truncate text-xs text-muted-foreground">
                {l.changes ? JSON.stringify(l.changes) : "—"}
              </AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
