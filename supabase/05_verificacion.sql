-- ═══════════════════════════════════════════════════════════════════════════
-- COMERZIA · 05_verificacion.sql
-- Diagnóstico completo de la base en Supabase. Solo lectura (SELECT):
-- se puede ejecutar cuantas veces sea necesario sin modificar datos.
-- Ejecutar en Supabase → SQL Editor, después de 01→02→03→04.
-- Cada sección imprime su propio encabezado; revisa los valores esperados.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Tablas núcleo (esperadas: 37 del esquema Prisma) ───────────────────
select '1 · TABLAS NÚCLEO' as seccion, count(*) as total_tablas_public
from pg_tables where schemaname = 'public';

-- Detalle: verifica que las tablas críticas existan
select '   tabla' as tabla, to_regclass('public.' || t) is not null as existe
from (values ('organizations'),('profiles'),('sessions'),('organization_members'),
             ('plans'),('subscriptions'),('audit_logs'),('products'),('sales')) as t(tabla);

-- ── 2 · RLS habilitado (esperado: enabled = sí) ────────────────────────────
select '2 · RLS' as seccion, tablename, rowsecurity as rls_habilitado, forcerowsecurity as rls_forzado
from pg_tables where schemaname = 'public' and tablename in
  ('organizations','profiles','sessions','organization_members','products','sales')
order by tablename;

-- Conteo de políticas (esperado: ≥ 17)
select '   políticas RLS totales' as dato, count(*) as valor
from pg_policies where schemaname = 'public';

-- ── 3 · Cuentas demo (esperado: 3 filas, todas 'activo') ───────────────────
select '3 · CUENTAS DEMO' as seccion, email, full_name, is_super_admin, status
from public.profiles
where email in ('super@comerzia.com','demo@comerzia.com','cajero@comerzia.com')
order by email;

-- ── 4 · CONDICIÓN DE LOGIN de demo@comerzia.com / demo123 ──────────────────
-- Esperado: estado_usuario=activo · miembro_activo=true · rol=OWNER ·
--           estado_organizacion ≠ 'suspendida' (activa o prueba)
select '4 · LOGIN DEMO' as seccion,
       p.status            as estado_usuario,
       m.active            as miembro_activo,
       m.role              as rol,
       o.name              as organizacion,
       o.status            as estado_organizacion,
       case when p.status = 'activo'
             and m.active is true
             and coalesce(o.status,'inexistente') <> 'suspendida'
            then 'LOGIN OK' else 'FALLO — ver filas' end as diagnostico
from public.profiles p
left join public.organization_members m on m.user_id = p.id and m.active = true
left join public.organizations o on o.id = m.organization_id
where p.email = 'demo@comerzia.com';

-- ── 5 · Planes (esperado: 3 — Básico 89900, Profesional 149900, Premium 229900) ──
select '5 · PLANES' as seccion, code, name, monthly_price, is_active
from public.plans order by sort_order;

-- ── 6 · Organizaciones demo (esperado: ≥ 6, con estados variados) ──────────
select '6 · ORGANIZACIONES' as seccion, slug, status, trial_ends_at::date
from public.organizations order by slug;

-- ── 7 · Suscripciones y membresías ─────────────────────────────────────────
select '7 · CONTEOS' as seccion,
       (select count(*) from public.subscriptions)     as suscripciones,
       (select count(*) from public.organization_members) as membresias,
       (select count(*) from public.sessions)          as sesiones,
       (select count(*) from public.products)          as productos,
       (select count(*) from public.sales)             as ventas;

-- ── 8 · Integridad (esperado: 0 huérfanos en ambas consultas) ──────────────
select '8 · INTEGRIDAD' as seccion,
       (select count(*) from public.organization_members m
         where not exists (select 1 from public.organizations o where o.id = m.organization_id)
            or not exists (select 1 from public.profiles p where p.id = m.user_id)) as membresias_huerfanas,
       (select count(*) from public.products pr
         where not exists (select 1 from public.organizations o where o.id = pr.organization_id)) as productos_huerfanos;
