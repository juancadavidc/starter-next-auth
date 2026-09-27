// Las migraciones aplicadas son historia: drizzle guarda su hash en
// drizzle.__drizzle_migrations y un rolling deploy mantiene viva la versión anterior
// mientras arranca la nueva. Por eso solo se admite AGREGAR archivos .sql, y los nuevos
// no pueden borrar, renombrar ni cambiar tipos salvo que lo digan explícitamente.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export type Change = { status: "A" | "M" | "D" | "R"; path: string; newPath?: string };

const MIGRATIONS_DIR = "packages/db/migrations/";
const DESTRUCTIVE =
  /\b(DROP\s+(TABLE|COLUMN|SCHEMA|INDEX|TYPE|CONSTRAINT|VIEW)|RENAME\s+(TO|COLUMN)|ALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE)\b/i;
const ALLOW = /--\s*allow-destructive:\s*\S+/i;

export function parseNameStatus(output: string): Change[] {
  return output
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const [rawStatus = "", path = "", newPath] = line.split("\t");
      const status = rawStatus.charAt(0) as Change["status"];
      return newPath ? { status, path, newPath } : { status, path };
    });
}

function isMigrationSql(path: string): boolean {
  return path.startsWith(MIGRATIONS_DIR) && !path.includes("/meta/") && path.endsWith(".sql");
}

export function checkMigrations(changes: Change[], readFile: (path: string) => string): string[] {
  const errors: string[] = [];
  for (const change of changes) {
    const touched = [change.path, change.newPath].filter((p): p is string => !!p);
    if (!touched.some(isMigrationSql)) continue;

    if (change.status === "D") {
      errors.push(`${change.path}: la migración fue borrada. Agrega una nueva que revierta.`);
    } else if (change.status === "M") {
      errors.push(`${change.path}: la migración fue modificada. Agrega una nueva encima.`);
    } else if (change.status === "R") {
      errors.push(`${change.path}: la migración fue renombrada a ${change.newPath}.`);
    } else if (change.status === "A") {
      const sql = readFile(change.path);
      if (DESTRUCTIVE.test(sql) && !ALLOW.test(sql)) {
        errors.push(
          `${change.path}: contiene DROP/RENAME/cambio de tipo. Si es intencional, agrega ` +
            `el comentario "-- allow-destructive: <motivo>".`,
        );
      }
    }
  }
  return errors;
}

if (import.meta.main) {
  const base = process.argv[2] ?? "origin/main";
  const output = execFileSync(
    "git",
    ["diff", "--name-status", "-M", `${base}...HEAD`, "--", MIGRATIONS_DIR],
    { encoding: "utf8" },
  );
  const errors = checkMigrations(parseNameStatus(output), (p) => readFileSync(p, "utf8"));
  if (errors.length === 0) {
    console.log("Migraciones OK: solo cambios aditivos.");
  } else {
    for (const error of errors) {
      const file = error.split(":")[0];
      console.error(process.env.GITHUB_ACTIONS ? `::error file=${file}::${error}` : error);
    }
    process.exit(1);
  }
}
