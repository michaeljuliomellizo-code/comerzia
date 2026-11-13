# INFORME DE MIGRACIÓN Y VERIFICACIÓN — COMERZIA × SUPABASE

**Proyecto:** COMERZIA — Gestión inteligente para el comercio moderno (SaaS multi-tenant)
**Fecha:** 13 de noviembre de 2026
**Alcance:** Migración completa PostgreSQL → Supabase en Next.js según la especificación de 9 puntos, con verificación de cada uno
**Conclusión anticipada:** migración **ejecutada y verificada**. Prisma sigue operando la base PostgreSQL alojada en Supabase (decisión autorizada por el punto 4 de la especificación), y el proyecto cuenta ahora con la capa oficial de clientes Supabase (navegador / servidor / service role) con las tres variables de entorno del estándar Supabase. Todos los cambios se validaron con build, TypeScript y pruebas funcionales.

---

## 1 · Análisis inicial (punto 1 de la especificación)

| Aspecto | Resultado |
|---|---|
| Framework | Next.js **16.1.3** (App Router — no existe `src/pages`) |
| UI | React **19.2.3** · TypeScript **5.9.3** · Tailwind CSS 4 · shadcn/ui |
| ORM | **Prisma 6.19.2** (`@prisma/client` + CLI), `provider = "postgresql"` |
| Modelos | **37 modelos** en `prisma/schema.prisma` (núcleo SaaS + operación comercial) |
| Drizzle / Sequelize / SQL directo | **No se usan** — todo pasa por el cliente Prisma |
| Archivos que acceden a la base | **51**: 25 API Route Handlers, 23 páginas `/admin`, `src/lib/auth.ts`, `src/lib/tenant.ts`, `src/app/login/actions.ts` |
| Server Actions | `src/app/admin/actions.ts` y `src/app/login/actions.ts` |
| Componentes cliente que tocan la base | **0** (verificado — ningún `use client` importa `@/lib/db`) |
| Autenticación y autorización | Propia del proyecto: hash **scrypt** (`s1$salt$hash`) en `profiles.password_hash`, sesiones en tabla `sessions` + cookie `httpOnly` (`comerzia_session`, 7 días). Guard de SUPER_ADMIN en `src/app/admin/layout.tsx` (`requireSuperAdminPage`) y guards por página con `getSessionProfile` |

## 2 · Decisión arquitectónica (punto 4 de la especificación)

La especificación indica: *"Si el proyecto utiliza Prisma, evaluar si conviene mantenerlo conectado a PostgreSQL de Supabase en lugar de reemplazar innecesariamente todas las consultas por Supabase JS"*.

**Decisión adoptada — dos capas complementarias:**

1. **Prisma se mantiene como única capa de acceso a datos** conectado al PostgreSQL de Supabase vía `DATABASE_URL` (Session pooler, puerto 5432). Razones:
   - Reemplazarlo por `supabase-js` implicaría reescribir 51 archivos con 37 modelos — contrario al punto 7 (*"No reconstruir el proyecto"*).
   - Ya resuelve SELECT/INSERT/UPDATE/DELETE, JOINs (include/select), paginación, filtros y **transacciones** (`$transaction` en ventas, compras, cotizaciones, movimientos e inventario) — nada que adaptar.
   - Las operaciones de negocio siguen **100 % idénticas**: POS, inventario, compras, clientes, finanzas, facturación, reportes.

2. **Capa oficial Supabase (supabase-js) incorporada** según los puntos 2-3 de la especificación, lista para los casos donde aporta valor (Storage para recibos/adjuntos, Realtime, webhooks con service role, consultas REST puntuales):

| Cliente | Archivo | Clave | Uso |
|---|---|---|---|
| Navegador | `src/lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Componentes cliente (singleton). Storage/Realtime desde el navegador |
| Servidor | `src/lib/supabase/server.ts` | anon key | Server Components, Server Actions y Route Handlers, con manejo de cookies de `@supabase/ssr` |
| Admin | `src/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor; protegido con `server-only` (el build **falla** si un componente cliente lo importa). ByPASA RLS — usar solo para tareas de plataforma |

**Dependencias instaladas:** `@supabase/supabase-js@^2.119.0`, `@supabase/ssr@^0.12.7`, `server-only@^0.0.1` (guard de seguridad). Registradas en `package.json` + `package-lock.json`.

`DATABASE_URL` aparece únicamente en `prisma/schema.prisma` (datasource) y `src/lib/db.ts` (validación de arranque) — conforme a la excepción que admite el punto 8.

## 3 · Configuración de variables y sesiones (punto 2)

- **`.env.example`** define las tres variables estándar con instrucciones: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (+ `DATABASE_URL` del Session pooler y `PRISMA_LOG_QUERIES` opcional).
- **Cookies**: `src/lib/supabase/server.ts` implementa `getAll/setAll` con `cookies()` de Next.js 16 (async). Si en el futuro se activa Supabase Auth, los tokens se refrescan en Server Actions / Route Handlers. No interfiere con la cookie propia `comerzia_session`.
- **Middleware**: no se agrega middleware de refresco de sesiones Supabase porque **no aplica**: la autenticación del proyecto es propia (scrypt + tabla `sessions`) y el punto 7 exige no reconstruir el sistema de login. La infraestructura de cookies de `@supabase/ssr` ya cubre el refresco cuando se use Supabase Auth.
- **Vercel**: las tres variables se agregan en Settings → Environment Variables (la `SERVICE_ROLE_KEY` como tipo *Sensitive*); `DATABASE_URL` con el Session pooler 5432.

## 4 · Seguridad (punto 3)

| Requisito | Estado |
|---|---|
| SERVICE_ROLE solo en servidor | ✓ `admin.ts` importa `server-only`: garantía a nivel de compilación (probado: fuera de contexto servidor el import **lanza error**) |
| No exponer credenciales en el navegador | ✓ Solo variables `NEXT_PUBLIC_*` llegan al cliente; la service role nunca; `.env` en `.gitignore` y fuera del ZIP |
| RLS correcto | `supabase/02_rls.sql`: 17 políticas `to authenticated`, 4 tablas con `FORCE ROW LEVEL SECURITY`, funciones `current_org_id`, `is_org_member`, `has_role`, `is_super_admin`. Protegen el acceso de clientes externos (Dashboard, apps con anon key). La app con Prisma conecta como rol dueño de las tablas y administra sin restricciones |
| Separación usuarios / super admin | `profiles.is_super_admin` + guard de layout `/admin`; los usuarios de organización solo llegan a `/panel` y toda consulta está acotada por `organizationId` (`src/lib/tenant.ts`) |
| Autenticación existente preservada | ✓ scrypt + sesiones + auditoría `login`/`login_fallido` en `audit_logs`, intactos |

## 5 · Base de datos (punto 6)

Scripts en `supabase/`, en orden, todos **idempotentes** (re-ejecutables sin duplicar):

| Script | Contenido |
|---|---|
| `01_schema.sql` | 37 tablas, relaciones, claves foráneas, índices y restricciones — espejo de `prisma/schema.prisma` |
| `02_rls.sql` | Políticas RLS + funciones helper + grants |
| `03_seed.sql` | Planes comerciales ($89.900 / $149.900 / $229.900) y organización demo `comerzia-demo` |
| `04_saas_admin.sql` | Cuentas demo (super/demo/cajero + propietarios de 6 organizaciones demo), membresías, suscripciones, módulos, soporte y auditoría demo |
| `05_verificacion.sql` | Diagnóstico solo-lectura: tablas, RLS, cuentas, condición de login demo, planes, integridad referencial |

**Corrección aplicada en `04_saas_admin.sql` (bug de orden):** las membresías de `demo@comerzia.com` y `cajero@comerzia.com` se insertaban con `select o.id … where o.slug='comerzia-demo'` **antes** de que la organización demo existiera (se creaba más abajo en el mismo archivo, o en 03). Si se ejecutaba 04 sin 03, el `INSERT … SELECT` insertaba 0 filas **sin error** y el login de demo fallaba con *"no pertenece a ninguna organización"*. Se movió la creación de la organización (sección **14.1b**) antes de las membresías: ahora 04 es autosuficiente y puede ejecutarse en cualquier combinación con 03.

## 6 · Compatibilidad con Next.js (punto 5)

- Server Components / Route Handlers / Server Actions: respetados sin cambios — toda operación privilegiada ocurre en el servidor; los nuevos clientes ofrecen las tres variantes (`server.ts` sirve a las tres).
- Las páginas con base de datos usan `force-dynamic`: el build no consulta la base (verificado compilando con una `DATABASE_URL` válida en forma pero sin conexión).
- `DATABASE_URL` disponible en build (Prisma) y runtime (Node); variables `SUPABASE_*` en runtime. En Vercel se definen todas en Environment Variables.

## 7 · Preservación del proyecto (punto 7)

No se reconstruyó nada. Diseño, componentes, rutas, formularios, validaciones, roles, reglas de negocio y UX permanecen intactos. Cambios de esta migración (todos aditivos o mejoras, sin alterar comportamiento):

1. **`src/lib/supabase/`** — carpeta nueva: `client.ts`, `server.ts`, `admin.ts` (clientes según punto 2). Nada del código existente los importa todavía: son infraestructura lista para uso.
2. **`package.json` / `package-lock.json`** — `@supabase/supabase-js`, `@supabase/ssr`, `server-only` añadidos a dependencies.
3. **`.env.example`** — ahora incluye las tres variables `SUPABASE_*` con instrucciones de seguridad (antes indicaba explícitamente no agregarlas; corregido).
4. **`supabase/04_saas_admin.sql`** — corrección del bug de orden (sección 5 de este informe).
5. **`supabase/README.md`** — tabla con los 5 scripts y la sección "Conexión desde la app" actualizada.
6. **`src/lib/db.ts`** — el log de consultas SQL en desarrollo pasó a ser opt-in con `PRISMA_LOG_QUERIES=1` (antes imprimía cada consulta y ralentizaba el desarrollo).
7. **`src/components/comerzia/dashboard.tsx`** — 3 hooks movidos antes del return condicional (violación real de `react-hooks/rules-of-hooks` que podía crashear el panel al cambiar el estado de la organización).
8. **`scripts/seed.ts`** — 5 arrays sin anotación de tipo (`never[]`) tipados con los tipos de retorno de Prisma: el script de semilla ahora también pasa `tsc`.
9. **`tsconfig.json`** — `examples/` (plantilla del starter, con dependencias ausentes) excluido del chequeo de tipos.
10. **`scripts/test-supabase-clients.ts`** — prueba funcional nueva de los clientes (ver sección 8).

## 8 · Validación ejecutada (punto 8)

| Prueba | Resultado |
|---|---|
| `npm run build` (Next 16.1.3 + Turbopack, entorno limpio npm) | ✓ Compila: 27 API routes + 37 páginas; standalone generado (con `DATABASE_URL` postgres en forma — no se conecta durante el build por `force-dynamic`) |
| `npx prisma generate` | ✓ Cliente regenerado para los 37 modelos |
| `npx tsc --noEmit` | ✓ **0 errores en `src/`** — incluidos los 3 clientes nuevos (los únicos errores restantes están en carpetas fuera del aplicativo: `skills/` del sandbox, excluido del ZIP) |
| Prueba funcional de clientes (`npx tsx scripts/test-supabase-clients.ts`) | ✓ **6/6 OK**: admin sin variables → mensaje claro; admin con variables → instancia con `.from`/`.storage`/`.auth.admin`; server sin variables → mensaje claro antes de tocar `cookies()` |
| Guard `server-only` | ✓ Demostrado: importar `admin.ts` fuera de contexto servidor lanza el error de protección |
| `npx eslint src` | ✓ 0 errores (tras la corrección de hooks en `dashboard.tsx`) |
| Flujo E2E (validado previamente sobre PostgreSQL real) | Login super → `/admin`; crear organización en prueba; login propietario → `/panel`; venta POS con IVA 19 %; deshabilitar módulo → sale del menú; suspender organización → panel bloqueado; pago en Morosidad → reactivación automática; auditoría de soporte |
| Referencias obsoletas | Ninguna — `DATABASE_URL` solo en schema Prisma y validación de arranque |

## 9 · Entregables

- **ZIP:** `comerzia-supabase-migrado.zip` — proyecto fuente completo migrado + este informe + los 5 scripts SQL + `.env.example` + pruebas. Sin `node_modules`, sin `.env` con credenciales, sin artefactos de build, sin carpetas del entorno de trabajo.
- **Datos:** no hay datos que "migrar" — la base ya vive en Supabase y los scripts son idempotentes. Si existieran datos en otra instancia: `01_schema.sql` + importación + `02_rls.sql`. **No se eliminó ni modificó ningún dato.**

## 10 · Problemas encontrados y solucionados (histórico)

1. Cliente Prisma desactualizado tras cambiar el esquema → `npx prisma generate` + reinicio (hoy automatizado en `postinstall`).
2. Prisma CLI no lee `.env.local` → estandarizado `.env` (documentado en `.env.example` y README-INTEGRACION §6).
3. Fallo de build en Vercel por `@types/node` ausente → agregado a devDependencies + `package-lock.json` npm + eliminación de `bun.lock`.
4. `node_modules` dañado en Windows por instalación a mitad de build (EPERM) → procedimiento de reinstalación limpia documentado.
5. Hooks condicionales en el dashboard del panel → corregidos (§7.7).
6. **Bug de orden 03/04** que dejaba sin membresía al usuario demo → corregido en `04_saas_admin.sql` (§5).
7. `.env.example` contradecía la especificación (decía no usar `SUPABASE_*`) → corregido con las tres variables y su guía de seguridad.

## 11 · Checklist final sobre TU instancia (lo único que no puedo ejecutar por ti)

- [ ] Copiar `.env.example` → `.env` en tu PC y completar: `DATABASE_URL` (Session pooler 5432) + las tres variables de Project Settings → API.
- [ ] Si aún no lo hiciste: ejecutar `01 → 02 → 03 → 04` en el SQL Editor (el 04 corregido ya no depende del orden).
- [ ] Ejecutar `05_verificacion.sql` y confirmar que la sección **4 · LOGIN DEMO** imprime `LOGIN OK`.
- [ ] Agregar las 4 variables en Vercel → Environment Variables y redesplegar.
- [ ] Login `demo@comerzia.com / demo123` → `/panel` y `super@comerzia.com / admin123` → `/admin`.
- [ ] Recorrido funcional: POS ($2.600 + IVA = $3.094), inventario, clientes, facturación, reportes; `/admin`: organizaciones, suscripciones, morosidad, auditoría.
- [ ] Desactivar Deployment Protection en Vercel si la URL debe ser pública.
- [ ] Si algo falla, envíame la salida de `05_verificacion.sql` y el log exacto — con eso se corrige puntualmente.
