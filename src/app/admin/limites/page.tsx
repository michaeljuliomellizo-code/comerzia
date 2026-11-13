import { formatDate } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  AdminTd,
  AdminTh,
  AdminFlash,
  AdminMiniBar,
  adminField,
  adminLabel,
} from "@/components/admin/ui";
import { setLimitOverride, removeLimitOverride } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function LimitesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [orgs, overrides] = await Promise.all([
    db.organization.findMany({
      orderBy: { name: "asc" },
      include: {
        subscription: { include: { plan: true } },
        limitOverride: true,
        _count: { select: { members: true, products: true, branches: true } },
      },
    }),
    db.organizationLimitOverride.findMany({ include: { organization: true } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Límites"
        description="Consumo por organización frente a los límites del plan y ampliaciones temporales"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Consumo de recursos por organización">
        <AdminTable
          head={
            <>
              <AdminTh>Organización</AdminTh>
              <AdminTh>Usuarios</AdminTh>
              <AdminTh>Productos</AdminTh>
              <AdminTh>Sucursales</AdminTh>
              <AdminTh>Ampliación temporal</AdminTh>
            </>
          }
          empty={orgs.length === 0}
        >
          {orgs.map((o) => {
            const plan = o.subscription?.plan;
            const override = o.limitOverride;
            const now = new Date();
            const overrideActive: typeof override =
              override && (!override.expiresAt || override.expiresAt > now) ? override : null;

            const userLimit = overrideActive?.maxUsers ?? plan?.maxUsers ?? null;
            const productLimit = overrideActive?.maxProducts ?? plan?.maxProducts ?? null;
            const branchLimit = overrideActive?.maxBranches ?? plan?.maxBranches ?? null;

            const usageRow = (used: number, limit: number | null) => (
              <AdminTd>
                <p className="text-xs tabular-nums">
                  {used} / {limit ?? "∞"}
                </p>
                {limit ? <AdminMiniBar pct={(used / limit) * 100} tone={used / limit > 0.85 ? "red" : used / limit > 0.6 ? "amber" : "emerald"} /> : null}
              </AdminTd>
            );

            return (
              <tr key={o.id} className="align-top">
                <AdminTd>
                  <p className="font-medium">{o.name}</p>
                  <p className="text-xs text-muted-foreground">Plan {plan?.name ?? "—"}</p>
                </AdminTd>
                {usageRow(o._count.members, userLimit)}
                {usageRow(o._count.products, productLimit)}
                {usageRow(o._count.branches, branchLimit)}
                <AdminTd>
                  {overrideActive ? (
                    <div className="text-xs">
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        Ampliada: usuarios {overrideActive.maxUsers ?? "—"} · productos {overrideActive.maxProducts ?? "—"}
                      </p>
                      <p className="text-muted-foreground">
                        {overrideActive.expiresAt ? `Vence ${formatDate(overrideActive.expiresAt, false)}` : "Sin vencimiento"}
                        {overrideActive.note ? ` · ${overrideActive.note}` : ""}
                      </p>
                      <form action={removeLimitOverride} className="mt-1">
                        <input type="hidden" name="organizationId" value={o.id} />
                        <input type="hidden" name="back" value="/admin/limites" />
                        <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400">
                          Eliminar ampliación
                        </button>
                      </form>
                    </div>
                  ) : (
                    <form action={setLimitOverride} className="space-y-1.5">
                      <input type="hidden" name="organizationId" value={o.id} />
                      <input type="hidden" name="back" value="/admin/limites" />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input name="maxUsers" type="number" placeholder="Usu." className="h-7 w-16 rounded-md border bg-transparent px-1.5 text-xs" title="Máx. usuarios temporal" />
                        <input name="maxProducts" type="number" placeholder="Prod." className="h-7 w-16 rounded-md border bg-transparent px-1.5 text-xs" title="Máx. productos temporal" />
                        <input name="maxBranches" type="number" placeholder="Suc." className="h-7 w-14 rounded-md border bg-transparent px-1.5 text-xs" title="Máx. sucursales temporal" />
                        <input name="storageGb" type="number" placeholder="GB" className="h-7 w-14 rounded-md border bg-transparent px-1.5 text-xs" title="Almacenamiento temporal (GB)" />
                        <input name="expiresAt" type="date" className="h-7 rounded-md border bg-transparent px-1.5 text-xs" title="Vencimiento de la ampliación" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input name="note" placeholder="Motivo (opcional)" className="h-7 flex-1 rounded-md border bg-transparent px-1.5 text-xs" />
                        <button className="rounded-md border px-2 py-1 text-xs hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-400">
                          Ampliar límites
                        </button>
                      </div>
                    </form>
                  )}
                </AdminTd>
              </tr>
            );
          })}
        </AdminTable>
      </AdminCard>

      <AdminCard className="mt-6" title={`${overrides.length} ampliaciones registradas`} description="Historial completo de ampliaciones temporales">
        <AdminTable
          head={<><AdminTh>Organización</AdminTh><AdminTh>Límites</AdminTh><AdminTh>Vence</AdminTh><AdminTh>Nota</AdminTh></>}
          empty={overrides.length === 0}
        >
          {overrides.map((ov) => (
            <tr key={ov.id}>
              <AdminTd className="font-medium">{ov.organization.name}</AdminTd>
              <AdminTd className="text-xs">
                Usuarios {ov.maxUsers ?? "—"} · Productos {ov.maxProducts ?? "—"} · Sucursales {ov.maxBranches ?? "—"} · {ov.storageGb ?? "—"} GB
              </AdminTd>
              <AdminTd className="text-xs">{ov.expiresAt ? formatDate(ov.expiresAt, false) : "sin vencimiento"}</AdminTd>
              <AdminTd className="text-xs text-muted-foreground">{ov.note ?? "—"}</AdminTd>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </>
  );
}
