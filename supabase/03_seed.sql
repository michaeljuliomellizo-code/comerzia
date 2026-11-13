-- ════════════════════════════════════════════════════════════════════════════
-- COMERZIA — 03 · Datos iniciales: planes comerciales y organización demo
-- Ejecutar DESPUÉS de 01_schema.sql y 02_rls.sql.
--
-- Precios oficiales (COP/mes):
--   Básico       $ 89.900
--   Profesional  $ 149.900
--   Premium      $ 229.900
-- ════════════════════════════════════════════════════════════════════════════

-- ── Planes ──────────────────────────────────────────────────────────────────

insert into public.plans (
  code, name, description, monthly_price, currency,
  max_branches, max_warehouses, max_users, max_products, max_customers,
  max_pos, max_price_lists, storage_gb, api_access, sort_order
) values
  (
    'basico', 'Básico',
    'Para pequeños comercios que están comenzando: ventas, productos, inventario de una bodega y facturación electrónica.',
    89900, 'COP',
    1, 1, 3, 1000, 1000,
    1, 2, 2, 'ninguno', 1
  ),
  (
    'profesional', 'Profesional',
    'Para negocios en crecimiento: múltiples sucursales y bodegas, cotizaciones, mayoristas, marketing y reportes avanzados.',
    149900, 'COP',
    5, 10, 15, 10000, 10000,
    5, 5, 10, 'limitada', 2
  ),
  (
    'premium', 'Premium',
    'Para distribuidores y empresas: tienda virtual, logística, inteligencia de negocios, automatizaciones y API completa.',
    229900, 'COP',
    null, null, null, null, null,   -- configurables por el Super Admin
    null, null, 50, 'completa', 3
  )
on conflict (code) do update
  set name            = excluded.name,
      description     = excluded.description,
      monthly_price   = excluded.monthly_price,
      currency        = excluded.currency,
      max_branches    = excluded.max_branches,
      max_warehouses  = excluded.max_warehouses,
      max_users       = excluded.max_users,
      max_products    = excluded.max_products,
      max_customers   = excluded.max_customers,
      max_pos         = excluded.max_pos,
      max_price_lists = excluded.max_price_lists,
      storage_gb      = excluded.storage_gb,
      api_access      = excluded.api_access,
      sort_order      = excluded.sort_order;

-- ── Matriz de funcionalidades por plan (feature flags) ──────────────────────
-- (Se reconstruye completa en cada ejecución)

delete from public.plan_features;

insert into public.plan_features (plan_id, module, feature, enabled, note)
select p.id, v.module, v.feature, v.enabled, v.note
from public.plans p
join (values
  ('basico',      'dashboard',    'basic',            true,  'Indicadores esenciales'),
  ('basico',      'pos',          'basic',            true,  'Ventas, carrito y descuentos básicos'),
  ('basico',      'caja',         'basic',            true,  'Apertura y cierre de caja'),
  ('basico',      'inventario',   'basic',            true,  'Una bodega, movimientos y kardex'),
  ('basico',      'compras',      'basic',            true,  'Órdenes de compra y recepción'),
  ('basico',      'clientes',     'basic',            true,  'Fichas e historial de compras'),
  ('basico',      'cartera',      'basic',            true,  'Ventas a crédito y abonos'),
  ('basico',      'facturacion',  'einvoice',         true,  'Factura electrónica desde el plan Básico (costos de emisión aparte)'),
  ('basico',      'finanzas',     'basic',            true,  'Ingresos y egresos'),
  ('basico',      'contabilidad', 'integration',      true,  'Exportación para el contador'),
  ('basico',      'reportes',     'basic',            true,  'Reportes básicos'),
  ('profesional', 'dashboard',    'advanced',         true,  'Comparativos y filtros por sucursal'),
  ('profesional', 'pos',          'advanced',         true,  'Cupones, crédito y pagos combinados'),
  ('profesional', 'caja',         'advanced',         true,  'Arqueo por caja y por cajero'),
  ('profesional', 'cotizaciones', 'quotations',       true,  'Cotizaciones convertibles a venta'),
  ('profesional', 'pedidos',      'orders',           true,  'Pedidos mayoristas y parciales'),
  ('profesional', 'inventario',   'advanced',         true,  'Multi-bodega, traslados y conteos cíclicos'),
  ('profesional', 'compras',      'advanced',         true,  'Recepción parcial y comparación de proveedores'),
  ('profesional', 'clientes',     'advanced',         true,  'Segmentación, cupos y listas de precios'),
  ('profesional', 'finanzas',     'advanced',         true,  'CxP, CxC, ingresos y egresos'),
  ('profesional', 'marketing',    'basic',            true,  'Cupones, promociones y fidelización'),
  ('profesional', 'logistica',    'basic',            true,  'Remisiones y despachos'),
  ('profesional', 'personal',     'commissions',      true,  'Comisiones por ventas'),
  ('profesional', 'reportes',     'advanced',         true,  'Rentabilidad, rotación y exportación'),
  ('profesional', 'integraciones', 'limited',         true,  'Integraciones comerciales'),
  ('premium',     'dashboard',    'custom_widgets',   true,  'Widgets configurables'),
  ('premium',     'pos',          'multi_branch',     true,  'POS para múltiples sucursales y cajas'),
  ('premium',     'pedidos',      'recurring',        true,  'Pedidos recurrentes y reservas'),
  ('premium',     'inventario',   'enterprise',       true,  'Lotes, seriales y vencimientos'),
  ('premium',     'compras',      'automated',        true,  'Reabastecimiento automático por reglas'),
  ('premium',     'clientes',     'portal',           true,  'Portal de clientes mayoristas y proveedores'),
  ('premium',     'contabilidad', 'advanced',         true,  'Centros de costos y cierre de períodos'),
  ('premium',     'marketing',    'full',             true,  'Campañas por segmento y WhatsApp'),
  ('premium',     'ecommerce',    'storefront',       true,  'Tienda virtual propia y dominio personalizado'),
  ('premium',     'logistica',    'advanced',         true,  'Picking, packing, rutas y evidencias'),
  ('premium',     'reportes',     'bi',               true,  'Pronósticos, BI y reportes personalizados'),
  ('premium',     'integraciones', 'full',            true,  'API completa, webhooks y Power BI'),
  ('premium',     'auditoria',    'full',             true,  'Auditoría avanzada')
) as v(plan_code, module, feature, enabled, note)
  on p.code = v.plan_code;

-- ── Organización de demostración con suscripción Profesional ────────────────
-- Ajusta/elimina este bloque si prefieres crear las organizaciones solo desde
-- el panel del Super Admin.

insert into public.organizations (name, slug, tax_id, address, currency)
values ('Comerzia Demo Store', 'comerzia-demo', 'NIT 900.777.888-4', 'Cra. 50 #12-34, Medellín', 'COP')
on conflict (slug) do nothing;

insert into public.subscriptions (organization_id, plan_id, status, current_period_end)
select o.id, p.id, 'activa', now() + interval '30 days'
from public.organizations o, public.plans p
where o.slug = 'comerzia-demo' and p.code = 'profesional'
on conflict (organization_id) do nothing;

-- Nota: para dar acceso a un usuario real:
--   1. Crea el usuario en Authentication → Users (Supabase Auth).
--   2. Inserta su perfil: insert into public.profiles (id, email, full_name) values ('<auth-uuid>', '...', '...');
--   3. Agrégalo como miembro:
--      insert into public.organization_members (organization_id, user_id, role, can_view_costs)
--      select o.id, '<auth-uuid>', 'OWNER', true from public.organizations o where o.slug = 'comerzia-demo';
--   El primer OWNER debe asignarse con el rol service_role o desde el SQL Editor (RLS lo protege).
