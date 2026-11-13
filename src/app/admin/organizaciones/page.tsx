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
  AdminLinkButton,
  adminField,
  adminLabel,
} from "@/components/admin/ui";
import {
  createOrganization,
  setOrganizationStatus,
  changeOrganizationPlan,
  assignTrial,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["todas", "activa", "prueba", "suspendida", "cancelada"] as const;

export default async function OrganizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; estado?: string; q?: string }>;
}) {
  const { msg, err, estado = "todas", q } = await searchParams;

  const where =
    estado !== "todas" || q
      ? {
          ...(estado !== "todas" ? { status: estado } : {}),
          ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { slug: { contains: q } }] } : {}),
        }
      : undefined;

  const [orgs, plans] = await Promise.all([
    db.organization.findMany({
      where,
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { members: true, products: true, sales: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <>
      <AdminPageHeader
        title="Organizaciones"
        description="Negocios registrados: crear, activar, suspender, cambiar plan y asignar pruebas"
      >
        <AdminLinkButton href="/admin/soporte" variant="outline">Ir a soporte</AdminLinkButton>
      </AdminPageHeader>

      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Nueva organización" description="Crea el negocio, su suscripción y el usuario propietario">
        <form action={createOrganization} className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-name">Nombre del negocio *</label>
            <input id="org-name" name="name" required placeholder="Distribuidora El Faro" className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-email">Correo de contacto</label>
            <input id="org-email" name="email" type="email" placeholder="contacto@negocio.com" className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-plan">Plan contratado *</label>
            <select id="org-plan" name="planCode" className={adminField} defaultValue="basico">
              {plans.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name} — $ {p.monthlyPrice.toLocaleString("es-CO")}/mes
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-owner-name">Nombre del propietario</label>
            <input id="org-owner-name" name="ownerName" placeholder="Camila Ríos" className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-owner-email">Correo del propietario (acceso) *</label>
            <input id="org-owner-email" name="ownerEmail" type="email" placeholder="propietario@negocio.com" className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-owner-pass">Contraseña inicial</label>
            <input id="org-owner-pass" name="ownerPassword" placeholder="demo123" className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="org-trial">Días de prueba (0 = sin prueba)</label>
            <input id="org-trial" name="trialDays" type="number" min={0} max={180} defaultValue={0} className={adminField} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={adminLabel} htmlFor="org-notes">Notas internas</label>
            <input id="org-notes" name="notes" placeholder="Notas del Super Admin sobre esta cuenta" className={adminField} />
          </div>
          <div className="flex items-end md:col-span-3">
            <button
              type="submit"
              className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500"
            >
              Crear organización
            </button>
          </div>
        </form>
      </AdminCard>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={`/admin/organizaciones?estado=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
              estado === s
                ? "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300"
                : "border-input text-muted-foreground hover:bg-accent"
            }`}
          >
            {s}
          </Link>
        ))}
        <form action="/admin/organizaciones" className="ml-auto flex gap-2">
          <input type="hidden" name="estado" value={estado} />
          <input name="q" defaultValue={q ?? ""} placeholder="Buscar nombre, correo o slug…" className={`${adminField} w-64`} />
          <button type="submit" className="h-9 rounded-md border px-3 text-sm hover:bg-accent">Buscar</button>
        </form>
      </div>

      <AdminCard className="mt-3" title={`${orgs.length} organizaciones${estado !== "todas" ? ` · filtro: ${estado}` : ""}`}>
        <AdminTable
          head={
            <>
              <AdminTh>Negocio</AdminTh>
              <AdminTh>Estado</AdminTh>
              <AdminTh>Plan</AdminTh>
              <AdminTh>Uso</AdminTh>
              <AdminTh>Acciones</AdminTh>
            </>
          }
          empty={orgs.length === 0}
        >
          {orgs.map((o) => {
            const trialEndsAt = o.trialEndsAt;
            const sub = o.subscription;
            return (
              <tr key={o.id} className="align-top">
                <AdminTd>
                  <Link href={`/admin/soporte-organizacion/${o.id}`} className="font-medium hover:underline">
                    {o.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{o.email ?? o.slug}</p>
                  {o.status === "prueba" && trialEndsAt && (
                    <p className="mt-0.5 text-xs text-sky-600 dark:text-sky-400">
                      Prueba hasta {formatDate(trialEndsAt, false)}
                    </p>
                  )}
                </AdminTd>
                <AdminTd>
                  <AdminBadge tone={o.status}>{o.status}</AdminBadge>
                </AdminTd>
                <AdminTd>
                  {sub ? (
                    <>
                      <p className="font-medium">{sub.plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ${sub.plan.monthlyPrice.toLocaleString("es-CO")}/mes ·{" "}
                        {sub.currentPeriodEnd ? `vence ${formatDate(sub.currentPeriodEnd, false)}` : "sin período"}
                      </p>
                      <AdminBadge tone={sub.status}>{sub.status}</AdminBadge>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Sin suscripción</span>
                  )}
                </AdminTd>
                <AdminTd>
                  <p className="text-xs text-muted-foreground">
                    {o._count.members} usuarios · {o._count.products} productos · {o._count.sales} ventas
                  </p>
                </AdminTd>
                <AdminTd>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {o.status !== "activa" && (
                      <form action={setOrganizationStatus}>
                        <input type="hidden" name="organizationId" value={o.id} />
                        <input type="hidden" name="back" value="/admin/organizaciones" />
                        <input type="hidden" name="status" value="activa" />
                        <button className="rounded-md border px-2 py-1 text-xs hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400">
                          Activar
                        </button>
                      </form>
                    )}
                    {o.status !== "suspendida" && (
                      <form action={setOrganizationStatus}>
                        <input type="hidden" name="organizationId" value={o.id} />
                        <input type="hidden" name="back" value="/admin/organizaciones" />
                        <input type="hidden" name="status" value="suspendida" />
                        <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400">
                          Suspender
                        </button>
                      </form>
                    )}
                    <form action={changeOrganizationPlan} className="flex items-center gap-1">
                      <input type="hidden" name="organizationId" value={o.id} />
                      <input type="hidden" name="back" value="/admin/organizaciones" />
                      <select name="planCode" defaultValue={sub?.plan.code ?? "basico"} className="h-7 rounded-md border bg-transparent px-1.5 text-xs">
                        {plans.map((p) => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">Cambiar plan</button>
                    </form>
                    <form action={assignTrial} className="flex items-center gap-1">
                      <input type="hidden" name="organizationId" value={o.id} />
                      <input type="hidden" name="back" value="/admin/organizaciones" />
                      <input name="days" type="number" min={1} max={180} defaultValue={15} className="h-7 w-16 rounded-md border bg-transparent px-1.5 text-xs" />
                      <button className="rounded-md border px-2 py-1 text-xs hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-400">
                        Asignar prueba
                      </button>
                    </form>
                  </div>
                </AdminTd>
              </tr>
            );
          })}
        </AdminTable>
      </AdminCard>
    </>
  );
}
