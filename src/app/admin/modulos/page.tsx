import Link from "next/link";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminFlash,
  adminField,
} from "@/components/admin/ui";
import { togglePlatformModule, setOrgModule } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function ModulosPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; org?: string }>;
}) {
  const { msg, err, org } = await searchParams;

  const [modules, orgs] = await Promise.all([
    db.platformModule.findMany({ orderBy: { sortOrder: "asc" } }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const selectedOrg = org ?? orgs[0]?.id;
  const orgModules = selectedOrg
    ? await db.organizationModule.findMany({ where: { organizationId: selectedOrg } })
    : [];
  const enabledSet = new Set(orgModules.filter((om) => om.enabled).map((om) => om.moduleId));
  const selectedOrgName = orgs.find((o) => o.id === selectedOrg)?.name;

  return (
    <>
      <AdminPageHeader
        title="Módulos"
        description="Activación y desactivación de funcionalidades: a nivel de plataforma y por organización"
      />
      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Catálogo de la plataforma" description="Si un módulo se desactiva, desaparece de todos los paneles del negocio">
          <AdminTable
            head={<><AdminTh>Módulo</AdminTh><AdminTh>Código</AdminTh><AdminTh>Disponible</AdminTh></>}
            empty={modules.length === 0}
          >
            {modules.map((m) => (
              <tr key={m.id}>
                <AdminTd>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </AdminTd>
                <AdminTd>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.code}</code>
                </AdminTd>
                <AdminTd>
                  <form action={togglePlatformModule}>
                    <input type="hidden" name="moduleId" value={m.id} />
                    <input type="hidden" name="back" value="/admin/modulos" />
                    <button
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                        m.isActive
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {m.isActive ? "Activo" : "Desactivado"}
                    </button>
                  </form>
                </AdminTd>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>

        <AdminCard
          title="Módulos por organización"
          description={selectedOrgName ? `Habilitación específica para "${selectedOrgName}"` : "Selecciona una organización"}
        >
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay organizaciones registradas todavía.{" "}
              <Link href="/admin/organizaciones" className="text-violet-600 hover:underline">Crear la primera</Link>
            </p>
          ) : (
            <>
              <form method="get" className="mb-4 flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="org-select">Organización</label>
                  <select id="org-select" name="org" defaultValue={selectedOrg} className={adminField}>
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <button className="h-9 rounded-md border px-3 text-sm hover:bg-accent">Ver módulos</button>
              </form>

              <ul className="space-y-2">
                {modules.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.isActive ? "Disponible en la plataforma" : "Desactivado a nivel global"}
                      </p>
                    </div>
                    <form action={setOrgModule}>
                      <input type="hidden" name="organizationId" value={selectedOrg ?? ""} />
                      <input type="hidden" name="moduleId" value={m.id} />
                      <input type="hidden" name="back" value={`/admin/modulos?org=${selectedOrg}`} />
                      <input type="hidden" name="enabled" value={enabledSet.has(m.id) ? "off" : "on"} />
                      <button
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                          enabledSet.has(m.id)
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "border-zinc-500/40 bg-zinc-500/10 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        {enabledSet.has(m.id) ? "Habilitado" : "Deshabilitado"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </>
          )}
        </AdminCard>
      </div>
    </>
  );
}
