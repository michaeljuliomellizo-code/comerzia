import "server-only"

// ═══════════════════════════════════════════════════════════════════════════
// COMERZIA · Cliente ADMIN de Supabase (SERVICE_ROLE) — SOLO SERVIDOR
// ═══════════════════════════════════════════════════════════════════════════
// La SUPABASE_SERVICE_ROLE_KEY BYPASA todas las políticas RLS: puede leer y
// escribir cualquier tabla de cualquier organización. Por eso:
//
//   1. `import "server-only"` hace que el build FALLA si algún componente
//      cliente ("use client") intenta importar este archivo. Es una garantía
//      de compilación, no una convención.
//   2. Nunca se expone al navegador: no lleva el prefijo NEXT_PUBLIC_.
//   3. Se usa con persistSession desactivado: no mantiene sesión de usuario.
//
// Casos de uso legítimos (siempre desde el servidor):
//   · Tareas administrativas del SaaS (/admin): suspender organizaciones,
//     depurar sesiones vencidas, backfills puntuales.
//   · Operaciones que deben ignorar RLS de forma justificada.
//
// La operación diaria del panel del negocio sigue usando Prisma (DATABASE_URL)
// conectado al PostgreSQL de Supabase. Ver MIGRACION-SUPABASE.md.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

let adminClient: SupabaseClient | undefined

export function getSupabaseAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "COMERZIA · Faltan variables para el cliente admin de Supabase.\n" +
        "  Define SUPABASE_SERVICE_ROLE_KEY en .env (solo servidor).\n" +
        "  Supabase → Project Settings → API → service_role (secreta).\n" +
        "  En Vercel: Settings → Environment Variables (tipo Sensitive)."
    )
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      // El cliente admin nunca actúa como un usuario con sesión.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  return adminClient
}
