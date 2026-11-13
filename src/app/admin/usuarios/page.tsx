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
import { createUser, setUserStatus, resetUserPassword } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const ROLES = ["OWNER", "ADMIN", "CAJERO", "VENDEDOR", "INVENTARIO", "COMPRAS", "CONTADOR", "LOGISTICA", "AUDITOR"];

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const { msg, err } = await searchParams;

  const [members, orgs] = await Promise.all([
    db.organizationMember.findMany({
      include: {
        profile: { select: { id: true, email: true, fullName: true, status: true, lastLoginAt: true, isSuperAdmin: true } },
        organization: { select: { name: true } },
      },
      orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    }),
    db.organization.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const admins = await db.profile.findMany({ where: { isSuperAdmin: true } });

  return (
    <>
      <AdminPageHeader
        title="Usuarios"
        description="Usuarios globales de la plataforma: creación, suspensión y restablecimiento de contraseñas"
      />
      <AdminFlash msg={msg} err={err} />

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Crear usuario" description="Asigna la contraseña inicial; el usuario puede cambiarla después" className="lg:col-span-1">
          <form action={createUser} className="space-y-3">
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="u-name">Nombre completo *</label>
              <input id="u-name" name="fullName" required className={adminField} />
            </div>
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="u-email">Correo *</label>
              <input id="u-email" name="email" type="email" required className={adminField} />
            </div>
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="u-org">Organización</label>
              <select id="u-org" name="organizationId" className={adminField} defaultValue="">
                <option value="">— Sin organización (solo plataforma) —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="u-role">Rol</label>
              <select id="u-role" name="role" className={adminField} defaultValue="CAJERO">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={adminLabel} htmlFor="u-pass">Contraseña inicial</label>
              <input id="u-pass" name="password" placeholder="demo123" className={adminField} />
            </div>
            <button className="h-9 w-full rounded-md bg-violet-600 px-4 text-sm font-medium text-white shadow hover:bg-violet-500">
              Crear usuario
            </button>
          </form>
        </AdminCard>

        <div className="space-y-4 lg:col-span-2">
          <AdminCard title={`${admins.length} administradores de la plataforma`}>
            <AdminTable
              head={<><AdminTh>Nombre</AdminTh><AdminTh>Correo</AdminTh><AdminTh>Último acceso</AdminTh><AdminTh>Estado</AdminTh><AdminTh>Acciones</AdminTh></>}
              empty={admins.length === 0}
            >
              {admins.map((a) => (
                <tr key={a.id}>
                  <AdminTd className="font-medium">{a.fullName ?? "—"}</AdminTd>
                  <AdminTd>{a.email}</AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">{a.lastLoginAt ? formatDate(a.lastLoginAt) : "nunca"}</AdminTd>
                  <AdminTd><AdminBadge tone={a.status}>{a.status}</AdminBadge></AdminTd>
                  <AdminTd>
                    <div className="flex gap-1.5">
                      {a.status !== "activo" && (
                        <form action={setUserStatus}>
                          <input type="hidden" name="profileId" value={a.id} />
                          <input type="hidden" name="back" value="/admin/usuarios" />
                          <input type="hidden" name="status" value="activo" />
                          <button className="rounded-md border px-2 py-1 text-xs hover:bg-emerald-500/10">Activar</button>
                        </form>
                      )}
                      {a.status !== "suspendido" && (
                        <form action={setUserStatus}>
                          <input type="hidden" name="profileId" value={a.id} />
                          <input type="hidden" name="back" value="/admin/usuarios" />
                          <input type="hidden" name="status" value="suspendido" />
                          <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10">Suspender</button>
                        </form>
                      )}
                      <form action={resetUserPassword} className="flex items-center gap-1">
                        <input type="hidden" name="profileId" value={a.id} />
                        <input type="hidden" name="back" value="/admin/usuarios" />
                        <input name="password" placeholder="Nueva clave" className="h-7 w-24 rounded-md border bg-transparent px-1.5 text-xs" />
                        <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">Restablecer</button>
                      </form>
                    </div>
                  </AdminTd>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>

          <AdminCard title={`${members.length} membresías de organizaciones`}>
            <AdminTable
              head={
                <>
                  <AdminTh>Usuario</AdminTh>
                  <AdminTh>Organización</AdminTh>
                  <AdminTh>Rol</AdminTh>
                  <AdminTh>Último acceso</AdminTh>
                  <AdminTh>Estado</AdminTh>
                  <AdminTh>Acciones</AdminTh>
                </>
              }
              empty={members.length === 0}
            >
              {members.map((m) => (
                <tr key={m.id}>
                  <AdminTd>
                    <p className="font-medium">{m.profile.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{m.profile.email}</p>
                  </AdminTd>
                  <AdminTd>{m.organization.name}</AdminTd>
                  <AdminTd>
                    <span className="rounded-md border px-1.5 py-0.5 text-xs font-medium">{m.role}</span>
                  </AdminTd>
                  <AdminTd className="text-xs text-muted-foreground">{m.profile.lastLoginAt ? formatDate(m.profile.lastLoginAt) : "nunca"}</AdminTd>
                  <AdminTd>
                    <AdminBadge tone={m.active && m.profile.status === "activo" ? "activo" : "suspendido"}>
                      {m.active && m.profile.status === "activo" ? "activo" : "suspendido"}
                    </AdminBadge>
                  </AdminTd>
                  <AdminTd>
                    <div className="flex gap-1.5">
                      {m.active ? (
                        <form action={setUserStatus}>
                          <input type="hidden" name="profileId" value={m.profile.id} />
                          <input type="hidden" name="back" value="/admin/usuarios" />
                          <input type="hidden" name="status" value="suspendido" />
                          <button className="rounded-md border px-2 py-1 text-xs hover:bg-red-500/10">Suspender</button>
                        </form>
                      ) : (
                        <form action={setUserStatus}>
                          <input type="hidden" name="profileId" value={m.profile.id} />
                          <input type="hidden" name="back" value="/admin/usuarios" />
                          <input type="hidden" name="status" value="activo" />
                          <button className="rounded-md border px-2 py-1 text-xs hover:bg-emerald-500/10">Activar</button>
                        </form>
                      )}
                      <form action={resetUserPassword} className="flex items-center gap-1">
                        <input type="hidden" name="profileId" value={m.profile.id} />
                        <input type="hidden" name="back" value="/admin/usuarios" />
                        <input name="password" placeholder="Nueva clave" className="h-7 w-24 rounded-md border bg-transparent px-1.5 text-xs" />
                        <button className="rounded-md border px-2 py-1 text-xs hover:bg-accent">Restablecer</button>
                      </form>
                    </div>
                  </AdminTd>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>
        </div>
      </div>
    </>
  );
}
