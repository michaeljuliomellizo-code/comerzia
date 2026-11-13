-- ════════════════════════════════════════════════════════════════════════════
-- COMERZIA — 01 · Esquema de base de datos (PostgreSQL / Supabase)
-- Arquitectura SaaS multi-tenant: todas las tablas operativas llevan organization_id
-- y el aislamiento se aplica con Row Level Security (ver 02_rls.sql).
--
-- Ejecutar en el SQL Editor de Supabase EN ORDEN:
--   01_schema.sql → 02_rls.sql → 03_seed.sql
-- ════════════════════════════════════════════════════════════════════════════

-- Extensiones necesarias
create extension if not exists "pgcrypto";

-- ════════════════════════════════════════════════════════════════════════════
-- NÚCLEO SaaS
-- ════════════════════════════════════════════════════════════════════════════

-- Organizaciones (cada negocio)
create table if not exists public.organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  tax_id        text,
  address       text,
  phone         text,
  email         text,
  currency      text not null default 'COP',
  timezone      text not null default 'America/Bogota',
  logo_url      text,
  primary_color text default '#10b981',
  status        text not null default 'activa' check (status in ('activa','suspendida','cancelada','prueba')),
  trial_ends_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Planes comerciales (Básico, Profesional, Premium)
create table if not exists public.plans (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,               -- basico | profesional | premium
  name            text not null,
  description     text,
  monthly_price   numeric(12,2) not null,             -- COP
  billing_period  text not null default 'mes',
  currency        text not null default 'COP',
  is_active       boolean not null default true,
  -- Límites configurables (null = ilimitado/configurable)
  max_branches    int,
  max_warehouses  int,
  max_users       int,
  max_products    int,
  max_customers   int,
  max_pos         int,
  max_price_lists int,
  storage_gb      int,
  api_access      text not null default 'ninguno' check (api_access in ('ninguno','limitada','completa')),
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- Funcionalidades del catálogo (feature flags)
create table if not exists public.plan_features (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references public.plans(id) on delete cascade,
  module     text not null,                          -- pos, caja, cotizaciones, compras, marketing…
  feature    text not null,                          -- clave de la funcionalidad
  enabled    boolean not null default true,
  note       text,
  unique (plan_id, module, feature)
);

-- Suscripciones de cada organización
create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id        uuid not null references public.plans(id),
  status         text not null default 'activa' check (status in ('prueba','activa','vencida','cancelada')),
  started_at     timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (organization_id)
);

-- Usuarios (vinculados a Supabase Auth)
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),  -- = auth.users.id
  email       text unique not null,
  full_name   text,
  avatar_url  text,
  phone       text,
  is_super_admin boolean not null default false,           -- administrador de la plataforma
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Membresías: usuario ↔ organización con rol (RBAC)
create table if not exists public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  role            text not null default 'CAJERO' check (role in
                    ('OWNER','ADMIN','CAJERO','VENDEDOR','INVENTARIO','COMPRAS','CONTADOR','LOGISTICA','AUDITOR')),
  branch_id       uuid,                                    -- permiso por sucursal (null = todas)
  active          boolean not null default true,
  -- Permisos granulares
  can_view_costs   boolean not null default false,
  can_authorize    boolean not null default false,         -- aprobar anulaciones/ajustes
  discount_limit_pct numeric(5,2) not null default 0,      -- límite de descuento por usuario
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- SUCURSALES, BODEGAS Y CAJAS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.branches (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  code            text,
  address         text,
  phone           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.warehouses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  name            text not null,
  code            text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.cash_registers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  name            text not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- PRODUCTOS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  parent_id       uuid references public.categories(id) on delete set null, -- subcategorías
  created_at      timestamptz not null default now()
);

create table if not exists public.brands (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  created_at      timestamptz not null default now()
);

create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  tax_id          text,
  contact_name    text,
  email           text,
  phone           text,
  address         text,
  payment_terms   text not null default 'contado' check (payment_terms in ('contado','credito_15','credito_30')),
  credit_limit    numeric(14,2) default 0,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  name             text not null,
  sku              text not null,
  barcode          text,
  internal_code    text,
  reference        text,
  description      text,
  long_description text,
  category_id      uuid references public.categories(id) on delete set null,
  brand_id         uuid references public.brands(id) on delete set null,
  supplier_id      uuid references public.suppliers(id) on delete set null,
  unit             text not null default 'unidad',
  cost_price       numeric(14,2) not null default 0,
  sale_price       numeric(14,2) not null default 0,
  wholesale_price  numeric(14,2),
  retail_price     numeric(14,2),
  distributor_price numeric(14,2),
  tax_rate         numeric(5,2) not null default 19,
  stock            int not null default 0,
  min_stock        int not null default 5,
  max_stock        int,
  weight_kg        numeric(10,3),
  storage_location text,          -- ubicación en bodega
  image_url        text,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, sku)
);

create table if not exists public.product_variants (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  name            text not null,                 -- "Talla M · Rojo"
  sku             text not null,
  barcode         text,
  attributes      jsonb not null default '{}',   -- {"talla":"M","color":"Rojo"}
  cost_price      numeric(14,2) not null default 0,
  sale_price      numeric(14,2) not null default 0,
  stock           int not null default 0,
  active          boolean not null default true,
  unique (organization_id, sku)
);

-- ════════════════════════════════════════════════════════════════════════════
-- INVENTARIO
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.stock_balances (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  warehouse_id    uuid not null references public.warehouses(id) on delete cascade,
  quantity        int not null default 0,
  reserved        int not null default 0,        -- stock comprometido por pedidos
  unique (product_id, warehouse_id)
);

create table if not exists public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  warehouse_id    uuid references public.warehouses(id) on delete set null,
  type            text not null check (type in ('entrada','salida','ajuste','traslado')),
  quantity        int not null,
  unit_cost       numeric(14,2),
  reference_type  text,                          -- sale | purchase | manual | count
  reference_id    uuid,
  note            text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create table if not exists public.stock_counts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id    uuid not null references public.warehouses(id) on delete cascade,
  status          text not null default 'abierta' check (status in ('abierta','cerrada')),
  kind            text not null default 'total' check (kind in ('total','parcial','ciclico')),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create table if not exists public.stock_count_items (
  id              uuid primary key default gen_random_uuid(),
  count_id        uuid not null references public.stock_counts(id) on delete cascade,
  product_id      uuid not null references public.products(id) on delete cascade,
  system_qty      int not null,
  counted_qty     int not null,
  difference      int generated always as (counted_qty - system_qty) stored
);

-- ════════════════════════════════════════════════════════════════════════════
-- CLIENTES Y VENTAS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.customers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  doc_type        text,                          -- CC | NIT | CE | PAS
  doc_id          text,
  email           text,
  phone           text,
  type            text not null default 'particular' check (type in ('particular','empresa')),
  price_list      text not null default 'retail' check (price_list in ('retail','wholesale','distributor')),
  credit_limit    numeric(14,2) not null default 0,
  loyalty_points  int not null default 0,
  notes           text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  label           text,
  address         text not null,
  city            text,
  is_default      boolean not null default false
);

create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  cash_session_id uuid,                          -- FK creada después de cash_sessions
  customer_id     uuid references public.customers(id) on delete set null,
  customer_name   text not null default 'Cliente de mostrador',
  folio           text not null,
  subtotal        numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  coupon_code     text,
  coupon_discount numeric(14,2) not null default 0,
  tax             numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  payment_method  text not null default 'efectivo' check (payment_method in ('efectivo','tarjeta','transferencia','credito')),
  status          text not null default 'completada' check (status in ('completada','pendiente','cancelada')),
  cufe            text,
  einvoice_status text not null default 'pendiente' check (einvoice_status in ('pendiente','emitida','rechazada')),
  note            text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, folio)
);

create table if not exists public.sale_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id         uuid not null references public.sales(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  variant_id      uuid references public.product_variants(id) on delete set null,
  name            text not null,
  sku             text,
  quantity        int not null default 1,
  unit_price      numeric(14,2) not null default 0,
  unit_cost       numeric(14,2) not null default 0,   -- para margen y rentabilidad
  subtotal        numeric(14,2) not null default 0
);

create table if not exists public.sale_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id         uuid not null references public.sales(id) on delete cascade,
  method          text not null check (method in ('efectivo','tarjeta','transferencia','credito')),
  amount          numeric(14,2) not null,
  reference       text,                          -- autorización / comprobante
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- CAJA
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.cash_sessions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id       uuid references public.branches(id) on delete set null,
  cash_register_id uuid references public.cash_registers(id) on delete set null,
  opened_at       timestamptz not null default now(),
  closed_at       timestamptz,
  opening_amount  numeric(14,2) not null default 0,
  closing_amount  numeric(14,2),
  expected_amount numeric(14,2),
  difference      numeric(14,2),
  status          text not null default 'abierta' check (status in ('abierta','cerrada')),
  opened_by       uuid references public.profiles(id),
  notes           text,
  created_at      timestamptz not null default now()
);

alter table public.sales
  add constraint sales_cash_session_fk
  foreign key (cash_session_id) references public.cash_sessions(id) on delete set null;

create table if not exists public.cash_movements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id      uuid not null references public.cash_sessions(id) on delete cascade,
  type            text not null check (type in ('ingreso','egreso')),
  amount          numeric(14,2) not null,
  concept         text not null,
  source          text not null default 'manual' check (source in ('manual','venta')),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- COTIZACIONES Y PEDIDOS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.quotations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  folio           text not null,
  customer_id     uuid references public.customers(id) on delete set null,
  customer_name   text not null default 'Cliente de mostrador',
  status          text not null default 'borrador' check (status in ('borrador','enviada','aprobada','rechazada','convertida')),
  valid_until     date,
  subtotal        numeric(14,2) not null default 0,
  discount        numeric(14,2) not null default 0,
  tax             numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  note            text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  unique (organization_id, folio)
);

create table if not exists public.quotation_items (
  id              uuid primary key default gen_random_uuid(),
  quotation_id    uuid not null references public.quotations(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  sku             text,
  quantity        int not null default 1,
  unit_price      numeric(14,2) not null default 0,
  subtotal        numeric(14,2) not null default 0
);

create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  folio           text not null,
  customer_id     uuid references public.customers(id) on delete set null,
  quotation_id    uuid references public.quotations(id) on delete set null,
  sale_id         uuid references public.sales(id) on delete set null,
  status          text not null default 'pendiente' check (status in
                    ('pendiente','parcial','preparando','despachado','entregado','cancelado')),
  delivery_type   text not null default 'domicilio' check (delivery_type in ('domicilio','recogida','transportadora')),
  address         text,
  total           numeric(14,2) not null default 0,
  recurring       boolean not null default false,  -- pedidos recurrentes
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, folio)
);

create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  sku             text,
  quantity        int not null default 1,
  delivered_qty   int not null default 0,          -- despachos parciales
  unit_price      numeric(14,2) not null default 0,
  subtotal        numeric(14,2) not null default 0
);

-- ════════════════════════════════════════════════════════════════════════════
-- COMPRAS Y PROVEEDORES
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.purchases (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  folio           text not null,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  supplier_name   text not null,
  status          text not null default 'pendiente' check (status in ('pendiente','recibida','parcial','cancelada')),
  subtotal        numeric(14,2) not null default 0,
  tax             numeric(14,2) not null default 0,
  total           numeric(14,2) not null default 0,
  paid            boolean not null default false,
  note            text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  received_at     timestamptz,
  unique (organization_id, folio)
);

create table if not exists public.purchase_items (
  id              uuid primary key default gen_random_uuid(),
  purchase_id     uuid not null references public.purchases(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  sku             text,
  quantity        int not null default 1,
  received_qty    int not null default 0,          -- recepción parcial
  unit_cost       numeric(14,2) not null default 0,
  subtotal        numeric(14,2) not null default 0
);

create table if not exists public.supplier_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id     uuid references public.suppliers(id) on delete set null,
  purchase_id     uuid references public.purchases(id) on delete set null,
  amount          numeric(14,2) not null,
  method          text not null default 'transferencia',
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- FACTURACIÓN ELECTRÓNICA (DIAN — Colombia)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id         uuid references public.sales(id) on delete set null,
  folio           text not null,
  cufe            text unique,
  status          text not null default 'pendiente' check (status in ('pendiente','emitida','aceptada','rechazada')),
  xml_url         text,
  pdf_url         text,
  dian_response   jsonb,
  issued_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, folio)
);

create table if not exists public.credit_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id      uuid references public.invoices(id) on delete set null,
  folio           text not null,
  reason          text not null,
  total           numeric(14,2) not null default 0,
  cufe            text,
  status          text not null default 'pendiente' check (status in ('pendiente','emitida','aceptada','rechazada')),
  created_at      timestamptz not null default now(),
  unique (organization_id, folio)
);

-- ════════════════════════════════════════════════════════════════════════════
-- FINANZAS
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.finance_transactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type            text not null check (type in ('ingreso','egreso')),
  category        text not null default 'operativo' check (category in ('operativo','abono_cliente','pago_proveedor','otro')),
  amount          numeric(14,2) not null,
  method          text not null default 'efectivo',
  description     text not null,
  ref_type        text,                            -- sale | purchase
  ref_id          uuid,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

create table if not exists public.accounts_receivable (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sale_id         uuid not null references public.sales(id) on delete cascade,
  total           numeric(14,2) not null default 0,
  paid            numeric(14,2) not null default 0,
  due_date        date,
  status          text not null default 'abierta' check (status in ('abierta','pagada','vencida')),
  created_at      timestamptz not null default now()
);

create table if not exists public.accounts_payable (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_id     uuid not null references public.purchases(id) on delete cascade,
  total           numeric(14,2) not null default 0,
  paid            numeric(14,2) not null default 0,
  due_date        date,
  status          text not null default 'abierta' check (status in ('abierta','pagada','vencida')),
  created_at      timestamptz not null default now()
);

create table if not exists public.expenses (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category        text not null,
  description     text not null,
  amount          numeric(14,2) not null,
  cost_center     text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- MARKETING Y FIDELIZACIÓN
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.coupons (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code            text not null,
  type            text not null default 'porcentaje' check (type in ('porcentaje','monto')),
  value           numeric(14,2) not null,
  min_total       numeric(14,2) not null default 0,
  max_uses        int,
  usage_count     int not null default 0,
  active          boolean not null default true,
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.promotions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  kind            text not null default 'descuento' check (kind in ('descuento','2x1','combo','precio_especial')),
  rules           jsonb not null default '{}',     -- condiciones y alcance
  starts_at       timestamptz,
  ends_at         timestamptz,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  channel         text not null default 'email' check (channel in ('email','whatsapp','sms')),
  segment         jsonb not null default '{}',     -- criterios de segmentación de clientes
  message         text,
  sent_count      int not null default 0,
  status          text not null default 'borrador' check (status in ('borrador','programada','enviada')),
  created_at      timestamptz not null default now()
);

create table if not exists public.loyalty_points (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  points          int not null,
  reason          text not null,                   -- compra | canje | ajuste
  ref_type        text,
  ref_id          uuid,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- LOGÍSTICA
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.shipments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id        uuid references public.orders(id) on delete set null,
  folio           text not null,
  carrier         text,                            -- transportadora
  tracking_code   text,
  status          text not null default 'pendiente' check (status in
                    ('pendiente','picking','packing','despachado','entregado','devuelto')),
  delivery_evidence_url text,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (organization_id, folio)
);

create table if not exists public.shipment_items (
  id              uuid primary key default gen_random_uuid(),
  shipment_id     uuid not null references public.shipments(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,
  quantity        int not null default 1
);

-- ════════════════════════════════════════════════════════════════════════════
-- PERSONAL
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.employees (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id      uuid references public.profiles(id) on delete set null,
  name            text not null,
  role_kind       text not null default 'cajero' check (role_kind in ('cajero','vendedor','inventario','compras','contador','logistica')),
  branch_id       uuid references public.branches(id) on delete set null,
  base_salary     numeric(14,2) not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.commissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id     uuid not null references public.employees(id) on delete cascade,
  sale_id         uuid references public.sales(id) on delete set null,
  period          text,                            -- YYYY-MM
  basis           numeric(14,2) not null default 0,  -- base de cálculo (ventas)
  rate_pct        numeric(5,2) not null default 0,
  amount          numeric(14,2) not null default 0,
  status          text not null default 'pendiente' check (status in ('pendiente','aprobada','pagada')),
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- AUDITORÍA E INTEGRACIONES
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id         uuid references public.profiles(id),
  action          text not null,                   -- create | update | delete | login | authorize…
  entity          text not null,                   -- products | sales | users…
  entity_id       uuid,
  changes         jsonb,
  ip_address      text,
  created_at      timestamptz not null default now()
);

create table if not exists public.integrations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  kind            text not null check (kind in ('dian','wompi','mercadopago','whatsapp','resend','transportadora','contable','powerbi')),
  config          jsonb not null default '{}',     -- sin secretos en claro
  active          boolean not null default false,
  created_at      timestamptz not null default now()
);

create table if not exists public.webhooks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event           text not null,                   -- sale.created | purchase.received | stock.low…
  target_url      text not null,
  secret_hint     text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.api_keys (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  key_prefix      text not null,
  scopes          text[] not null default '{}',
  last_used_at    timestamptz,
  revoked         boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- COMERCIO ELECTRÓNICO (Premium)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.storefronts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade unique,
  slug            text unique not null,
  custom_domain   text unique,
  audience        text not null default 'ambos' check (audience in ('publico','mayoristas','ambos')),
  theme           jsonb not null default '{}',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.carts (
  id              uuid primary key default gen_random_uuid(),
  storefront_id   uuid not null references public.storefronts(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete cascade,
  session_token   text,
  items           jsonb not null default '[]',
  updated_at      timestamptz not null default now()
);

create table if not exists public.ecommerce_orders (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  storefront_id   uuid not null references public.storefronts(id) on delete cascade,
  sale_id         uuid references public.sales(id) on delete set null,
  customer_id     uuid references public.customers(id) on delete set null,
  status          text not null default 'recibido' check (status in ('recibido','pagado','preparando','enviado','entregado','cancelado')),
  items           jsonb not null default '[]',
  total           numeric(14,2) not null default 0,
  payment_ref     text,
  created_at      timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- ÍNDICES DE RENDIMIENTO
-- ════════════════════════════════════════════════════════════════════════════

create index if not exists idx_sales_org_created     on public.sales (organization_id, created_at desc);
create index if not exists idx_sale_items_sale       on public.sale_items (sale_id);
create index if not exists idx_products_org_active   on public.products (organization_id, active);
create index if not exists idx_products_barcode      on public.products (organization_id, barcode);
create index if not exists idx_purchases_org_created on public.purchases (organization_id, created_at desc);
create index if not exists idx_movements_org_product on public.inventory_movements (organization_id, product_id, created_at desc);
create index if not exists idx_cash_mov_session      on public.cash_movements (session_id);
create index if not exists idx_finance_org_created   on public.finance_transactions (organization_id, created_at desc);
create index if not exists idx_members_user          on public.organization_members (user_id);
create index if not exists idx_customers_org_name    on public.customers (organization_id, name);
create index if not exists idx_audit_org_created     on public.audit_logs (organization_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- TRIGGER updated_at (aplicado a las tablas con ese campo)
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['organizations','profiles','subscriptions','suppliers','products','sales','customers','orders','purchases','carts']
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format('create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;
