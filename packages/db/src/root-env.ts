// El .env del monorepo vive en la raíz, pero drizzle.config.ts y los CLIs de packages/db
// corren desde profundidades distintas. Un solo helper calcula la ruta y lo carga, para
// no repetir el número de "../" en cada archivo (Ruling #14).
//
// Usamos fileURLToPath(import.meta.url) en vez de import.meta.dirname: el bundler que usa
// drizzle-kit para cargar drizzle.config.ts (esbuild vía bundle-require) no soporta
// import.meta.dirname y lo deja `undefined`, pero sí reescribe import.meta.url por módulo.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_ENV_PATH = path.resolve(dirname, "../../../.env");

export function loadRootEnv(): void {
  config({ path: ROOT_ENV_PATH, quiet: true });
}
