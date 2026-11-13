import { PrismaClient } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────────────
// Validación temprana del entorno: si la configuración está desactualizada
// (cliente Prisma viejo o cadena SQLite antigua), se muestra una instrucción
// clara en lugar de errores crípticos como
// "Cannot read properties of undefined (reading 'findUnique')".
// ─────────────────────────────────────────────────────────────────────────────

const dbUrl = process.env.DATABASE_URL ?? ""

if (!dbUrl) {
  throw new Error(
    "COMERZIA · DATABASE_URL no está definida.\n" +
      "  1. Copia .env.example como .env en la raíz del proyecto.\n" +
      "  2. Pon en DATABASE_URL la cadena de conexión de Supabase (o de tu PostgreSQL).\n" +
      "  Importante: los comandos de Prisma (db:push, db:generate) y la semilla (db:seed)\n" +
      "  solo leen el archivo .env — NO leen .env.local (ese lo usa únicamente Next.js)."
  )
}

if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
  throw new Error(
    `COMERZIA · El esquema actual es PostgreSQL/Supabase, pero DATABASE_URL empieza con "${dbUrl.split(":")[0]}://" (cadena antigua de SQLite).\n` +
      "  1. Reemplaza DATABASE_URL en .env por la cadena de conexión de Supabase (ver .env.example).\n" +
      "  2. Si tienes .env.local con una DATABASE_URL=file:… antigua, bórrala o actualízala también.\n" +
      "  La base SQLite (db/custom.db) ya no se usa."
  )
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Las consultas se registran solo si se activa PRISMA_LOG_QUERIES=1 en
    // .env (imprimir cada consulta ralentiza visiblemente el desarrollo).
    log: process.env.PRISMA_LOG_QUERIES === "1" ? ["query", "error"] : ["error"],
  })

// Cliente Prisma generado con el esquema antiguo (sin los modelos multi-tenant):
// db.profile no existiría y el login fallaría con "Cannot read properties of
// undefined". Se detecta al arranque con la instrucción exacta de arreglo.
if (typeof (db as unknown as Record<string, unknown>).profile === "undefined") {
  throw new Error(
    "COMERZIA · El cliente de Prisma está desactualizado (no incluye los modelos multi-tenant como Profile).\n" +
      "  Ejecuta:  npx prisma generate   (o: npm run db:generate)\n" +
      "  y luego reinicia el servidor (detén npm run dev y vuelve a arrancarlo)."
  )
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
