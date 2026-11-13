/**
 * COMERZIA — Copia los archivos estáticos al build standalone de Next.js.
 * Sustituye a `cp -r` para que el script `build` funcione en Windows, macOS y Linux.
 * Se ejecuta automáticamente tras `next build` (ver script `build` en package.json).
 */
import { cpSync, existsSync } from "node:fs";

const standaloneDir = ".next/standalone";

if (!existsSync(standaloneDir)) {
  console.error("✗ No existe .next/standalone. Ejecuta primero `npm run build`.");
  process.exit(1);
}

cpSync(".next/static", `${standaloneDir}/.next/static`, { recursive: true });
cpSync("public", `${standaloneDir}/public`, { recursive: true });

console.log("✓ Archivos estáticos copiados a .next/standalone");
