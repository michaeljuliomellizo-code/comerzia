-- ════════════════════════════════════════════════════════════════════════════
-- COMERZIA — 02 · Seguridad por filas (Row Level Security)
-- Regla de oro: ningún negocio puede leer ni modificar la información de otro.
-- Ejecutar DESPUÉS de 01_schema.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Funciones auxiliares ─────────────────────────────────────────────────────

-- ID de la organización del usuario autenticado (primera membresía activa)
create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid() and active
  order by created_at
  limit 1;
$$;

-- ¿El usuario pertenece a la organización indicada?
create or replace function public.is_org_member(org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where user_id = auth.uid() and organization_id = org and active
  );
$$;

-- ¿El usuario tiene alguno de los roles indicados en la organización?
create or replace function public.has_role(org uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where user_id = auth.uid()
      and organization_id = org
      and active
      and role = any(roles)
  );
$$;

-- ¿Es super administrador de la plataforma?
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, text[]) to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ── Activar RLS en todas las tablas operativas ──────────────────────────────

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','subscriptions','organization_members',
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
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- ── Políticas generales para tablas con organization_id ─────────────────────
-- Lectura: cualquier miembro activo de la organización.
-- Escritura: cualquier miembro activo (la lógica fina de roles vive en la app
-- y en los privilegios de cada rol; ajusta aquí si prefieres restringir más).

do $$
declare t text;
begin
  foreach t in array array[
    'branches','warehouses','cash_registers',
    'categories','brands','suppliers','products','product_variants',
    'stock_balances','inventory_movements','stock_counts',
    'customers','customer_addresses','sales','sale_items','sale_payments',
    'cash_sessions','cash_movements',
    'quotations','orders',
    'purchases','supplier_payments',
    'invoices','credit_notes',
    'finance_transactions','accounts_receivable','accounts_payable','expenses',
    'coupons','promotions','campaigns','loyalty_points',
    'shipments',
    'employees','commissions',
    'integrations','webhooks','api_keys',
    'storefronts','ecommerce_orders'
  ]
  loop
    execute format($f$
      drop policy if exists %1$s_member_select on public.%1$I;
      create policy %1$s_member_select on public.%1$I
        for select to authenticated
        using (is_org_member(organization_id));
    $f$, t);
    execute format($f$
      drop policy if exists %1$s_member_write on public.%1$I;
      create policy %1$s_member_write on public.%1$I
        for all to authenticated
        using (is_org_member(organization_id))
        with check (is_org_member(organization_id));
    $f$, t);
  end loop;
end;
$$;

-- Tablas de líneas (no llevan organization_id propio: heredan la organización
-- de su tabla padre) y carritos (heredan de la tienda).
do $$
declare spec text;
begin
  foreach spec in array array[
    'stock_count_items|count_id|stock_counts',
    'quotation_items|quotation_id|quotations',
    'order_items|order_id|orders',
    'purchase_items|purchase_id|purchases',
    'shipment_items|shipment_id|shipments',
    'carts|storefront_id|storefronts'
  ]
  loop
    declare
      tbl text := split_part(spec, '|', 1);
      fk  text := split_part(spec, '|', 2);
      parent text := split_part(spec, '|', 3);
    begin
      execute format($f$
        drop policy if exists %1$s_member_select on public.%1$I;
        create policy %1$s_member_select on public.%1$I
          for select to authenticated
          using (exists (
            select 1 from public.%2$I p
            where p.id = %1$I.%3$I and is_org_member(p.organization_id)
          ));
      $f$, tbl, parent, fk);
      execute format($f$
        drop policy if exists %1$s_member_write on public.%1$I;
        create policy %1$s_member_write on public.%1$I
          for all to authenticated
          using (exists (
            select 1 from public.%2$I p
            where p.id = %1$I.%3$I and is_org_member(p.organization_id)
          ))
          with check (exists (
            select 1 from public.%2$I p
            where p.id = %1$I.%3$I and is_org_member(p.organization_id)
          ));
      $f$, tbl, parent, fk);
    end;
  end loop;
end;
$$;

-- ── Organizaciones ──────────────────────────────────────────────────────────

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select on public.organizations
  for select to authenticated
  using (is_org_member(id) or is_super_admin());

drop policy if exists organizations_member_update on public.organizations;
create policy organizations_member_update on public.organizations
  for update to authenticated
  using (has_role(id, array['OWNER','ADMIN']) or is_super_admin())
  with check (has_role(id, array['OWNER','ADMIN']) or is_super_admin());

drop policy if exists organizations_owner_insert on public.organizations;
create policy organizations_owner_insert on public.organizations
  for insert to authenticated
  with check (is_super_admin());  -- las crea el Super Admin del SaaS

drop policy if exists organizations_owner_delete on public.organizations;
create policy organizations_owner_delete on public.organizations
  for delete to authenticated
  using (is_super_admin());

-- ── Membresías: solo OWNER/ADMIN gestionan usuarios ─────────────────────────

drop policy if exists members_select on public.organization_members;
create policy members_select on public.organization_members
  for select to authenticated
  using (is_org_member(organization_id) or is_super_admin());

drop policy if exists members_manage on public.organization_members;
create policy members_manage on public.organization_members
  for all to authenticated
  using (has_role(organization_id, array['OWNER','ADMIN']) or is_super_admin())
  with check (
    has_role(organization_id, array['OWNER','ADMIN']) or is_super_admin()
  );

-- Regla fundamental: nadie puede crearse el rol OWNER a sí mismo desde el panel.
-- Se valida con un trigger defensivo.
create or replace function public.guard_owner_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'OWNER' then
    -- El backend de la plataforma (conexión del servidor con rol dueño) es de
    -- confianza: crea organizaciones y asigna propietarios vía Super Admin.
    if current_user in ('postgres', 'service_role') then
      return new;
    end if;
    -- Permitido solo si el operador ya es OWNER de esa organización (transferencia)
    -- o es super admin de la plataforma.
    if not (has_role(new.organization_id, array['OWNER']) or is_super_admin()) then
      raise exception 'El rol OWNER no puede asignarse desde el panel. La propiedad tiene controles especiales.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_owner on public.organization_members;
create trigger trg_guard_owner
  before insert or update on public.organization_members
  for each row execute function public.guard_owner_role();

-- ── Suscripciones: OWNER gestiona, plataforma escribe por cobros ────────────

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (is_org_member(organization_id) or is_super_admin());

drop policy if exists subscriptions_manage on public.subscriptions;
create policy subscriptions_manage on public.subscriptions
  for all to authenticated
  using (has_role(organization_id, array['OWNER']) or is_super_admin())
  with check (has_role(organization_id, array['OWNER']) or is_super_admin());

-- ── Auditoría: solo lectura para miembros (la escriben triggers/backend) ────

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs
  for select to authenticated
  using (is_org_member(organization_id) or is_super_admin());

-- ── Planes: catálogo público legible ─────────────────────────────────────────

alter table public.plans enable row level security;
alter table public.plans force row level security;
drop policy if exists plans_public_read on public.plans;
create policy plans_public_read on public.plans
  for select to authenticated, anon using (true);

alter table public.plan_features enable row level security;
alter table public.plan_features force row level security;
drop policy if exists plan_features_public_read on public.plan_features;
create policy plan_features_public_read on public.plan_features
  for select to authenticated, anon using (true);

-- Perfiles: cada usuario ve/edita el suyo; super admin ve todos.
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or is_super_admin());

drop policy if exists profiles_self_write on public.profiles;
create policy profiles_self_write on public.profiles
  for all to authenticated
  using (id = auth.uid() or is_super_admin())
  with check (id = auth.uid() or is_super_admin());

-- ── Nota sobre el uso desde el backend ──────────────────────────────────────
-- Las Server Actions / API Routes del backend deben usar el cliente de Supabase
-- con la sesión del usuario (RLS aplica) y una clave service_role SOLO para
-- operaciones del sistema (cobros, webhooks, procesos programados).
