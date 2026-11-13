# COMERZIA — Multi-tenant + Login + Panel administrativo del SaaS

Entrega de la solicitud: **implementación multi-tenant** (usando `organization_id` y la tabla
`organizations` ya existentes), **login de la aplicación** y el **panel administrativo del SaaS**
para el perfil `SUPER_ADMIN`, con los 20 módulos solicitados.

Solo se incluyen los **archivos nuevos o modificados** respecto a la entrega anterior. Copia cada
archivo a la misma ruta dentro de tu proyecto COMERZIA y ejecuta los **queries** de `supabase/`.

---

## 1 · Contenido de la entrega

### Queries (Supabase — SQL Editor, en este orden)

| Archivo | Qué hace |
|---|---|
| `supabase/02_rls.sql` | **Corregido**. La versión anterior fallaba al aplicar políticas `organization_id` a tablas de líneas (`quotation_items`, `order_items`, `purchase_items`, `stock_count_items`, `shipment_items`, `carts`). Ahora esas tablas heredan la organización por JOIN con su tabla padre. También se ajustó el trigger `guard_owner_role` para permitir que el backend (rol dueño) asigne OWNER al crear organizaciones. Es idempotente: se puede re-ejecutar. |
| `supabase/04_saas_admin.sql` | **Nuevo**. Todo lo necesario para login + panel SaaS: `password_hash/status/last_login_at` en `profiles`, tabla `sessions`, facturación SaaS (`saas_invoices`), pagos (`saas_payments`), renovaciones, cancelaciones, cupones de plataforma, módulos (`platform_modules` + `organization_modules`), límites temporales (`organization_limit_overrides`), tickets de soporte, notificaciones, integraciones con registro de errores, configuración global y por comercio, RLS de las tablas nuevas y **datos iniciales**: usuario super admin, planes con los precios oficiales (Básico $89.900 · Profesional $149.900 · Premium $229.900) y organizaciones de demostración con estados variados. |
| `supabase/local_stub_auth.sql` | Opcional, **solo para PostgreSQL local** (emula `auth.uid()` y los roles de Supabase). No ejecutar en Supabase. |

### Aplicación (Next.js)

| Archivo | Qué hace |
|---|---|
| `prisma/schema.prisma` | Reescrito para **PostgreSQL/Supabase** (antes SQLite). Espejo exacto de las tablas SQL con `organization_id` en todo el modelo operativo. |
| `.env.example` | Ejemplo de configuración: cadena de conexión a Supabase o Postgres local. |
| `src/lib/auth.ts` | **Login propio de la app**: contraseñas con scrypt (`s1$salt$hash`, mismo formato que la semilla SQL), sesiones en tabla `sessions` + cookie httpOnly `comerzia_session` (7 días). |
| `src/lib/tenant.ts` | **Núcleo multi-tenant**: `requireOrgApi()` / `requireSuperAdminApi()` para rutas API, `requireOrgPage()` / `requireSuperAdminPage()` para páginas, módulos habilitados por organización y `logAudit()`. |
| `src/lib/db.ts` | Log de Prisma solo en desarrollo. |
| `src/app/login/*` | Página de inicio de sesión con marca COMERZIA + server actions (`loginAction`, `logoutAction`). Redirige según perfil: SUPER_ADMIN → `/admin`, usuario de negocio → `/panel`. Bloquea cuentas suspendidas y organizaciones suspendidas por morosidad. |
| `src/app/api/auth/me/route.ts` | Contexto de sesión para el panel: usuario, organización, plan, suscripción y **módulos habilitados**. |
| `src/app/api/auth/logout/route.ts` | Cierre de sesión (POST) con auditoría. |
| `src/app/panel/page.tsx` | Ruta `/panel`: protege el panel del negocio y muestra pantalla de bloqueo si la organización está suspendida. |
| `src/app/page.tsx` | Landing pública; los botones llevan a `/panel`. |
| `src/components/comerzia/landing.tsx` | CTAs de la landing convertidos en enlaces a `/panel`. |
| `src/components/comerzia/dashboard.tsx` | Panel del negocio con sesión: nombre de la organización, plan real, banner de prueba, **filtrado de módulos del menú según lo habilitado por la plataforma**, botón de logout y pantalla de bloqueo si la cuenta se suspende. |
| `src/components/comerzia/types.ts` | Tipos actualizados (`Settings.taxId`, `Product.wholesalePrice`). |
| `src/app/admin/*` | **Panel administrativo del SaaS completo** (ver sección 2). |
| `src/components/admin/nav.tsx` | Navegación lateral del panel SaaS (20 módulos). |
| `src/components/admin/ui.tsx` | Componentes de interfaz compartidos del panel SaaS. |
| `src/app/api/**/route.ts` | **24 rutas API del negocio reescritas con aislamiento multi-tenant**: toda consulta, creación, actualización y borrado queda filtrada por `organizationId` de la sesión (productos, clientes, ventas, compras, proveedores, caja, cotizaciones, cupones, finanzas, métricas, ajustes, usuarios, facturación electrónica). |
| `scripts/seed.ts` | Semilla reescrita para el esquema multi-tenant: capa SaaS (planes, módulos, organizaciones demo, facturas, tickets) + datos operativos del comercio demo (24 productos, 12 clientes, ~140 ventas, compras, cotizaciones, caja, finanzas). Idempotente. |

> `package.json` **no cambia**: no se agregaron dependencias (la autenticación usa `node:crypto`).

---

## 2 · Panel administrativo del SaaS (`/admin`) — módulos incluidos

Perfil `SUPER_ADMIN` (protegido en layout; si un usuario de negocio intenta entrar, vuelve a `/panel`).

| Módulo | Ruta | Funcionalidad implementada |
|---|---|---|
| Dashboard SaaS | `/admin` | Organizaciones activas, MRR/ARR, pruebas, suspendidas, por cobrar, morosidad, distribución por plan, próximas renovaciones, últimas organizaciones. |
| Analítica | `/admin/analitica` | MRR, ARR, churn, ARPU, retención, recaudo mensual y crecimiento (nuevas organizaciones). |
| Organizaciones | `/admin/organizaciones` | **Crear organizaciones manualmente** (con propietario y contraseña inicial, plan y días de prueba), activar, **suspender**, cambiar plan, asignar pruebas, filtros y búsqueda. |
| Usuarios | `/admin/usuarios` | Usuarios globales y membresías: crear (con organización y rol), activar/suspender (cierra sesiones), restablecer contraseña. |
| Soporte | `/admin/soporte` | Tickets con estados y prioridades, creación, conversación con **notas internas**, respuesta y gestión de estados. |
| Vista de soporte | `/admin/soporte-organizacion/[orgId]` | **Acceso autorizado y auditado** a los datos de una organización: consumo, límites, usuarios, últimas ventas, tickets abiertos. Cada visita queda en `audit_logs` (`support_view_access`). |
| Suscripciones | `/admin/suscripciones` | Planes contratados: renovar 30 días (con factura), cancelar (inmediata o fin de período), renovación automática, asignar prueba. |
| Planes | `/admin/planes` | **Configuración de precios** (Básico 89.900, Profesional 149.900, Premium 229.900) y límites de cada plan; activar/desactivar. |
| Módulos | `/admin/modulos` | **Activación/desactivación** a nivel global y por organización (el menú del panel del negocio obedece). |
| Límites | `/admin/limites` | Consumo vs límite del plan (usuarios, productos, sucursales) y **ampliaciones temporales** con vencimiento y motivo. |
| Pruebas gratuitas | `/admin/pruebas` | Pruebas vigentes con días restantes, extensión, días por defecto. |
| Renovaciones | `/admin/renovaciones` | Próximas a vencer, renovación manual e historial. |
| Cancelaciones | `/admin/cancelaciones` | Programadas/efectivas, motivo, reversión. |
| Morosidad | `/admin/morosidad` | Facturas vencidas, **suspensión y recuperación**: procesamiento automático según días de gracia, registro de pago (reactiva la cuenta), reactivación manual. |
| Cupones | `/admin/cupones` | Descuentos comerciales de la plataforma (porcentaje o monto) con vigencia y usos. |
| Facturación SaaS | `/admin/facturacion` | Generación de facturas del período (con IVA 19%), anulaciones, registro de pagos rápidos. |
| Pagos | `/admin/pagos` | Registro, confirmación y rechazo de pagos de suscripciones. |
| Notificaciones | `/admin/notificaciones` | Comunicaciones a todas las organizaciones o a una, por app o correo. |
| Integraciones | `/admin/integraciones` | Servicios externos: activación, configuración JSON y **consulta de errores** con limpieza. |
| Auditoría | `/admin/auditoria` | Bitácora global: logins, cambios, suspensiones, accesos de soporte, con filtros. |
| Configuración | `/admin/configuracion` | Parámetros generales (nombre, soporte, días de prueba, gracia de morosidad, IVA, moneda, sesión, mantenimiento, registro propio…). |

## 3 · Credenciales de demostración (creadas por el SQL 04 y la semilla)

| Perfil | Correo | Contraseña | Acceso |
|---|---|---|---|
| **SUPER_ADMIN** | `super@comerzia.com` | `admin123` | `/admin` |
| Propietario negocio demo | `demo@comerzia.com` | `demo123` | `/panel` |
| Cajero negocio demo | `cajero@comerzia.com` | `cajero123` | `/panel` |
| Propietarios otras organizaciones demo | `elfaro@ · ferretera@ · papeleria@ · jugueteria@ · hogarjardin@comerzia.com` | `demo123` | `/panel` |

## 4 · Instalación

### A. Supabase (producción)

1. En el **SQL Editor** de Supabase ejecuta en orden: `02_rls.sql` (corregido) → `04_saas_admin.sql`.
   *(Si ya ejecutaste 01 y 03 previamente, no hace falta repetirlos; todo es idempotente.)*
2. Copia los archivos de la entrega a tu proyecto (mismas rutas).
3. Configura `.env` con la cadena de conexión de Supabase (ver `.env.example`).
4. `npm install && npx prisma generate && npm run build && npm start`.

> **Nota sobre RLS**: las tablas se crean con `FORCE ROW LEVEL SECURITY`, que también bloquea al
> rol dueño que usa Prisma. El script `04_saas_admin.sql` retira el `FORCE` (conserva RLS y las
> políticas para los clientes autenticados vía PostgREST). El aislamiento por organización se
> aplica de todos modos en cada consulta del backend (`src/lib/tenant.ts`).

### B. PostgreSQL local (desarrollo)

```bash
createdb comerzia
psql -d comerzia -f supabase/local_stub_auth.sql
psql -d comerzia -f supabase/01_schema.sql
psql -d comerzia -f supabase/02_rls.sql
psql -d comerzia -f supabase/03_seed.sql
psql -d comerzia -f supabase/04_saas_admin.sql
npm install && npx prisma generate
npm run dev        # http://localhost:3000 → /login
```

### C. Base vacía con Prisma (sin SQL previo)

```bash
npm install
npm run db:push    # crea todas las tablas
npm run db:seed    # capa SaaS + datos de demostración
npm run dev
```

## 5 · Flujo verificado (E2E)

- Login super admin → `/admin` con estadísticas reales (MRR $709.500 con la semilla demo).
- Crear organización con prueba de 10 días → aparece en el panel con propietario activo.
- Login del propietario → `/panel` operativo; venta en POS con folio por organización e IVA 19 %.
- Deshabilitar un módulo a la organización → desaparece del menú del negocio.
- Suspender organización → panel bloqueado y login rechazado con mensaje.
- Registro de pago en Morosidad → la cuenta se reactiva automáticamente.
- Vista de soporte con acceso registrado en Auditoría; respuestas de tickets y acciones auditadas.

## 6 · Solución de problemas

**Error: `Cannot read properties of undefined (reading 'findUnique')` al iniciar sesión**

El cliente de Prisma quedó generado con el esquema antiguo (SQLite) y no incluye los modelos
multi-tenant (`Profile`, `Organization`, `Session`, etc.), por lo que `db.profile` es `undefined`.
Regenera el cliente y reinicia:

```powershell
npx prisma generate        # o: npm run db:generate
# detén el servidor (Ctrl+C) y vuelve a arrancar:  npm run dev
```

**Error: `the URL must start with the protocol postgresql://`**

La `DATABASE_URL` todavía apunta a la antigua base SQLite (`file:…`). El esquema actual es
PostgreSQL/Supabase: reemplaza la cadena en `.env` (ver `.env.example`) y borra o actualiza
también `.env.local` si existe.

**`npm run db:push` o `npm run db:seed` fallan con "Environment variable not found: DATABASE_URL"**

Los comandos de Prisma y la semilla solo leen `.env` (no `.env.local`, que únicamente usa
Next.js). Copia `.env.example` como `.env` y coloca ahí tu cadena de conexión.

**La base no tiene tablas (P2021 / "relation … does not exist")**

Ejecuta en el SQL Editor de Supabase: `02_rls.sql` → `04_saas_admin.sql` (o, sobre un Postgres
vacío, `npm run db:push` + `npm run db:seed`, que crean tablas y datos demo sin SQL previo).

## 7 · Despliegue en Vercel

**Requisitos ya incluidos en el proyecto**

- `@types/node` en `devDependencies` (sin él, `next build` falla con
  *"Please install @types/node"* en Vercel).
- Script `postinstall: prisma generate` (Vercel no ejecuta Prisma por su cuenta; sin esto
  el build falla con *"@prisma/client did not initialize yet"*).
- `package-lock.json` en la raíz: Vercel lo detecta e instala con **npm**. El `bun.lock`
  original se eliminó para evitar ambigüedad de gestor; si tu copia local todavía lo tiene,
  bórralo.

**Pasos**

1. Sube el proyecto a GitHub (el `.gitignore` ya excluye `.env*` — tus credenciales no se
   suben) o usa `vercel` CLI desde la carpeta del proyecto.
2. En Vercel: **Project → Settings → Environment Variables** y agrega:

   ```
   DATABASE_URL = postgresql://postgres.REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
   ```

   Usa la **Session pooler (puerto 5432)** de Supabase → botón *Connect*. Las funciones de
   Vercel solo tienen IPv4, por lo que la conexión directa `db.xxx.supabase.co` NO funciona;
   el pooler es obligatorio. Para tráfico alto concurrente puedes usar el *Transaction
   pooler* (puerto 6543) añadiendo `?pgbouncer=true&connection_limit=1`.
3. Deploy. En cada deploy Vercel ejecuta `npm install` (dispara `prisma generate`) y
   `next build`. Las páginas con base de datos son todas `force-dynamic`, así que el build
   no necesita conectarse a la base.
4. Verifica el dominio: `/` (landing), `/login` con `super@comerzia.com` y `demo@comerzia.com`.

**Notas de rendimiento en Vercel**

- Vercel y Supabase quedan en la nube: elige en Vercel la **misma región** del proyecto de
  Supabase (Settings → Functions → Function Region) para minimizar la latencia de cada
  consulta.
- Con el plan gratuito de Supabase el proyecto se pausa tras una semana sin actividad; la
  primera petición tras la pausa tarda unos segundos en responder.
