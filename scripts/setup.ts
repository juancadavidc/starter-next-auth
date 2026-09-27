// Convierte la plantilla en un proyecto nuevo: renombra, fija la clave del lock de
// migraciones, crea .env con secreto y quita los módulos opcionales que no se quieran.
// Corre con `node scripts/setup.ts` antes o después de `pnpm install`: solo usa node:*.
// Es idempotente: correrlo otra vez no reescribe nada ni toca un .env existente.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

export const TEMPLATE_NAME = "starter-next-auth";
export const TEMPLATE_SNAKE = "starter_next_auth";
// Valor de MIGRATION_LOCK_KEY en la plantilla. Solo ese valor se reemplaza: un proyecto
// que ya tiene su clave la conserva aunque setup.ts se corra otra vez con otro nombre.
export const TEMPLATE_LOCK_KEY = 1_918_273_645;
export const MODULES = ["storage", "landing", "pwa", "analytics"] as const;
export type Module = (typeof MODULES)[number];

// Regiones que replaceIdentity no toca (p. ej. la línea `--template` del README, que
// debe seguir apuntando a la plantilla). Van en comentarios, con el estilo del archivo:
// `<!-- <keep:template> -->` … `<!-- </keep:template> -->` en Markdown.
const KEEP_OPEN = "<keep:template>";
const KEEP_CLOSE = "</keep:template>";

const LOCK_KEY_FILE = "packages/db/src/lock-key.ts";

const MODULE_LABELS: Record<Module, string> = {
  storage: "Archivos en Cloudflare R2 (subida de imágenes)",
  landing: "Landing estática en Astro (Cloudflare)",
  pwa: "PWA (instalable, página sin conexión)",
  analytics: "Google Analytics 4",
};

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type ModuleSpec = {
  // Carpetas y archivos que son del módulo y se borran enteros.
  paths: string[];
  // JSON no admite comentarios: lo que el módulo agrega ahí se quita parseando.
  packageJson?: { file: string; edit: (pkg: PackageJson) => void }[];
};

const MODULE_SPECS: Record<Module, ModuleSpec> = {
  storage: {
    paths: ["packages/storage", "apps/web/src/app/api/files"],
    packageJson: [
      { file: "apps/web/package.json", edit: (pkg) => void delete pkg.dependencies?.["@repo/storage"] },
    ],
  },
  landing: { paths: ["apps/landing"] },
  pwa: {
    paths: [
      "apps/web/src/sw.ts",
      "apps/web/src/sw-strategy.ts",
      "apps/web/src/sw-strategy.test.ts",
      "apps/web/tsconfig.sw.json",
      "apps/web/src/components/sw-register.tsx",
      "apps/web/src/app/offline",
      "apps/web/src/app/manifest.ts",
      "apps/web/src/app/icon.tsx",
      "apps/web/public/sw.js",
    ],
    packageJson: [
      {
        file: "apps/web/package.json",
        edit: (pkg) => {
          if (pkg.scripts) {
            delete pkg.scripts["build:sw"];
            for (const [key, script] of Object.entries(pkg.scripts)) {
              pkg.scripts[key] = script
                .replaceAll("pnpm build:sw && ", "")
                .replaceAll(" && tsc -p tsconfig.sw.json --noEmit", "");
            }
          }
          // esbuild solo lo usa build:sw en apps/web; el de la raíz (entrypoint de Docker) queda.
          delete pkg.devDependencies?.esbuild;
        },
      },
    ],
  },
  analytics: {
    paths: ["apps/web/src/components/analytics.tsx", "apps/web/src/lib/ga.ts", "apps/web/src/lib/ga.test.ts"],
  },
};

export function validateName(name: string): string | null {
  if (name.length < 3 || name.length > 40) return "El nombre debe tener entre 3 y 40 caracteres.";
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    return "Usa kebab-case: minúsculas, números y guiones, empezando por letra (p. ej. mi-idea).";
  }
  return null;
}

export const toSnake = (name: string): string => name.replaceAll("-", "_");

// FNV-1a de 32 bits recortado a 31: estable por nombre y distinto entre proyectos que
// compartan servidor de Postgres.
export function lockKeyFor(name: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(name)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash & 0x7fffffff) || 1;
}

// Reemplaza `from` por `to` sin volver a reemplazar dentro de un `to` ya puesto: si el
// nombre nuevo contiene el de la plantilla (mi-starter-next-auth), una segunda corrida
// no debe producir mi-mi-starter-next-auth.
function replaceOnce(text: string, from: string, to: string): string {
  if (!to.includes(from)) return text.replaceAll(from, to);
  return text
    .split(to)
    .map((part) => part.replaceAll(from, to))
    .join(to);
}

export function replaceIdentity(content: string, name: string): string {
  let keeping = false;
  return content
    .split("\n")
    .map((line) => {
      if (line.includes(KEEP_OPEN)) keeping = true;
      const out = keeping
        ? line
        : replaceOnce(replaceOnce(line, TEMPLATE_NAME, name), TEMPLATE_SNAKE, toSnake(name));
      if (line.includes(KEEP_CLOSE)) keeping = false;
      return out;
    })
    .join("\n");
}

export function setLockKey(content: string, key: number): string {
  return content.replace(/MIGRATION_LOCK_KEY = [\d_]+;/, `MIGRATION_LOCK_KEY = ${key};`);
}

function readLockKey(content: string): number | null {
  const digits = /MIGRATION_LOCK_KEY = ([\d_]+);/.exec(content)?.[1];
  return digits ? Number(digits.replaceAll("_", "")) : null;
}

// Borra las líneas entre `<optional:x>` y `</optional:x>` (incluidas), sea cual sea el
// estilo de comentario (//, #, {/* */}). Un bloque sin cierre es un error: truncar el
// archivo en silencio sería peor.
export function removeMarkedBlocks(content: string, module: Module): string {
  const open = `<optional:${module}>`;
  const close = `</optional:${module}>`;
  const kept: string[] = [];
  let skipping = false;
  for (const line of content.split("\n")) {
    if (!skipping && line.includes(open)) {
      skipping = true;
    } else if (skipping) {
      if (line.includes(close)) skipping = false;
    } else {
      kept.push(line);
    }
  }
  if (skipping) throw new Error(`Marcador ${open} sin su cierre ${close}.`);
  return kept.join("\n");
}

export function withSecret(envExample: string, secret: string): string {
  return envExample.replace(/^BETTER_AUTH_SECRET=.*$/m, () => `BETTER_AUTH_SECRET=${secret}`);
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".turbo",
  "dist",
  "out",
  "coverage",
  "db-dumps",
  ".astro",
  ".superpowers",
]);
// La skill apunta a la plantilla a propósito; setup.ts y su test contienen el nombre.
const SKIP_PATHS = ["tools/skill", "docs/superpowers", "scripts/setup.ts", "scripts/setup.test.ts"];
const TEXT_FILE =
  /\.(ts|tsx|json|jsonc|ya?ml|md|css|astro|sql|toml)$|(^|\/)(Dockerfile|\.env\.example|\.gitignore|\.dockerignore|\.nvmrc)$/;

const isUnder = (rel: string, prefixes: string[]) => prefixes.some((p) => rel === p || rel.startsWith(`${p}/`));

export function listTextFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (isUnder(childRel, SKIP_PATHS)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(childRel);
      } else if (TEXT_FILE.test(childRel)) {
        out.push(childRel);
      }
    }
  };
  walk("");
  return out.sort();
}

export type SetupOptions = { name: string; remove: Module[]; secret?: string };
export type SetupResult = { changedFiles: string[]; envCreated: boolean; removed: Module[] };

// Aplica las ediciones de package.json de los módulos quitados. Si no cambia nada,
// devuelve el texto original tal cual (sin reformatear).
function editPackageJson(content: string, edits: ((pkg: PackageJson) => void)[]): string {
  if (!edits.length) return content;
  const pkg = JSON.parse(content) as PackageJson;
  const before = JSON.stringify(pkg);
  for (const edit of edits) edit(pkg);
  return JSON.stringify(pkg) === before ? content : `${JSON.stringify(pkg, null, 2)}\n`;
}

export function runSetup(root: string, opts: SetupOptions): SetupResult {
  const error = validateName(opts.name);
  if (error) throw new Error(error);
  const abs = (rel: string) => path.join(root, rel);
  const isTemplate = opts.name === TEMPLATE_NAME;
  const removedPaths = opts.remove.flatMap((mod) => MODULE_SPECS[mod].paths);

  // 1. Se calcula todo en memoria antes de escribir: si un marcador está roto, se aborta
  //    sin dejar el repo a medias.
  const pending: { rel: string; content: string }[] = [];
  for (const rel of listTextFiles(root)) {
    if (isUnder(rel, removedPaths)) continue;
    const before = readFileSync(abs(rel), "utf8");
    try {
      const jsonEdits = opts.remove.flatMap(
        (mod) => MODULE_SPECS[mod].packageJson?.filter((p) => p.file === rel).map((p) => p.edit) ?? [],
      );
      let after = editPackageJson(before, jsonEdits);
      after = opts.remove.reduce((text, mod) => removeMarkedBlocks(text, mod), after);
      if (!isTemplate) after = replaceIdentity(after, opts.name);
      if (!isTemplate && rel === LOCK_KEY_FILE && readLockKey(after) === TEMPLATE_LOCK_KEY) {
        after = setLockKey(after, lockKeyFor(opts.name));
      }
      if (after !== before) pending.push({ rel, content: after });
    } catch (cause) {
      throw new Error(`${rel}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    }
  }

  // 2. Módulos quitados: carpetas y archivos enteros.
  for (const rel of removedPaths) rmSync(abs(rel), { recursive: true, force: true });

  // 3. Identidad, marcadores, JSON y clave del lock.
  for (const { rel, content } of pending) writeFileSync(abs(rel), content);

  // 4. La spec y el plan describen la plantilla, no la idea nueva.
  if (!isTemplate) rmSync(abs("docs/superpowers"), { recursive: true, force: true });

  // 5. .env: se crea una sola vez; nunca se pisa uno existente.
  let envCreated = false;
  if (!existsSync(abs(".env")) && existsSync(abs(".env.example"))) {
    const secret = opts.secret ?? randomBytes(32).toString("base64");
    writeFileSync(abs(".env"), withSecret(readFileSync(abs(".env.example"), "utf8"), secret), { flag: "wx" });
    envCreated = true;
  }

  return { changedFiles: pending.map((p) => p.rel), envCreated, removed: opts.remove };
}

function run(command: string, args: string[]): void {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`✗ Falló: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

function printNextSteps(name: string, domain: string | undefined): void {
  const prod = domain ? `https://${domain}` : "https://<tu-dominio>";
  console.log(`
✓ ${name} listo. Pendientes:

1. Google OAuth (console.cloud.google.com → APIs & Services → Credentials → OAuth client ID, Web):
   Orígenes:  http://localhost:3000   ${prod}
   Redirects: http://localhost:3000/api/auth/callback/google
              ${prod}/api/auth/callback/google
   Copia el client id y el secret a GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en .env.

2. ADMIN_EMAILS en .env: tu correo de Google, para nacer admin.

3. Desplegar: /coolify-deploy crea la app "Docker Image" en Coolify; luego
   gh secret set COOLIFY_WEBHOOK_URL  y  gh secret set COOLIFY_TOKEN

4. pnpm dev → http://localhost:3000
`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      domain: { type: "string" },
      "no-storage": { type: "boolean", default: false },
      "no-landing": { type: "boolean", default: false },
      "no-pwa": { type: "boolean", default: false },
      "no-analytics": { type: "boolean", default: false },
      "no-db": { type: "boolean", default: false },
      yes: { type: "boolean", default: false },
    },
  });
  const interactive = !values.yes && process.stdin.isTTY;
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : undefined;

  let name = values.name ?? (rl ? (await rl.question("Nombre del proyecto (kebab-case): ")).trim() : "");
  while (validateName(name)) {
    if (!rl) throw new Error(`Nombre inválido "${name}": ${validateName(name)}`);
    console.log(validateName(name));
    name = (await rl.question("Nombre del proyecto (kebab-case): ")).trim();
  }
  const domain =
    values.domain ?? (rl ? (await rl.question("Dominio de producción (opcional): ")).trim() || undefined : undefined);

  const skip: Record<Module, boolean> = {
    storage: values["no-storage"],
    landing: values["no-landing"],
    pwa: values["no-pwa"],
    analytics: values["no-analytics"],
  };
  const remove: Module[] = [];
  for (const mod of MODULES) {
    if (skip[mod]) {
      remove.push(mod);
    } else if (rl) {
      const answer = (await rl.question(`¿Incluir ${MODULE_LABELS[mod]}? (S/n) `)).trim().toLowerCase();
      if (answer === "n" || answer === "no") remove.push(mod);
    }
  }
  rl?.close();

  const result = runSetup(process.cwd(), { name, remove });
  console.log(`\n✓ ${result.changedFiles.length} archivo(s) actualizados.`);
  if (result.removed.length) console.log(`✓ Módulos quitados: ${result.removed.join(", ")}`);
  console.log(result.envCreated ? "✓ .env creado con BETTER_AUTH_SECRET nuevo." : "• .env ya existía: no se tocó.");

  run("pnpm", ["install"]);
  if (!values["no-db"]) {
    run("pnpm", ["db:up"]);
    run("pnpm", ["db:migrate"]);
    run("pnpm", ["db:seed:dev"]);
  }
  printNextSteps(name, domain);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
