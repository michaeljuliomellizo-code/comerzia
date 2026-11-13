-- ════════════════════════════════════════════════════════════════════════════
-- COMERZIA — 04 · Login + Panel administrativo del SaaS (Super Admin)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de 01, 02 y 03.
--
-- Añade sobre el esquema multi-tenant existente:
--   · Autenticación propia de la app (password en profiles + sesiones)
--   · Facturación de suscripciones (saas_invoices) y pagos (saas_payments)
--   · Renovaciones, cancelaciones y morosidad
--   · Catálogo de módulos de la plataforma + activación por organización
--   · Límites temporales por organización (ampliaciones)
--   · Cupones comerciales de la plataforma, tickets de soporte
--   · Notificaciones, integraciones con registro de errores
--   · Configuración global de la plataforma y configuración por comercio
--   · Usuarios y organizaciones de demostración para poblar el panel
--
-- Todo es idempotente: se puede ejecutar varias veces sin duplicar datos.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════════════════════
-- 0 · COLUMNAS DE COMPATIBILIDAD PARA LA APLICACIÓN
-- El panel usa categoría/marca como texto y dirección del cliente.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.products  add column if not exists category text;
alter table public.products  add column if not exists brand     text;
alter table public.customers add column if not exists address   text;

-- Marcas de actualización que el panel del negocio mantiene (Prisma @updatedAt)
alter table public.quotations add column if not exists updated_at timestamptz not null default now();
alter table public.purchases  add column if not exists updated_at timestamptz not null default now();

-- El panel del negocio (Prisma) se conecta con el rol dueño de las tablas.
-- "force row level security" bloquea también al dueño cuando no hay política
-- para su rol; se retira el FORCE conservando RLS + políticas para los clientes
-- autenticados vía PostgREST. El aislamiento por organización sigue aplicando
-- en cada consulta de la aplicación (organization_id en todas las tablas).
do $$
declare t text;
begin
  foreach t in array array[
    'organizations','subscriptions','organization_members','plans','plan_features','profiles',
    'branches','warehouses','cash_registers',
    'categories','brands','suppliers','products','product_variants',
    'stock_balances','inventory_movements','stock_counts','stock_count_items',
    'customers','customer_addresses','sales','sale_items','sale_payments',
    'cash_sessions','cash_movements',
    'quotations','quotation_items','orders','order_items',
    'purchases','purchase_items','supplier_payments',
    'invoices','credit_notes',
    'finance_transactions','accounts_receivable','accounts_payable','expenses',
    'coupons','promotions','campaigns','loyalty_points',
    'shipments','shipment_items',
    'employees','commissions',
    'audit_logs','integrations','webhooks','api_keys',
    'storefronts','carts','ecommerce_orders'
  ]
  loop
    execute format('alter table public.%I no force row level security', t);
  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 · AUTENTICACIÓN DE LA APLICACIÓN (LOGIN)
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists password_hash text;
alter table public.profiles
  add column if not exists status text not null default 'activo'
    check (status in ('activo','suspendido'));
alter table public.profiles
  add column if not exists last_login_at timestamptz;

create table if not exists public.sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_sessions_user on public.sessions (user_id, expires_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · ORGANIZACIONES: CAMPOS EXTRA DE GESTIÓN SaaS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.organizations add column if not exists suspended_at timestamptz;
alter table public.organizations add column if not exists notes text;

-- El nombre de quien abre la caja se guarda en texto (el uuid va en opened_by)
alter table public.cash_sessions add column if not exists opened_by_name text;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 · CONFIGURACIÓN DEL COMERCIO (por organización)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  store_name      text not null default 'Mi Comercio',
  tax_id          text,
  address         text,
  currency        text not null default 'COP',
  tax_rate        numeric(5,2) not null default 19,
  low_stock_warn  boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 4 · LÍMITES TEMPORALES POR ORGANIZACIÓN (ampliaciones del Super Admin)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.organization_limit_overrides (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  max_users       int,
  max_products    int,
  max_branches    int,
  storage_gb      int,
  expires_at      timestamptz,
  note            text,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 5 · MÓDULOS DE LA PLATAFORMA (activación / desactivación)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_modules (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.organization_modules (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_id       uuid not null references public.platform_modules(id) on delete cascade,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (organization_id, module_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6 · FACTURACIÓN SaaS Y PAGOS DE SUSCRIPCIONES
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.saas_invoices (
  id              uuid primary key default gen_random_uuid(),
  number          text unique not null,                       -- S-2026-00001
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  amount          numeric(14,2) not null default 0,           -- base sin IVA
  tax_rate        numeric(5,2) not null default 19,           -- IVA %
  tax_amount      numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  status          text not null default 'pendiente'
                    check (status in ('pendiente','pagada','vencida','anulada')),
  issued_at       timestamptz not null default now(),
  due_at          timestamptz not null,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_saas_invoices_org   on public.saas_invoices (organization_id, issued_at desc);
create index if not exists idx_saas_invoices_status on public.saas_invoices (status, due_at);

create table if not exists public.saas_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id      uuid references public.saas_invoices(id) on delete set null,
  amount          numeric(14,2) not null default 0,
  method          text not null default 'transferencia'
                    check (method in ('efectivo','transferencia','tarjeta','pse','otro')),
  reference       text,
  status          text not null default 'confirmado'
                    check (status in ('pendiente','confirmado','rechazado')),
  notes           text,
  received_at     timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index if not exists idx_saas_payments_org on public.saas_payments (organization_id, received_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 7 · RENOVACIONES Y CANCELACIONES
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.saas_renewals (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  subscription_id     uuid references public.subscriptions(id) on delete set null,
  previous_period_end timestamptz,
  new_period_end      timestamptz not null,
  invoice_number      text,
  created_at          timestamptz not null default now()
);
create index if not exists idx_saas_renewals_org on public.saas_renewals (organization_id, created_at desc);

create table if not exists public.saas_cancellations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  type            text not null default 'fin_periodo'
                    check (type in ('inmediata','fin_periodo')),
  reason          text,
  status          text not null default 'programada'
                    check (status in ('programada','efectiva','revertida')),
  requested_at    timestamptz not null default now(),
  effective_at    timestamptz,
  revoked_at      timestamptz
);
create index if not exists idx_saas_cancellations_org on public.saas_cancellations (organization_id, requested_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 8 · CUPONES COMERCIALES DE LA PLATAFORMA (descuentos a la suscripción)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_coupons (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  discount_type   text not null default 'porcentaje' check (discount_type in ('porcentaje','monto')),
  value           numeric(14,2) not null default 0,
  max_redemptions int,
  redemptions     int not null default 0,
  starts_at       timestamptz,
  ends_at         timestamptz,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 9 · SOPORTE (tickets de atención)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.support_tickets (
  id             uuid primary key default gen_random_uuid(),
  number         text unique not null,                        -- T-2026-00001
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject        text not null,
  description    text not null default '',
  status         text not null default 'abierto'
                   check (status in ('abierto','pendiente','resuelto','cerrado')),
  priority       text not null default 'media'
                   check (priority in ('baja','media','alta','urgente')),
  category       text,
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  closed_at      timestamptz
);
create index if not exists idx_support_tickets_org on public.support_tickets (organization_id, created_at desc);
create index if not exists idx_support_tickets_status on public.support_tickets (status, updated_at desc);

create table if not exists public.support_ticket_messages (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.support_tickets(id) on delete cascade,
  author_name  text not null,
  author_role  text not null default 'organizacion' check (author_role in ('organizacion','soporte')),
  body         text not null,
  is_internal  boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists idx_ticket_messages_ticket on public.support_ticket_messages (ticket_id, created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- 10 · NOTIFICACIONES DE LA PLATAFORMA
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_notifications (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  body            text not null default '',
  audience        text not null default 'todas' check (audience in ('todas','organizacion')),
  organization_id uuid references public.organizations(id) on delete cascade,
  channel         text not null default 'in_app' check (channel in ('in_app','email')),
  status          text not null default 'enviada' check (status in ('borrador','enviada')),
  sent_at         timestamptz,
  created_by      text,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 11 · INTEGRACIONES DE LA PLATAFORMA + REGISTRO DE ERRORES
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_integrations (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null,
  name               text not null,
  category           text,
  is_active          boolean not null default false,
  config             jsonb not null default '{}',            -- sin secretos en claro
  last_error_at      timestamptz,
  last_error_message text,
  created_at         timestamptz not null default now()
);

create table if not exists public.platform_integration_logs (
  id              uuid primary key default gen_random_uuid(),
  integration_id  uuid not null references public.platform_integrations(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  level           text not null default 'info' check (level in ('info','warn','error')),
  message         text not null,
  detail          jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists idx_integration_logs_int on public.platform_integration_logs (integration_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- 12 · CONFIGURACIÓN GLOBAL DE LA PLATAFORMA
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.platform_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- 13 · SEGURIDAD (RLS) PARA LAS TABLAS NUEVAS
-- Lectura de tablas por organización: miembros activos; todo lo global:
-- solo el super administrador. La app del panel (Prisma) se conecta con el rol
-- dueño y ejecuta el aislamiento por organization_id en cada consulta.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'sessions',
    'organization_settings','organization_limit_overrides',
    'platform_modules','organization_modules',
    'saas_invoices','saas_payments','saas_renewals','saas_cancellations',
    'platform_coupons','support_tickets','support_ticket_messages',
    'platform_notifications','platform_integrations','platform_integration_logs',
    'platform_settings'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I no force row level security', t);
  end loop;
end;
$$;

-- Sesiones: cada usuario solo ve las suyas
drop policy if exists sessions_own_all on public.sessions;
create policy sessions_own_all on public.sessions
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tablas globales de la plataforma: solo super administrador
do $$
declare t text;
begin
  foreach t in array array[
    'platform_modules','platform_coupons','platform_notifications',
    'platform_integrations','platform_integration_logs','platform_settings'
  ]
  loop
    execute format($f$
      drop policy if exists %1$s_sa_read on public.%1$I;
      create policy %1$s_sa_read on public.%1$I
        for select to authenticated using (is_super_admin());
      drop policy if exists %1$s_sa_write on public.%1$I;
      create policy %1$s_sa_write on public.%1$I
        for all to authenticated
        using (is_super_admin()) with check (is_super_admin());
    $f$, t);
  end loop;
end;
$$;

-- Tablas por organización: miembros leen lo suyo, super admin todo
do $$
declare t text;
begin
  foreach t in array array[
    'organization_settings','organization_limit_overrides',
    'organization_modules','saas_invoices','saas_payments',
    'saas_renewals','saas_cancellations','support_tickets'
  ]
  loop
    execute format($f$
      drop policy if exists %1$s_org_read on public.%1$I;
      create policy %1$s_org_read on public.%1$I
        for select to authenticated
        using (is_org_member(organization_id) or is_super_admin());
      drop policy if exists %1$s_sa_write on public.%1$I;
      create policy %1$s_sa_write on public.%1$I
        for all to authenticated
        using (is_super_admin()) with check (is_super_admin());
    $f$, t);
  end loop;
end;
$$;

drop policy if exists ticket_messages_org_read on public.support_ticket_messages;
create policy ticket_messages_org_read on public.support_ticket_messages
  for select to authenticated
  using (
    is_super_admin()
    or exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (is_org_member(t.organization_id) or is_super_admin())
    )
  );
drop policy if exists ticket_messages_sa_write on public.support_ticket_messages;
create policy ticket_messages_sa_write on public.support_ticket_messages
  for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- Perfiles: cada usuario ve/edita su fila; el super admin ve todas
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or is_super_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or is_super_admin())
  with check (id = auth.uid() or is_super_admin());

-- ════════════════════════════════════════════════════════════════════════════
-- 14 · DATOS INICIALES
-- ════════════════════════════════════════════════════════════════════════════

-- ── 14.1 · Usuarios ─────────────────────────────────────────────────────────
-- Contraseñas de demostración (cámbialas desde el panel de usuarios):
--   super@comerzia.com  · admin123   → SUPER_ADMIN de la plataforma
--   demo@comerzia.com   · demo123    → OWNER de Comerzia Demo Store
--   cajero@comerzia.com · cajero123  → CAJERO de Comerzia Demo Store
-- El hash es scrypt con el formato s1$salt$hash usado por la aplicación.

insert into public.profiles (id, email, full_name, is_super_admin, password_hash, status)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'super@comerzia.com',  'Administrador COMERZIA', true,
        's1$comerzia-static-salt-demo$54128d1888415ad8eb7958e825438d9f0ef90a9510397a00d656b81e7e61480137d2bff6c0e88977fb7d175d694bf4cdcc7e94ba581c94cfb5fb096e1e695671',
        'activo')
on conflict (email) do update
  set is_super_admin = true,
      password_hash  = coalesce(public.profiles.password_hash, excluded.password_hash);

insert into public.profiles (id, email, full_name, is_super_admin, password_hash, status)
values ('aaaaaaaa-0000-4000-8000-000000000002', 'demo@comerzia.com', 'Propietario Demo', false,
        's1$comerzia-static-salt-demo$cb6190df47f9976707379228e511b8eb4a4e2cbf5ebb478cb4a447194b518908804bc4fd8533ee615f4356b05473dcbed3d84e5ad40919de453d587c6b19ba4c',
        'activo')
on conflict (email) do update
  set password_hash = coalesce(public.profiles.password_hash, excluded.password_hash);

insert into public.profiles (id, email, full_name, is_super_admin, password_hash, status)
values ('aaaaaaaa-0000-4000-8000-000000000003', 'cajero@comerzia.com', 'Cajero Demo', false,
        's1$comerzia-static-salt-demo$a8b85a8bc006fb769bae0e79c00bcae69898eaf3528380c79b8aa31d345a9afaec63854eedcb85ecaf2f531e1a81fa1bcab2d3a9518b2bf544671bd849c82181',
        'activo')
on conflict (email) do update
  set password_hash = coalesce(public.profiles.password_hash, excluded.password_hash);

-- ── 14.1b · Organización demo (se crea ANTES de sus membresías para que los
--           inserts de 14.2 siempre encuentren el slug 'comerzia-demo',
--           incluso si este script se ejecuta sin 03_seed.sql) ─────────────

insert into public.organizations (id, name, slug, tax_id, address, email, currency, status, trial_ends_at)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'Comerzia Demo Store', 'comerzia-demo', 'NIT 900.777.888-4',
        'Cra. 50 #12-34, Medellín', 'demo@comerzia.com', 'COP', 'activa', null)
on conflict (slug) do update set status = excluded.status, email = excluded.email;

-- ── 14.2 · Membresía del super admin (sin organización, acceso global) ──────

delete from public.organization_members
where user_id = 'aaaaaaaa-0000-4000-8000-000000000001';

insert into public.organization_members (organization_id, user_id, role, active)
select o.id, 'aaaaaaaa-0000-4000-8000-000000000002', 'OWNER', true
from public.organizations o
where o.slug = 'comerzia-demo'
on conflict (organization_id, user_id) do update set active = true;

insert into public.organization_members (organization_id, user_id, role, active)
select o.id, 'aaaaaaaa-0000-4000-8000-000000000003', 'CAJERO', true
from public.organizations o
where o.slug = 'comerzia-demo'
on conflict (organization_id, user_id) do update set active = true;

-- ── 14.3 · Organizaciones de demostración (estados variados para el panel) ──

insert into public.organizations (id, name, slug, tax_id, address, email, currency, status, trial_ends_at)
values ('bbbbbbbb-0000-4000-8000-000000000002', 'Distribuidora El Faro',        'el-faro',                    'NIT 901.101.202-3', 'Av. El Poblado #45-80, Medellín', 'contacto@elfaro.co',   'COP', 'prueba', now() + interval '12 days')
on conflict (slug) do update set trial_ends_at = excluded.trial_ends_at, status = excluded.status;

insert into public.organizations (id, name, slug, tax_id, address, email, currency, status, suspended_at)
values ('bbbbbbbb-0000-4000-8000-000000000003', 'Ferretería La Construcción',   'ferretera-la-construccion',  'NIT 901.555.606-7', 'Calle 80 #23-15, Bogotá',    'ventas@laconstructoracion.co', 'COP', 'activa', null)
on conflict (slug) do update set status = excluded.status;

insert into public.organizations (id, name, slug, tax_id, address, email, currency, status, suspended_at)
values ('bbbbbbbb-0000-4000-8000-000000000004', 'Papelería Mundo Escolar',      'papeleria-mundo-escolar',    'NIT 901.331.445-9', 'Cra. 7 #63-44, Bogotá',      'admin@mundoeducar.co',  'COP', 'activa', null)
on conflict (slug) do update set status = excluded.status;

insert into public.organizations (id, name, slug, tax_id, address, email, currency, status, suspended_at)
values ('bbbbbbbb-0000-4000-8000-000000000005', 'Juguetería Sueños',            'jugueteria-suenos',          'NIT 901.222.333-1', 'Cra. 43D #10-25, Medellín',  'hola@jugueteriasuenos.co', 'COP', 'activa', null)
on conflict (slug) do update set status = excluded.status;

insert into public.organizations (id, name, slug, tax_id, address, email, currency, status, suspended_at)
values ('bbbbbbbb-0000-4000-8000-000000000006', 'Hogar & Jardín SAS',           'hogar-jardin',               'NIT 900.111.222-5', 'Av. 68 #40-10, Bogotá',      'finanzas@hogaryjardin.co', 'COP', 'suspendida', now() - interval '6 days')
on conflict (slug) do update set status = excluded.status, suspended_at = excluded.suspended_at;

-- Propietario para cada organización de demostración (clave: demo123)
insert into public.profiles (id, email, full_name, is_super_admin, password_hash, status)
values
  ('aaaaaaaa-0000-4000-8000-000000000004', 'elfaro@comerzia.com',       'Camila Ríos',      false,
   's1$comerzia-static-salt-demo$cb6190df47f9976707379228e511b8eb4a4e2cbf5ebb478cb4a447194b518908804bc4fd8533ee615f4356b05473dcbed3d84e5ad40919de453d587c6b19ba4c', 'activo'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'ferretera@comerzia.com',    'Andrés Gómez',     false,
   's1$comerzia-static-salt-demo$cb6190df47f9976707379228e511b8eb4a4e2cbf5ebb478cb4a447194b518908804bc4fd8533ee615f4356b05473dcbed3d84e5ad40919de453d587c6b19ba4c', 'activo'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'papeleria@comerzia.com',    'Laura Martínez',   false,
   's1$comerzia-static-salt-demo$cb6190df47f9976707379228e511b8eb4a4e2cbf5ebb478cb4a447194b518908804bc4fd8533ee615f4356b05473dcbed3d84e5ad40919de453d587c6b19ba4c', 'activo'),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'jugueteria@comerzia.com',   'Julián Osorio',    false,
   's1$comerzia-static-salt-demo$cb6190df47f9976707379228e511b8eb4a4e2cbf5ebb478cb4a447194b518908804bc4fd8533ee615f4356b05473dcbed3d84e5ad40919de453d587c6b19ba4c', 'activo'),
  ('aaaaaaaa-0000-4000-8000-000000000008', 'hogarjardin@comerzia.com',  'Valentina Peña',   false,
   's1$comerzia-static-salt-demo$cb6190df47f9976707379228e511b8eb4a4e2cbf5ebb478cb4a447194b518908804bc4fd8533ee615f4356b05473dcbed3d84e5ad40919de453d587c6b19ba4c', 'activo')
on conflict (email) do update
  set password_hash = coalesce(public.profiles.password_hash, excluded.password_hash);

insert into public.organization_members (organization_id, user_id, role, active)
select o.id, p.id, 'OWNER', true
from public.organizations o
join public.profiles p on (
  (o.slug = 'el-faro' and p.email = 'elfaro@comerzia.com') or
  (o.slug = 'ferretera-la-construccion' and p.email = 'ferretera@comerzia.com') or
  (o.slug = 'papeleria-mundo-escolar' and p.email = 'papeleria@comerzia.com') or
  (o.slug = 'jugueteria-suenos' and p.email = 'jugueteria@comerzia.com') or
  (o.slug = 'hogar-jardin' and p.email = 'hogarjardin@comerzia.com')
)
on conflict (organization_id, user_id) do update set active = true;

-- ── 14.3b · Catálogo de módulos de la plataforma ────────────────────────────
-- Los códigos coinciden con los identificadores del panel del negocio.

insert into public.platform_modules (code, name, description, is_active, sort_order) values
  ('overview',    'Resumen',                 'Indicadores y estadísticas del comercio',            true, 1),
  ('pos',         'Punto de venta',          'Ventas, carrito, cupones y cobros',                  true, 2),
  ('cash',        'Caja',                    'Apertura, arqueo y cierre de caja',                  true, 3),
  ('sales',       'Ventas',                  'Historial de ventas y anulaciones',                  true, 4),
  ('quotations',  'Cotizaciones y pedidos',  'Cotizaciones convertibles a venta y pedidos',        true, 5),
  ('products',    'Productos',               'Catálogo, precios y clasificación',                  true, 6),
  ('inventory',   'Inventario',              'Existencias, bodegas y movimientos',                 true, 7),
  ('purchases',   'Compras',                 'Órdenes de compra y recepción',                      true, 8),
  ('suppliers',   'Proveedores',             'Gestión de proveedores y pagos',                     true, 9),
  ('customers',   'Clientes',                'CRM, cartera y fidelización',                        true, 10),
  ('marketing',   'Marketing',               'Cupones, promociones y campañas',                    true, 11),
  ('finance',     'Finanzas',                'Ingresos, egresos, CxC y CxP',                       true, 12),
  ('einvoice',    'Facturación electrónica', 'Documentos fiscales DIAN',                           true, 13),
  ('reports',     'Reportes',                'Analítica, rentabilidad y exportación',              true, 14),
  ('users',       'Usuarios',                'Usuarios y roles del panel',                         true, 15),
  ('settings',    'Ajustes',                 'Configuración del comercio',                         true, 16)
on conflict (code) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

-- ── 14.4 · Suscripciones (una por organización) ─────────────────────────────

insert into public.subscriptions (id, organization_id, plan_id, status, started_at, current_period_end, cancel_at_period_end)
select 'cccccccc-0000-4000-8000-000000000001', o.id, p.id, 'activa', now() - interval '8 months', now() + interval '22 days', false
from public.organizations o, public.plans p
where o.slug = 'comerzia-demo' and p.code = 'profesional'
on conflict (organization_id) do nothing;

insert into public.subscriptions (id, organization_id, plan_id, status, started_at, current_period_end, cancel_at_period_end)
select 'cccccccc-0000-4000-8000-000000000002', o.id, p.id, 'prueba', now() - interval '3 days', null, false
from public.organizations o, public.plans p
where o.slug = 'el-faro' and p.code = 'basico'
on conflict (organization_id) do nothing;

insert into public.subscriptions (id, organization_id, plan_id, status, started_at, current_period_end, cancel_at_period_end)
select 'cccccccc-0000-4000-8000-000000000003', o.id, p.id, 'vencida', now() - interval '14 months', now() - interval '12 days', false
from public.organizations o, public.plans p
where o.slug = 'ferretera-la-construccion' and p.code = 'premium'
on conflict (organization_id) do nothing;

insert into public.subscriptions (id, organization_id, plan_id, status, started_at, current_period_end, cancel_at_period_end)
select 'cccccccc-0000-4000-8000-000000000004', o.id, p.id, 'activa', now() - interval '6 months', now() + interval '9 days', false
from public.organizations o, public.plans p
where o.slug = 'papeleria-mundo-escolar' and p.code = 'profesional'
on conflict (organization_id) do nothing;

insert into public.subscriptions (id, organization_id, plan_id, status, started_at, current_period_end, cancel_at_period_end)
select 'cccccccc-0000-4000-8000-000000000005', o.id, p.id, 'activa', now() - interval '10 months', now() + interval '18 days', true
from public.organizations o, public.plans p
where o.slug = 'jugueteria-suenos' and p.code = 'basico'
on conflict (organization_id) do nothing;

insert into public.subscriptions (id, organization_id, plan_id, status, started_at, current_period_end, cancel_at_period_end)
select 'cccccccc-0000-4000-8000-000000000006', o.id, p.id, 'vencida', now() - interval '16 months', now() - interval '25 days', false
from public.organizations o, public.plans p
where o.slug = 'hogar-jardin' and p.code = 'basico'
on conflict (organization_id) do nothing;

-- ── 14.5 · Módulos habilitados para cada organización ───────────────────────

insert into public.organization_modules (organization_id, module_id, enabled)
select o.id, m.id, true
from public.organizations o
cross join public.platform_modules m
where m.is_active
on conflict (organization_id, module_id) do nothing;

-- ── 14.6 · Configuración del comercio por organización ─────────────────────

insert into public.organization_settings (organization_id, store_name, tax_id, address, currency, tax_rate)
select o.id, o.name, o.tax_id, o.address, 'COP', 19
from public.organizations o
on conflict (organization_id) do nothing;

-- ── 14.7 · Facturas SaaS de los últimos meses + mes en curso ────────────────
-- Estados: pagadas (historial), vencidas (morosidad: Ferretería y Hogar & Jardín),
-- pendientes (mes en curso). El Faro está en prueba y aún no genera facturas.

insert into public.saas_invoices (
  number, organization_id, subscription_id, period_start, period_end,
  amount, tax_rate, tax_amount, total, status, issued_at, due_at, paid_at
)
select
  'S-' || to_char(b.issued_at, 'YYYY') || '-' || lpad((row_number() over (order by b.issued_at, b.slug))::text, 5, '0'),
  b.org_id, b.sub_id, b.period_start, b.period_end,
  b.amount, 19, round(b.amount * 0.19, 2), round(b.amount * 1.19, 2),
  b.status, b.issued_at, b.due_at, b.paid_at
from (
  select
    o.slug,
    o.id as org_id, s.id as sub_id, p.monthly_price as amount,
    date_trunc('month', now()) - (g.i || ' months')::interval as period_start,
    date_trunc('month', now()) - (g.i || ' months')::interval + interval '1 month - 1 day' as period_end,
    case
      when g.i = 0 then 'pendiente'
      when o.slug = 'ferretera-la-construccion' and g.i <= 2 then 'vencida'
      when o.slug = 'hogar-jardin' and g.i <= 2 then 'vencida'
      else 'pagada'
    end as status,
    date_trunc('month', now()) - (g.i || ' months')::interval as issued_at,
    date_trunc('month', now()) - (g.i || ' months')::interval + interval '5 days' as due_at,
    case
      when (o.slug = 'ferretera-la-construccion' and g.i <= 2) then null
      when (o.slug = 'hogar-jardin' and g.i <= 2) then null
      when g.i = 0 then null
      else date_trunc('month', now()) - (g.i || ' months')::interval + interval '2 days'
    end as paid_at
  from public.organizations o
  join public.subscriptions s on s.organization_id = o.id
  join public.plans p on p.id = s.plan_id
  cross join generate_series(0, 6) as g(i)
  where o.slug in ('comerzia-demo','ferretera-la-construccion','papeleria-mundo-escolar','jugueteria-suenos','hogar-jardin')
) b
where not (b.slug = 'hogar-jardin' and b.period_start = date_trunc('month', now()))   -- suspendida: no factura del mes actual
on conflict (number) do nothing;

-- Pagos confirmados de las facturas pagadas
insert into public.saas_payments (organization_id, invoice_id, amount, method, reference, status, received_at)
select i.organization_id, i.id, i.total,
       case when (row_number() over (order by i.paid_at)) % 3 = 0 then 'pse' else 'transferencia' end,
       'TRX-' || to_char(i.paid_at, 'YYYYMMDD') || '-' || upper(right(i.id::text, 6)),
       'confirmado', i.paid_at
from public.saas_invoices i
where i.status = 'pagada' and i.paid_at is not null
  and not exists (select 1 from public.saas_payments pay where pay.invoice_id = i.id);

-- ── 14.8 · Historial de renovaciones ────────────────────────────────────────

insert into public.saas_renewals (organization_id, subscription_id, previous_period_end, new_period_end, invoice_number)
select r.org_id, r.sub_id, r.prev_end, r.new_end, r.inv_number
from (
  select o.id as org_id, s.id as sub_id,
         now() - (g.i || ' months')::interval + interval '30 days' as prev_end,
         now() - ((g.i - 1) || ' months')::interval + interval '30 days' as new_end,
         (select min(number) from public.saas_invoices si
           where si.organization_id = o.id and si.status = 'pagada'
             and si.issued_at >= now() - (g.i || ' months')::interval
             and si.issued_at <  now() - ((g.i - 1) || ' months')::interval) as inv_number
  from public.organizations o
  join public.subscriptions s on s.organization_id = o.id
  cross join generate_series(1, 3) as g(i)
  where o.slug in ('comerzia-demo','papeleria-mundo-escolar','ferretera-la-construccion')
) r
where not exists (
  select 1 from public.saas_renewals x
  where x.organization_id = r.org_id and x.new_period_end = r.new_end
);

-- ── 14.9 · Cancelación programada (Juguetería Sueños, fin de período) ───────

insert into public.saas_cancellations (organization_id, subscription_id, type, reason, status, effective_at)
select s.organization_id, s.id, 'fin_periodo',
       'Baja voluntaria: cierran la tienda física en agosto',
       'programada', s.current_period_end
from public.subscriptions s
join public.organizations o on o.id = s.organization_id
where o.slug = 'jugueteria-suenos'
  and not exists (
    select 1 from public.saas_cancellations c
    where c.organization_id = s.organization_id and c.status = 'programada'
  );

-- ── 14.10 · Cupones comerciales de la plataforma ────────────────────────────

insert into public.platform_coupons (code, discount_type, value, max_redemptions, redemptions, starts_at, ends_at, is_active, notes)
values
  ('BIENVENIDA20', 'porcentaje', 20,    100, 7, now() - interval '30 days', now() + interval '90 days', true,  'Descuento de bienvenida para nuevas organizaciones'),
  ('PRIMERMES50K', 'monto',      50000, 50,  3, now() - interval '15 days', now() + interval '45 days', true,  '$50.000 de descuento en el primer cobro'),
  ('REACTIVA10',   'porcentaje', 10,    null, 0, now() - interval '5 days', now() + interval '60 days', true, 'Recuperación de organizaciones morosas')
on conflict (code) do nothing;

-- ── 14.11 · Tickets de soporte con conversación ─────────────────────────────

insert into public.support_tickets (number, organization_id, subject, description, status, priority, category, created_by, created_at, updated_at, closed_at)
select v.number, o.id, v.subject, v.description, v.status, v.priority, v.category, v.created_by,
       now() - (v.hours_ago || ' hours')::interval,
       now() - ((v.hours_ago - v.age_hours) || ' hours')::interval,
       case when v.closed_age_hours is null then null
            else now() - (v.closed_age_hours || ' hours')::interval end
from (values
  ('T-2026-00001', 'comerzia-demo',             'Error al emitir factura electrónica', 'Al intentar emitir la factura F-2026-00042 la DIAN devuelve rechazo por validación del NIT.', 'abierto',   'urgente', 'facturacion',  'demo@comerzia.com',    2,   0,  null::numeric),
  ('T-2026-00002', 'papeleria-mundo-escolar',   'Duda con reporte de rotación',        '¿Cómo calcula COMERZIA la rotación de inventario en el reporte avanzado?',                    'pendiente', 'baja',    'reportes',     'papeleria@comerzia.com', 24,  4,  null::numeric),
  ('T-2026-00003', 'ferretera-la-construccion', 'Cobro duplicado en septiembre',       'Aparecen dos cobros por $273.581 en septiembre. Solicito reversión del segundo.',             'abierto',   'alta',    'facturacion',  'ferretera@comerzia.com', 72,  0,  null::numeric),
  ('T-2026-00004', 'el-faro',                   'Capacitación POS para bodega',        'Queremos agendar una sesión de capacitación del POS para el equipo de bodega.',               'pendiente', 'media',   'capacitacion', 'elfaro@comerzia.com',    120, 24, null::numeric),
  ('T-2026-00005', 'jugueteria-suenos',         'Cambiar método de pago',              'Queremos pasar la suscripción de transferencia a PSE.',                                        'cerrado',   'media',   'suscripciones','jugueteria@comerzia.com', 480, 24, 456)
) as v(number, slug, subject, description, status, priority, category, created_by, hours_ago, age_hours, closed_age_hours)
join public.organizations o on o.slug = v.slug
on conflict (number) do nothing;

insert into public.support_ticket_messages (ticket_id, author_name, author_role, body, is_internal, created_at)
select t.id, v.author_name, v.author_role, v.body, v.is_internal,
       t.created_at + (v.offset_min || ' minutes')::interval
from public.support_tickets t
join (values
  ('T-2026-00001', 'demo@comerzia.com',    'organizacion', 'Adjunto el log del error y el número de la factura afectada.', false, 0),
  ('T-2026-00001', 'Soporte COMERZIA',     'soporte',      'Gracias. Estamos revisando el NIT contra el RUT registrado; respondemos hoy.', false, 45),
  ('T-2026-00001', 'Soporte COMERZIA',     'soporte',      'El NIT en el perfil del comercio tiene un dígito de chequeo inválido. Revisar en Ajustes.', true, 50),
  ('T-2026-00002', 'papeleria@comerzia.com','organizacion', 'Sobre todo nos interesa el cálculo para línea de papelería.', false, 0),
  ('T-2026-00002', 'Soporte COMERZIA',     'soporte',      'La rotación se calcula como costo de ventas / inventario promedio del período. Te comparto la documentación.', false, 240),
  ('T-2026-00003', 'Soporte COMERZIA',     'soporte',      'Identificamos el cobro duplicado del 12 de septiembre. Lo anulamos y enviamos nota crédito.', false, 120),
  ('T-2026-00004', 'Soporte COMERZIA',     'soporte',      'Proponemos jueves 10 a.m. por Meet. ¿Les funciona?', false, 1440),
  ('T-2026-00005', 'jugueteria@comerzia.com','organizacion', 'Gracias por la gestión, quedamos pendientes.', false, 0),
  ('T-2026-00005', 'Soporte COMERZIA',     'soporte',      'Método actualizado a PSE. Ticket cerrado.', false, 2880)
) as v(number, author_name, author_role, body, is_internal, offset_min)
  on t.number = v.number
where not exists (
  select 1 from public.support_ticket_messages m where m.ticket_id = t.id
);

-- ── 14.12 · Notificaciones enviadas a clientes ──────────────────────────────

insert into public.platform_notifications (title, body, audience, organization_id, channel, status, sent_at, created_by)
select 'Mantenimiento programado', 'El próximo domingo entre 1:00 y 3:00 a.m. la plataforma tendrá mantenimiento. No habrá interrupciones de facturación.', 'todas', null, 'in_app', 'enviada', now() - interval '4 days', 'super@comerzia.com'
where not exists (select 1 from public.platform_notifications n where n.title = 'Mantenimiento programado');

insert into public.platform_notifications (title, body, audience, organization_id, channel, status, sent_at, created_by)
select 'Pago rechazado — actualiza tu método de pago', 'Tu suscripción Premium quedó vencida. Actualiza el método de pago para reactivar tu cuenta.', 'organizacion', o.id, 'email', 'enviada', now() - interval '6 days', 'super@comerzia.com'
from public.organizations o where o.slug = 'ferretera-la-construccion'
  and not exists (select 1 from public.platform_notifications n where n.organization_id = o.id and n.title like 'Pago rechazado%');

insert into public.platform_notifications (title, body, audience, organization_id, channel, status, sent_at, created_by)
select 'Tu prueba termina en 5 días', 'Tu período de prueba del plan Básico finaliza pronto. ¡Contrata un plan para no perder tus datos!', 'organizacion', o.id, 'in_app', 'enviada', now() - interval '2 days', 'super@comerzia.com'
from public.organizations o where o.slug = 'el-faro'
  and not exists (select 1 from public.platform_notifications n where n.organization_id = o.id and n.title like 'Tu prueba termina%');

-- ── 14.13 · Integraciones de la plataforma + errores recientes ──────────────

insert into public.platform_integrations (code, name, category, is_active, config) values
  ('wompi',     'Wompi (pagos SaaS)',        'pagos',          true,  '{"env":"produccion","webhook_url":"/api/integraciones/wompi"}'),
  ('resend',    'Resend (correo transaccional)', 'notificaciones', true, '{"from":"no-reply@comerzia.com"}'),
  ('whatsapp',  'WhatsApp Business API',     'mensajeria',     false, '{"numero":"+57300XXXXXXX"}'),
  ('dian',      'Habilitación DIAN (consumo interno)', 'fiscal', true, '{"ambiente":"habilitacion"}'),
  ('storage',   'Supabase Storage (respaldos)', 'infraestructura', true, '{"bucket":"comerzia-backups"}')
on conflict (code) do update set name = excluded.name, category = excluded.category;

insert into public.platform_integration_logs (integration_id, organization_id, level, message, detail, created_at)
select i.id, null, v.level, v.message, v.detail::jsonb, now() - (v.hours_ago || ' hours')::interval
from public.platform_integrations i
join (values
  ('wompi',  'error', 'Webhook de cobro rechazado: firma inválida (org. Ferretería La Construcción)', '{"invoice":"S-2026-00048","code":"invalid_signature"}', 26),
  ('wompi',  'error', 'Reintento de cobro fallido: fondos insuficientes (org. Hogar & Jardín SAS)',    '{"invoice":"S-2026-00052","code":"insufficient_funds"}', 8),
  ('resend', 'warn',  'Tasa de rebotes 4.2% en notificaciones de renovación',                          '{"rate":4.2}', 12),
  ('wompi',  'info',  'Cobro recurrente procesado correctamente para 12 organizaciones',               '{"count":12}', 5)
) as v(code, level, message, detail, hours_ago) on i.code = v.code
where not exists (
  select 1 from public.platform_integration_logs l
  where l.integration_id = i.id and l.message = v.message
);

update public.platform_integrations i
set last_error_at = l.created_at, last_error_message = l.message
from (
  select distinct on (integration_id) integration_id, created_at, message
  from public.platform_integration_logs
  where level = 'error'
  order by integration_id, created_at desc
) l
where l.integration_id = i.id and (i.last_error_at is null or i.last_error_at < l.created_at);

-- ── 14.14 · Parámetros generales de la plataforma ───────────────────────────

insert into public.platform_settings (key, value) values
  ('platform_name',          'COMERZIA'),
  ('support_email',          'soporte@comerzia.com'),
  ('default_trial_days',     '15'),
  ('grace_period_days',      '5'),
  ('tax_rate',               '19'),
  ('currency',               'COP'),
  ('session_days',           '7'),
  ('maintenance_mode',       'false'),
  ('allow_self_registration','true'),
  ('saas_invoice_prefix',    'S'),
  ('ticket_prefix',          'T')
on conflict (key) do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 15 · ÍNDICES ADICIONALES
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists idx_platform_modules_code     on public.platform_modules (code);
create index if not exists idx_org_modules_enabled       on public.organization_modules (organization_id, enabled);
create index if not exists idx_profiles_super_admin      on public.profiles (is_super_admin);
create index if not exists idx_members_role              on public.organization_members (organization_id, role, active);
