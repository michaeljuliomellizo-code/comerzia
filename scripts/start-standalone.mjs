/**
 * COMERZIA — Arranca el servidor de producción standalone de Next.js.
 * Sustituye a `NODE_ENV=production node .next/standalone/server.js` para que el
 * script `start` funcione igual en Windows (PowerShell), macOS y Linux.
 *
 * Uso:  npm run start        (o: bun run start)
 * Puerto: variable de entorno PORT (por defecto 3000).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const serverFile = ".next/standalone/server.js";

if (!existsSync(serverFile)) {
  console.error("✗ No se encontró .next/standalone/server.js.");
  console.error("  Ejecuta primero `npm run build` y vuelve a intentarlo.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [serverFile], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

process.exit(result.status ?? 0);
