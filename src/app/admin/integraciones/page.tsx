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
import { toggleIntegration, saveIntegrationConfig, clearIntegrationError } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [integrations, errorLogs] = await Promise.all([
    db.platformIntegration.findMany({
      include: { logs: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    }),
    db.platformIntegrationLog.findMany({
      where: { level: { in: ["error", "warn"] } },
      include: { integration: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Integraciones"
        description="Configuración de servicios externos de la plataforma y consulta de errores"
      />
      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((it) => (
          <AdminCard
            key={it.id}
            title={it.name}
            description={`${it.category ?? "servicio"} · último evento: ${it.logs[0] ? formatDate(it.logs[0].createdAt, false) : "—"}`}
            action={
              <form action={toggleIntegration}>
                <input type="hidden" name="integrationId" value={it.id} />
                <input type="hidden" name="back" value="/admin/integraciones" />
                <button
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    it.isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {it.isActive ? "Activa" : "Inactiva"}
                </button>
              </form>
            }
          >
            {it.lastErrorMessage && (
              <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-400">
                <p className="font-medium">Último error</p>
                <p>{it.lastErrorMessage}</p>
                {it.lastErrorAt && <p className="mt-0.5 text-[11px] opacity-75">{formatDate(it.lastErrorAt)}</p>}
                <form action={clearIntegrationError} className="mt-1.5">
                  <input type="hidden" name="integrationId" value={it.id} />
                  <input type="hidden" name="back" value="/admin/integraciones" />
                  <button className="rounded-md border px-2 py-1 text-[11px] hover:bg-accent">
                    Marcar como revisado
                  </button>
                </form>
              </div>
            )}
            <form action={saveIntegrationConfig} className="space-y-2">
              <input type="hidden" name="integrationId" value={it.id} />
              <input type="hidden" name="back" value="/admin/integraciones" />
              <textarea
                name="config"
                rows={4}
                defaultValue={JSON.stringify(it.config, null, 2)}
                className={`${adminField} h-auto py-2 font-mono text-xs`}
              />
              <button className="h-8 w-full rounded-md border px-3 text-sm font-medium hover:bg-accent">
                Guardar configuración (JSON)
              </button>
            </form>
          </AdminCard>
        ))}
      </div>

      <AdminCard className="mt-6" title="Errores y advertencias recientes" description="Registro de integraciones (nivel error y warning)">
        <AdminTable
          head={<><AdminTh>Fecha</AdminTh><AdminTh>Integración</AdminTh><AdminTh>Nivel</AdminTh><AdminTh>Mensaje</AdminTh></>}
          empty={errorLogs.length === 0}
        >
          {errorLogs.map((l) => (
            <tr key={l.id}>
              <AdminTd className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(l.createdAt)}</AdminTd>
              <AdminTd className="text-xs font-medium">{l.integration.name}</AdminTd>
              <AdminTd><AdminBadge tone={l.level === "error" ? "vencida" : "pendiente"}>{l.level}</AdminBadge></AdminTd>
              <AdminTd className="text-xs">{l.message}</AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
