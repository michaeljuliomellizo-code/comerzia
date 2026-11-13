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
import { assignTrial, updatePlatformSettings } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function PruebasPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const now = new Date();
  const [trialOrgs, otherOrgs, defaultTrial] = await Promise.all([
    db.organization.findMany({
      where: { status: "prueba" },
      include: { subscription: { include: { plan: true } } },
      orderBy: { trialEndsAt: "asc" },
    }),
    db.organization.findMany({
      where: { status: { in: ["activa", "suspendida", "cancelada"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, status: true },
    }),
    db.platformSetting.findUnique({ where: { key: "default_trial_days" } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Pruebas gratuitas"
        description="Períodos de prueba vigentes y asignación de nuevas pruebas"
      />
      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Duración por defecto" description="Se aplica al crear organizaciones desde el panel">
          <form action={updatePlatformSettings} className="space-y-3">
            <input type="hidden" name="back" value="/admin/pruebas" />
            <input type="hidden" name="settingKeys" value="default_trial_days" />
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="trial-days">Días de prueba estándar</label>
              <input
                id="trial-days"
                name="setting_default_trial_days"
                type="number"
                min={0}
                max={180}
                defaultValue={defaultTrial?.value ?? "15"}
                className={adminField}
              />
            </div>
            <button className="h-9 w-full rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
              Guardar
            </button>
          </form>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground">Asignar prueba a una organización</p>
            <form action={assignTrial} className="mt-2 space-y-2">
              <input type="hidden" name="back" value="/admin/pruebas" />
              <select name="organizationId" className={adminField} defaultValue="">
                <option value="">Selecciona la organización…</option>
                {otherOrgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name} ({o.status})</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input name="days" type="number" min={1} max={180} defaultValue={15} className={adminField} />
                <button className="h-9 shrink-0 rounded-md border px-3 text-sm font-medium hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-400">
                  Asignar prueba
                </button>
              </div>
            </form>
          </div>
        </AdminCard>

        <AdminCard className="lg:col-span-2" title={`${trialOrgs.length} pruebas activas`} description="Organizaciones con período de prueba vigente">
          <AdminTable
            head={<><AdminTh>Organización</AdminTh><AdminTh>Plan</AdminTh><AdminTh>Termina</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Extender</AdminTh></>}
            empty={trialOrgs.length === 0}
          >
            {trialOrgs.map((o) => {
              const daysLeft = o.trialEndsAt
                ? Math.ceil((o.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
                : null;
              return (
                <tr key={o.id}>
                  <AdminTd className="font-medium">{o.name}</AdminTd>
                  <AdminTd>{o.subscription?.plan.name ?? "—"}</AdminTd>
                  <AdminTd>
                    {o.trialEndsAt ? formatDate(o.trialEndsAt, false) : "—"}
                    {daysLeft !== null && (
                      <p className={`text-xs ${daysLeft <= 5 ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                        {daysLeft <= 0 ? "vencida" : `${daysLeft} días restantes`}
                      </p>
                    )}
                  </AdminTd>
                  <AdminTd><AdminBadge tone={o.status}>{o.status}</AdminBadge></AdminTd>
                  <AdminTd>
                    <form action={assignTrial} className="flex items-center gap-1">
                      <input type="hidden" name="organizationId" value={o.id} />
                      <input type="hidden" name="back" value="/admin/pruebas" />
                      <input name="days" type="number" min={1} max={180} defaultValue={15} className="h-7 w-16 rounded-md border bg-transparent px-1.5 text-xs" />
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-400">
                        Extender
                      </button>
                    </form>
                  </AdminTd>
                </tr>
              );
            })}
          </AdminTable>
        </AdminCard>
      </div>
    </>
  );
}
