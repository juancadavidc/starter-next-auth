import "./load-env";
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

// Copia una base remota (p. ej. producción) a db-dumps/<fecha>.dump usando el pg_dump del
// contenedor local, así no hace falta instalar el cliente de Postgres en la máquina.
// Uso: pnpm db:dump "postgres://usuario:clave@host:5432/base"
//
// `pg_dump` corre DENTRO del contenedor: si `source` usa `localhost`, apunta al contenedor
// mismo, no a la máquina host. Para una base del host usa `host.docker.internal` en vez de
// `localhost`.
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

// "close" (no "exit"): garantiza que los streams de stdio ya se cerraron.
const closed = new Promise<number | null>((resolve) => child.on("close", resolve));

// Sin este handler, un `docker` inexistente (ENOENT) queda como una excepción no capturada.
child.on("error", (err) => {
  console.error(`No se pudo ejecutar "docker": ${err.message}`);
  process.exit(1);
});

if (!child.stdout) throw new Error("pg_dump no expuso stdout (stdio mal configurado)");

// `pipeline` espera a que el archivo termine de escribirse (flush incluido) antes de seguir.
// `child.on("exit", ...)` + `process.exit` no lo garantiza: el proceso puede terminar antes
// de que el write stream drene, dejando un dump truncado con código de salida 0.
try {
  await pipeline(child.stdout, createWriteStream(outFile));
} catch (err) {
  console.error(`Fallo escribiendo el dump: ${(err as Error).message}`);
  process.exit(1);
}

const code = await closed;
if (code === 0) console.log(`Dump guardado en ${path.relative(root, outFile)}`);
process.exit(code ?? 1);
