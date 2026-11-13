"use client"

// ═══════════════════════════════════════════════════════════════════════════
// COMERZIA · Cliente de Supabase para el NAVEGADOR
// ═══════════════════════════════════════════════════════════════════════════
// Usa SOLO la clave pública anónima (NEXT_PUBLIC_SUPABASE_ANON_KEY): es la
// única segura para exponer en el cliente y va siempre acompañada de las
// políticas RLS de supabase/02_rls.sql, que limitan lo que la clave anónima
// puede leer o escribir.
//
// NUNCA importes aquí el cliente admin (src/lib/supabase/admin.ts): usa la
// SUPABASE_SERVICE_ROLE_KEY y se bloquea en compilación con "server-only".
//
// Uso (componente cliente):
//   const supabase = getSupabaseBrowserClient()
//   const { data } = await supabase.storage.from("recibos").list("demo")
// ═══════════════════════════════════════════════════════════════════════════

import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

let browserClient: SupabaseClient | undefined

export function getSupabaseBrowserClient(): SupabaseClient {
  // Patrón singleton: @supabase/ssr recomienda una única instancia por
  // pestaña para no duplicar canales de realtime ni listeners de auth.
  if (browserClient) return browserClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "COMERZIA · Faltan las variables públicas de Supabase en el entorno del navegador.\n" +
        "  1. Copia .env.example como .env (y reinicia el servidor de desarrollo).\n" +
        "  2. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY\n" +
        "     (Supabase → Project Settings → API).\n" +
        "  Nota: en Vercel agrégalas en Settings → Environment Variables."
    )
  }

  browserClient = createBrowserClient(url, anonKey)
  return browserClient
}
