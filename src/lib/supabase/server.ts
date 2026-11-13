// ═══════════════════════════════════════════════════════════════════════════
// COMERZIA · Cliente de Supabase para el SERVIDOR de Next.js
// ═══════════════════════════════════════════════════════════════════════════
// Válido en los tres contextos del servidor:
//   · Server Components   (async function en app/**/page.tsx)
//   · Server Actions      ("use server" — puede escribir cookies)
//   · Route Handlers      (app/api/**/route.ts — puede escribir cookies)
//
// Maneja las cookies de Supabase con @supabase/ssr: si en el futuro se activa
// Supabase Auth, las cookies sbt-* (tokens de sesión) se refrescan solas en
// cada petición. Mientras tanto no interfiere con la cookie propia
// `comerzia_session` del sistema de sesiones de COMERZIA (tabla sessions).
//
// Uso (Server Component / Action / Route Handler):
//   const supabase = await getSupabaseServerClient()
//   const { data } = await supabase.from("products").select("*")
// ═══════════════════════════════════════════════════════════════════════════

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "COMERZIA · Faltan las variables públicas de Supabase en el servidor.\n" +
        "  1. Copia .env.example como .env y define NEXT_PUBLIC_SUPABASE_URL\n" +
        "     y NEXT_PUBLIC_SUPABASE_ANON_KEY (Supabase → Project Settings → API).\n" +
        "  2. En Vercel, agrégalas en Settings → Environment Variables y redespliega."
    )
  }

  // En Next.js 15/16 cookies() es asíncrono.
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Llamado desde un Server Component puro (render): el framework no
          // permite escribir cookies ahí. Es inofensivo mientras el refresco
          // de tokens ocurra en un Server Action o Route Handler (middleware
          // o la acción de login). Ver MIGRACION-SUPABASE.md, punto 5.
        }
      },
    },
  })
}
