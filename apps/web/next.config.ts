import path from "node:path";
import type { NextConfig } from "next";
import { loadRootEnv } from "@repo/db/root-env";

// El .env vive en la raíz del monorepo, no en apps/web: se carga aquí para que
// `next dev`, `next build` y `next start` vean DATABASE_URL y compañía. No pisa variables
// ya definidas (Docker/Coolify las inyectan) y si el archivo no existe no hace nada.
loadRootEnv();

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Monorepo: el tracing del standalone parte de la raíz para incluir packages/*.
  // `next build` corre con cwd = apps/web (turbo/pnpm --filter).
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // Los paquetes internos se publican como TypeScript fuente.
  transpilePackages: [
    "@repo/auth",
    "@repo/db",
    "@repo/env",
    "@repo/ui",
    // <optional:storage>
    "@repo/storage",
    // </optional:storage>
  ],
};

export default config;
