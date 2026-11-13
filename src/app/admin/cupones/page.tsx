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
import { createPlatformCoupon, togglePlatformCoupon, deletePlatformCoupon } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function CuponesPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const coupons = await db.platformCoupon.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <AdminPageHeader
        title="Cupones"
        description="Descuentos comerciales sobre las suscripciones de la plataforma"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Nuevo cupón">
        <form action={createPlatformCoupon} className="grid items-end gap-3 md:grid-cols-6">
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="c-code">Código *</label>
            <input id="c-code" name="code" required placeholder="BIENVENIDA20" className={`${adminField} uppercase`} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="c-type">Tipo</label>
            <select id="c-type" name="discountType" className={adminField}>
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="monto">Monto ($)</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="c-value">Valor *</label>
            <input id="c-value" name="value" type="number" min={1} required className={adminField} />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="c-max">Máx. usos</label>
            <input id="c-max" name="maxRedemptions" type="number" min={1} className={adminField} placeholder="Ilimitado" />
          </div>
          <div className="space-y-1">
            <label className={adminLabel} htmlFor="c-ends">Vence</label>
            <input id="c-ends" name="endsAt" type="date" className={adminField} />
          </div>
          <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
            Crear cupón
          </button>
          <div className="space-y-1 md:col-span-6">
            <label className={adminLabel} htmlFor="c-notes">Notas</label>
            <input id="c-notes" name="notes" className={adminField} placeholder="Condiciones o descripción del cupón" />
          </div>
        </form>
      </AdminCard>

      <AdminCard className="mt-6" title={`${coupons.length} cupones`}>
        <AdminTable
          head={<><AdminTh>Código</AdminTh><AdminTh>Descuento</AdminTh><AdminTh>Usos</AdminTh><AdminTh>Vigencia</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Acciones</AdminTh></>}
          empty={coupons.length === 0}
        >
          {coupons.map((c) => (
            <tr key={c.id}>
              <AdminTd>
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-bold">{c.code}</code>
                {c.notes && <p className="mt-1 text-xs text-muted-foreground">{c.notes}</p>}
              </AdminTd>
              <AdminTd className="font-medium">
                {c.discountType === "porcentaje" ? `${c.value}%` : `$${c.value.toLocaleString("es-CO")}`}
              </AdminTd>
              <AdminTd className="text-xs tabular-nums">
                {c.redemptions}
                {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
              </AdminTd>
              <AdminTd className="text-xs">
                {c.startsAt && <>desde {formatDate(c.startsAt, false)}<br /></>}
                {c.endsAt ? `hasta ${formatDate(c.endsAt, false)}` : "sin vencimiento"}
              </AdminTd>
              <AdminTd><AdminBadge tone={c.isActive ? "activa" : "cancelada"}>{c.isActive ? "activo" : "inactivo"}</AdminBadge></AdminTd>
              <AdminTd>
                <div className="flex gap-1.5">
                  <form action={togglePlatformCoupon}>
                    <input type="hidden" name="couponId" value={c.id} />
                    <input type="hidden" name="back" value="/admin/cupones" />
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">
                      {c.isActive ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                  <form action={deletePlatformCoupon}>
                    <input type="hidden" name="couponId" value={c.id} />
                    <input type="hidden" name="back" value="/admin/cupones" />
                    <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400">
                      Eliminar
                    </button>
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
