import "./load-env";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import path from "node:path";

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
createReadStream(path.resolve(root, file)).pipe(child.stdin);
child.on("exit", (code) => process.exit(code ?? 1));
