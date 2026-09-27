import "./load-env";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

// Copia una base remota (p. ej. producción) a db-dumps/<fecha>.dump usando el pg_dump del
// contenedor local, así no hace falta instalar el cliente de Postgres en la máquina.
// Uso: pnpm db:dump "postgres://usuario:clave@host:5432/base"
const source = process.argv[2] ?? process.env.DUMP_SOURCE_URL;
if (!source) {
  console.error("Uso: pnpm db:dump <DATABASE_URL de origen>  (o DUMP_SOURCE_URL)");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "../../../..");
const outDir = path.join(root, "db-dumps");
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.dump`);

const child = spawn(
  "docker",
  ["compose", "-f", "docker-compose.local.yaml", "exec", "-T", "postgres",
    "pg_dump", "--format=custom", "--no-owner", "--no-acl", source],
  { cwd: root, stdio: ["ignore", "pipe", "inherit"] },
);
child.stdout.pipe(createWriteStream(outFile));
child.on("exit", (code) => {
  if (code === 0) console.log(`Dump guardado en ${path.relative(root, outFile)}`);
  process.exit(code ?? 1);
});
