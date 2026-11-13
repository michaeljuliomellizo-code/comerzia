import { formatMoney } from "@/lib/format";
import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminFlash,
  AdminBadge,
  adminField,
  adminLabel,
} from "@/components/admin/ui";
import { updatePlan } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function PlanesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { subscriptions: true } } },
  });

  return (
    <>
      <AdminPageHeader
        title="Planes"
        description="Configuración comercial de Básico, Profesional y Premium: precios, límites y disponibilidad"
      />
      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <AdminCard
            key={p.id}
            title={p.name}
            description={`${p._count.subscriptions} suscripciones · API: ${p.apiAccess}`}
            action={<AdminBadge tone={p.isActive ? "activa" : "cancelada"}>{p.isActive ? "activo" : "inactivo"}</AdminBadge>}
          >
            <form action={updatePlan} className="space-y-3">
              <input type="hidden" name="planId" value={p.id} />
              <input type="hidden" name="back" value="/admin/planes" />

              <div className="rounded-lg bg-muted/60 p-3">
                <p className="text-xs text-muted-foreground">{p.description}</p>
              </div>

              <div className="space-y-1">
                <label className={adminLabel} htmlFor={`price-${p.id}`}>Precio mensual (COP) *</label>
                <input
                  id={`price-${p.id}`}
                  name="monthlyPrice"
                  type="number"
                  min={0}
                  step={1000}
                  defaultValue={p.monthlyPrice}
                  className={adminField}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={adminLabel} htmlFor={`users-${p.id}`}>Máx. usuarios</label>
                  <input id={`users-${p.id}`} name="maxUsers" type="number" min={0} defaultValue={p.maxUsers ?? ""} className={adminField} placeholder="Ilimitado" />
                </div>
                <div className="space-y-1">
                  <label className={adminLabel} htmlFor={`products-${p.id}`}>Máx. productos</label>
                  <input id={`products-${p.id}`} name="maxProducts" type="number" min={0} defaultValue={p.maxProducts ?? ""} className={adminField} placeholder="Ilimitado" />
                </div>
                <div className="space-y-1">
                  <label className={adminLabel} htmlFor={`branches-${p.id}`}>Máx. sucursales</label>
                  <input id={`branches-${p.id}`} name="maxBranches" type="number" min={0} defaultValue={p.maxBranches ?? ""} className={adminField} placeholder="Ilimitado" />
                </div>
                <div className="space-y-1">
                  <label className={adminLabel} htmlFor={`customers-${p.id}`}>Máx. clientes</label>
                  <input id={`customers-${p.id}`} name="maxCustomers" type="number" min={0} defaultValue={p.maxCustomers ?? ""} className={adminField} placeholder="Ilimitado" />
                </div>
                <div className="space-y-1">
                  <label className={adminLabel} htmlFor={`pos-${p.id}`}>Máx. cajas POS</label>
                  <input id={`pos-${p.id}`} name="maxPos" type="number" min={0} defaultValue={p.maxPos ?? ""} className={adminField} placeholder="Ilimitado" />
                </div>
                <div className="space-y-1">
                  <label className={adminLabel} htmlFor={`storage-${p.id}`}>Almacenamiento (GB)</label>
                  <input id={`storage-${p.id}`} name="storageGb" type="number" min={0} defaultValue={p.storageGb ?? ""} className={adminField} placeholder="Ilimitado" />
                </div>
              </div>

              <div className="space-y-1">
                <label className={adminLabel} htmlFor={`desc-${p.id}`}>Descripción comercial</label>
                <textarea id={`desc-${p.id}`} name="description" defaultValue={p.description ?? ""} rows={3} className={`${adminField} h-auto py-2`} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isActive" defaultChecked={p.isActive} />
                Plan activo para nuevas contrataciones
              </label>

              <button className="h-9 w-full rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
                Guardar plan
              </button>
            </form>
          </AdminCard>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Precios oficiales vigentes: Básico {formatMoney(89900)} · Profesional {formatMoney(149900)} · Premium {formatMoney(229900)} (COP/mes).
        Deja los límites vacíos para que el plan sea ilimitado en esa dimensión.
      </p>
    </>
  );
}
