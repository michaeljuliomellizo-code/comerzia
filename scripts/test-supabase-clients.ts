// Prueba funcional de los clientes Supabase de COMERZIA (sin red):
// 1) admin sin variables  → mensaje claro de COMERZIA
// 2) admin con variables  → instancia creada con .from() y .storage
// 3) server sin variables → mensaje claro (falla antes de tocar cookies())
import { getSupabaseAdminClient } from "../src/lib/supabase/admin"

let pass = 0, fail = 0
function check(name: string, cond: boolean, extra = "") {
  if (cond) { pass++; console.log(`  OK   · ${name}`) }
  else { fail++; console.log(`  FALLO· ${name} ${extra}`) }
}

console.log("— 1 · admin sin variables de entorno")
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k]
try {
  getSupabaseAdminClient()
  check("debe lanzar error sin variables", false, "(no lanzó)")
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  check("lanza error con instrucción COMERZIA", msg.includes("COMERZIA") && msg.includes("SUPABASE_SERVICE_ROLE_KEY"), msg.slice(0, 80))
}

console.log("— 2 · admin con variables dummy (creación local, sin red)")
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prueba.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "clave-de-prueba-no-real"
const admin = getSupabaseAdminClient()
check("instancia creada", typeof admin === "object" && admin !== null)
check("expone .from (PostgREST)", typeof admin.from === "function")
check("expone .storage", typeof admin.storage === "object")
check("expone .auth.admin (service role)", typeof admin.auth?.admin === "object")

async function testServer() {
  for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) delete process.env[k]
  const { getSupabaseServerClient } = await import("../src/lib/supabase/server")
  try {
    await getSupabaseServerClient()
    check("debe lanzar error sin variables", false, "(no lanzó)")
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    check("lanza error con instrucción COMERZIA", msg.includes("COMERZIA") && msg.includes("NEXT_PUBLIC_SUPABASE_URL"), msg.slice(0, 80))
  }
}

async function main() {
  console.log("— 3 · server sin variables (debe fallar antes de cookies())")
  await testServer()
  console.log(`\nResultado: ${pass} OK · ${fail} FALLO`)
  process.exit(fail === 0 ? 0 : 1)
}
void main()
