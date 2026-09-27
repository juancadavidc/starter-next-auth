import "./load-env";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

// Restaura un dump sobre la base del contenedor LOCAL (nunca otra: el destino es fijo).
// Uso: pnpm db:restore db-dumps/2026-09-26T00-00-00-000Z.dump
const file = process.argv[2];
if (!file) {
  console.error("Uso: pnpm db:restore <archivo .dump>");
  process.exit(1);
}

const root = path.resolve(import.meta.dirname, "../../../..");
const child = spawn(
  "docker",
  ["compose", "-f", "docker-compose.local.yaml", "exec", "-T", "postgres",
    "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-acl",
    "-U", "starter", "-d", "starter_next_auth"],
  { cwd: root, stdio: ["pipe", "inherit", "inherit"] },
);

// "close" (no "exit"): garantiza que los streams de stdio ya se cerraron.
const closed = new Promise<number | null>((resolve) => child.on("close", resolve));

// Sin este handler, un `docker` inexistente (ENOENT) queda como una excepción no capturada.
child.on("error", (err) => {
  console.error(`No se pudo ejecutar "docker": ${err.message}`);
  process.exit(1);
});

if (!child.stdin) throw new Error("pg_restore no expuso stdin (stdio mal configurado)");

// `pipeline` propaga el error de `createReadStream` (p. ej. archivo inexistente) en vez de
// dejarlo como una excepción no capturada.
try {
  await pipeline(createReadStream(path.resolve(root, file)), child.stdin);
} catch (err) {
  console.error(`No se pudo leer "${file}": ${(err as Error).message}`);
  process.exit(1);
}

const code = await closed;
process.exit(code ?? 1);
