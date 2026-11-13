import { db } from "@/lib/db";
import {
  AdminCard,
  AdminPageHeader,
  AdminFlash,
  adminField,
  adminLabel,
} from "@/components/admin/ui";
import { updatePlatformSettings } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

// Parámetros generales de la plataforma con descripciones para el Super Admin
const PARAMS: Array<{ key: string; label: string; hint?: string; type?: string }> = [
  { key: "platform_name", label: "Nombre de la plataforma" },
  { key: "support_email", label: "Correo de soporte" },
  { key: "default_trial_days", label: "Días de prueba por defecto", type: "number" },
  { key: "grace_period_days", label: "Días de gracia de morosidad", hint: "Tiempo antes de vencer la suscripción y suspender la cuenta", type: "number" },
  { key: "tax_rate", label: "Tasa de IVA del SaaS (%)", hint: "Aplicado a las facturas de suscripción", type: "number" },
  { key: "currency", label: "Moneda principal" },
  { key: "session_days", label: "Duración de la sesión (días)", type: "number" },
  { key: "saas_invoice_prefix", label: "Prefijo de facturas del SaaS" },
  { key: "ticket_prefix", label: "Prefijo de tickets de soporte" },
  { key: "maintenance_mode", label: "Modo mantenimiento (true/false)", hint: "Deshabilita el acceso al panel de los negocios" },
  { key: "allow_self_registration", label: "Permitir registro propio de negocios (true/false)" },
];

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const settings = await db.platformSetting.findMany({ orderBy: { key: "asc" } });
  const byKey = new Map(settings.map((s) => [s.key, s.value]));
  const keys = PARAMS.map((p) => p.key);
  const extra = settings.filter((s) => !keys.includes(s.key));

  return (
    <>
      <AdminPageHeader
        title="Configuración"
        description="Parámetros generales de la plataforma COMERZIA"
      />
      <AdminFlash msg={msg} err={err} />

      <AdminCard title="Parámetros de la plataforma">
        <form action={updatePlatformSettings} className="space-y-5">
          <input type="hidden" name="back" value="/admin/configuracion" />
          {keys.map((k) => {
            const param = PARAMS.find((p) => p.key === k)!;
            return (
              <div key={k} className="grid items-center gap-2 md:grid-cols-3">
                <div>
                  <label className={adminLabel} htmlFor={`s-${k}`}>{param.label}</label>
                  {param.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{param.hint}</p>}
                </div>
                <input
                  id={`s-${k}`}
                  name={`setting_${k}`}
                  type={param.type ?? "text"}
                  defaultValue={byKey.get(k) ?? ""}
                  className={adminField}
                />
                <code className="hidden rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground md:inline-block">
                  {k}
                </code>
                <input type="hidden" name="settingKeys" value={k} />
              </div>
            );
          })}

          {extra.length > 0 && (
            <>
              <p className="border-t pt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Otros parámetros
              </p>
              {extra.map((s) => (
                <div key={s.key} className="grid items-center gap-2 md:grid-cols-3">
                  <div>
                    <label className={adminLabel} htmlFor={`s-${s.key}`}>{s.key}</label>
                  </div>
                  <input id={`s-${s.key}`} name={`setting_${s.key}`} defaultValue={s.value} className={adminField} />
                  <input type="hidden" name="settingKeys" value={s.key} />
                </div>
              ))}
            </>
          )}

          <button className="h-9 rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
            Guardar configuración
          </button>
        </form>
      </AdminCard>
    </>
  );
}
