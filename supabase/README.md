# COMERZIA en Supabase

Scripts SQL para migrar el modelo de datos de COMERZIA a PostgreSQL/Supabase con
arquitectura **SaaS multi-tenant** y seguridad por filas (**RLS**).

Los datos operativos de la demo (SQLite) y estos scripts comparten el mismo
modelo de negocio; Supabase es la base de datos de producción del SaaS.

## Orden de ejecución (SQL Editor de Supabase)

| # | Script | Qué hace |
|---|--------|----------|
| 1 | `01_schema.sql` | Crea ~45 tablas multi-tenant, índices y triggers (`organization_id` en todas las tablas operativas) |
| 2 | `02_rls.sql` | Funciones de seguridad + Row Level Security en todas las tablas + protección del rol OWNER |
| 3 | `03_seed.sql` | Planes **Básico $89.900 / Profesional $149.900 / Premium $229.900**, matriz de funcionalidades y organización demo |
| 4 | `04_saas_admin.sql` | Super admin, cuentas demo (`demo@comerzia.com / demo123`), organizaciones de muestra, suscripciones, módulos, soporte y datos operativos |
| 5 | `05_verificacion.sql` | Diagnóstico de solo lectura: tablas, RLS, cuentas, login demo y conteos (ejecutar al final; seguro para repetir) |

`local_stub_auth.sql` es una alternativa mínima para probar en PostgreSQL local
sin Supabase Auth (crea `auth.uid()` simulado).

Copia y pega cada archivo completo en el **SQL Editor** de tu proyecto de
Supabase y ejecútalo en ese orden. Todos los scripts son re-ejecutables
(`if not exists` / `on conflict`).

## Arquitectura multi-tenant

```
organizations (cada negocio)
    └── subscription (plan contratado)
            └── plan
                  ├── plan_features   → módulos y funcionalidades habilitadas
                  └── límites          → sucursales, bodegas, usuarios, productos, API
    └── organization_members (usuarios con rol RBAC + permisos granulares)
```

Todas las tablas operativas (`sales`, `products`, `purchases`, `cash_sessions`, …)
llevan `organization_id` y su acceso se filtra automáticamente con:

- `current_org_id()` — organización del usuario autenticado
- `is_org_member(org)` — pertenencia activa
- `has_role(org, roles)` — verificación de roles (OWNER, ADMIN, CAJERO, …)
- `is_super_admin()` — administrador de la plataforma

## Reglas de seguridad implementadas

1. **Aislamiento por organización**: ningún negocio puede leer ni modificar la
   información de otro (RLS en todas las tablas).
2. **El rol OWNER no puede autoasignarse**: un trigger (`guard_owner_role`)
   bloquea crear o cambiar un OWNER desde el panel; solo el OWNER actual o el
   Super Admin pueden hacerlo.
3. **Super Admin** (`profiles.is_super_admin`): gestiona organizaciones,
   suscripciones, planes y límites de la plataforma.
4. **Numeración por organización**: folios únicos con
   `unique (organization_id, folio)` en ventas, compras y cotizaciones.
5. **No se eliminan documentos financieros**: las ventas/cotizaciones usan
   estados (`cancelada`, `rechazada`) en lugar de `DELETE`.

## Cómo dar acceso a un usuario

1. Crea el usuario en **Authentication → Users** (Supabase Auth).
2. Inserta su perfil y su membresía en el SQL Editor:

```sql
-- perfil (id = uuid del usuario en auth.users)
insert into public.profiles (id, email, full_name)
values ('<auth-uuid>', 'dueno@micomercio.com', 'Ricardo Gómez');

-- membresía como propietario (con service_role o desde el editor)
insert into public.organization_members (organization_id, user_id, role, can_view_costs)
select o.id, '<auth-uuid>', 'OWNER', true
from public.organizations o where o.slug = 'comerzia-demo';
```

## Conexión desde la app (Next.js)

Ya está instalada y configurada en el proyecto:

- **Clientes en `src/lib/supabase/`**: `client.ts` (navegador, clave anon),
  `server.ts` (Server Components / Server Actions / Route Handlers con manejo
  de cookies) y `admin.ts` (service_role, protegido con `server-only` — solo
  puede importarse en el servidor).
- **Base de datos (Prisma)**: la app accede a PostgreSQL de Supabase con
  Prisma vía `DATABASE_URL` (Session pooler, puerto 5432). Las variables
  `SUPABASE_*` no las lee Prisma; las usan únicamente los clientes de
  `src/lib/supabase/` para Storage, Realtime o APIs REST.

```env
# .env (Prisma y clientes; Next.js también lo lee)
DATABASE_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role>  # solo backend: cobros, webhooks, tareas
```

- **Frontend y Server Actions**: cliente con la sesión del usuario → RLS aplica.
- **Operaciones del sistema** (suscripciones, auditoría automática): cliente
  `service_role` exclusivamente en el backend.

## Uso de límites del plan (entitlements)

```sql
-- ¿Puede la organización usar tienda virtual (Premium)?
select enabled
from public.plan_features pf
join public.subscriptions s on s.plan_id = pf.plan_id
join public.organizations o on o.id = s.organization_id
where o.slug = 'comerzia-demo'
  and pf.module = 'ecommerce' and pf.feature = 'storefront';

-- ¿Cuántos usuarios tiene contratados?
select p.max_users
from public.subscriptions s
join public.plans p on p.id = s.plan_id
join public.organizations o on o.id = s.organization_id
where o.slug = 'comerzia-demo';
```

Los precios y límites se editan desde el panel del Super Admin o actualizando
`public.plans` — **sin cambiar código**.
