# starter-next-auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la plantilla `starter-next-auth`: monorepo pnpm/Turborepo con Next 16, Better Auth (Google + admin), Postgres con Drizzle, shadcn/ui, Docker/CI hacia GHCR → Coolify, un script de setup y la skill `/new-starter-next-auth`.

**Architecture:** Paquetes internos como TypeScript fuente (`@repo/env`, `@repo/db`, `@repo/auth`, `@repo/ui`, `@repo/storage`) consumidos por `apps/web` con `transpilePackages`. La lógica de decisión (roles, guards, redirecciones seguras, reglas de migraciones, setup) se escribe como funciones puras testeadas; los bordes (Next, Better Auth, Postgres) se prueban contra un Postgres real. La imagen Docker migra con advisory lock al arrancar mediante un entrypoint TypeScript empaquetado con esbuild.

**Tech Stack:** Node 24 LTS, pnpm 10, Turborepo 2, TypeScript 5.9, Next 16.3 (App Router, `proxy.ts`), React 19.2, Better Auth 1.7 (plugin `admin`), Drizzle ORM 0.45 + postgres.js 3.4, Vitest 4, Tailwind v4 + shadcn/ui + next-themes, esbuild, Docker, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-26-starter-next-auth-design.md`

## Global Constraints

- **Todo es TypeScript.** Ningún `.js`/`.mjs`/`.cjs` escrito a mano. PostCSS va en `postcss.config.json`. El único JS del repo es generado (`public/sw.js`, `dist/entrypoint.mjs`) y no se versiona.
- **Código en inglés, comentarios en español.** Copy visible al usuario en español. Sin i18n.
- Node 24 LTS (`.nvmrc` = `24`, `engines.node` = `>=24`). pnpm fijado en `packageManager`.
- Scripts de `scripts/` corren con `node scripts/<x>.ts` (type stripping nativo): solo sintaxis borrable, imports relativos con `.ts`, y `setup.ts` importa únicamente `node:*`.
- Paquetes internos con scope `@repo/*`, exportan fuente `.ts`/`.tsx` sin build propio.
- `DATABASE_URL` es la única variable de conexión.
- `next build` nunca necesita Postgres: en build se usa `SKIP_ENV_VALIDATION=1`.
- Cada página protegida llama a su guard; los layouts no protegen.
- Migraciones solo aditivas; nunca se editan las ya aplicadas.
- Commits sin trailers de atribución (sin `Co-Authored-By`, sin `Claude-Session`).
- Nombre de la plantilla: `starter-next-auth` (kebab) / `starter_next_auth` (snake, nombre de base de datos). `setup.ts` reemplaza ambas formas.
- GitHub: `juancadavidc/starter-next-auth`, público, marcado como template.

## Review Focus

1. **Un admin se quita el rol o se banea a sí mismo** → el sistema lo rechaza con un error claro; nunca queda la app sin admins por accidente. (Test en Task 8.)
2. **`?next=` manipulado en `/login`** (`https://evil.com`, `//evil.com`, `/\evil.com`, `/api/...`) → se ignora y se va a `/app`; nunca hay open redirect. (Test en Task 5.)
3. **Usuario baneado con una sesión viva** → los guards lo tratan como sin acceso (página: a `/login?error=banned`; API: 403). (Test en Task 5.)
4. **`setup.ts` corrido dos veces, o con un `.env` ya existente** → no rompe nada, no sobrescribe `.env` ni secretos, no duplica reemplazos. (Test en Task 14.)
5. **Correos de `ADMIN_EMAILS` con mayúsculas, espacios o comas sobrantes, y correos de Google con mayúsculas** → coinciden igual; lista vacía = nadie es admin. (Test en Task 5.)

---

## File Structure

```
starter-next-auth/
  package.json                     scripts raíz, devDeps de tooling, packageManager
  pnpm-workspace.yaml              workspaces + onlyBuiltDependencies
  turbo.json                       pipeline build/lint/typecheck
  .nvmrc  .gitignore  .env.example
  eslint.config.ts                 flat config (next + typescript)
  vitest.config.ts                 un solo runner para todo el monorepo
  vitest.setup.ts                  mocks de server-only/next/cache + base de test
  vitest.global-setup.ts           crea y migra <db>_test
  docker-compose.local.yaml        Postgres 17 local
  docker-compose.yaml              producción (Coolify)
  docker/Dockerfile
  docker/entrypoint.ts             migrar con lock → server.js
  scripts/tsconfig.json            config estricta para type stripping
  scripts/brand-lint.ts            + brand-lint.test.ts
  scripts/check-migrations.ts      + check-migrations.test.ts
  scripts/setup.ts                 + setup.test.ts
  tools/skill/SKILL.md             skill /new-starter-next-auth
  .github/workflows/ci.yml
  .github/workflows/build-and-push.yml
  .claude/settings.json
  AGENTS.md  CLAUDE.md  README.md
  packages/config/                 tsconfig base y nextjs
  packages/env/src/index.ts        required(), env
  packages/db/
    drizzle.config.ts
    migrations/                    SQL generado por drizzle-kit
    src/schema/{auth,app,index}.ts
    src/client.ts                  db
    src/migrate.ts                 runMigrations() con advisory lock
    src/lock-key.ts                MIGRATION_LOCK_KEY (lo fija setup.ts)
    src/test-url.ts                toTestDatabaseUrl()
    src/cli/{migrate,seed-dev,dump,restore}.ts
  packages/auth/src/
    roles.ts  api-error.ts  safe-next.ts  access.ts  dev-login.ts
    server.ts  session.ts  guards.ts  client.ts
  packages/ui/
    components.json  src/styles/globals.css  src/lib/utils.ts
    src/components/*.tsx (shadcn)  src/components/theme-provider.tsx
  packages/storage/src/            [opcional] env, r2, image-variants, upload
  apps/web/
    next.config.ts  postcss.config.json  tsconfig.json
    src/proxy.ts
    src/app/layout.tsx  globals.css  page.tsx
    src/app/login/page.tsx  src/components/login-buttons.tsx
    src/app/onboarding/{page,actions}.tsx|ts  src/lib/profile.ts
    src/app/app/page.tsx
    src/app/admin/users/{page,actions}.tsx|ts  src/lib/admin-users.ts
    src/app/api/auth/[...all]/route.ts
    src/app/api/health/route.ts  src/app/api/health/db/route.ts
    src/lib/cache.ts
    src/sw.ts  src/app/manifest.ts  src/lib/analytics.tsx   [opcionales]
  apps/landing/                    [opcional] Astro
```

---

### Task 1: Prerrequisitos y base del monorepo

**Files:**
- Modify: `~/dev/personal/dotfiles/modules/home.nix` (agregar `pnpm` a `home.packages`)
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.gitignore`, `packages/config/package.json`, `packages/config/tsconfig/base.json`, `packages/config/tsconfig/nextjs.json`, `scripts/tsconfig.json`, `eslint.config.ts`, `vitest.config.ts`, `vitest.setup.ts`, `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md`
- Test: `packages/config/src/harness.test.ts`

**Interfaces:**
- Produces: scripts raíz `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; tsconfig `@repo/config/tsconfig/base.json` y `@repo/config/tsconfig/nextjs.json`; alias de Vitest `@/` → `apps/web/src`.

- [ ] **Step 1: Node 24 y pnpm en la máquina**

Node se maneja con nvm (ver `modules/home.nix` línea ~59). pnpm es un CLI: va en `home.packages`.

```bash
nvm install 24 && nvm alias default 24
```

En `~/dev/personal/dotfiles/modules/home.nix`, dentro de `home.packages`, agregar:

```nix
    pnpm
```

Pedir a Juan que corra:

```bash
sudo darwin-rebuild switch --flake ~/dev/personal/dotfiles#EPCOBOTW012E
```

Verificar: `node -v` → `v24.x`, `pnpm -v` → `10.x`. Anotar la versión exacta de pnpm para el Step 2.

- [ ] **Step 2: Archivos raíz**

`package.json` (reemplazar `10.x.y` por la salida de `pnpm -v`):

```json
{
  "name": "starter-next-auth",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.x.y",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "turbo run dev --filter=web",
    "build": "turbo run build",
    "lint": "eslint .",
    "typecheck": "turbo run typecheck && tsc -p scripts --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "brand-lint": "node scripts/brand-lint.ts",
    "check-migrations": "node scripts/check-migrations.ts",
    "bootstrap": "node scripts/setup.ts",
    "db:up": "docker compose -f docker-compose.local.yaml up -d --wait",
    "db:generate": "pnpm --filter @repo/db db:generate",
    "db:migrate": "pnpm --filter @repo/db db:migrate",
    "db:studio": "pnpm --filter @repo/db db:studio",
    "db:seed:dev": "pnpm --filter @repo/auth db:seed:dev",
    "db:dump": "pnpm --filter @repo/db db:dump",
    "db:restore": "pnpm --filter @repo/db db:restore"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "dotenv": "^17.2.3",
    "esbuild": "^0.25.0",
    "eslint": "^9.39.5",
    "eslint-config-next": "^16.3.4",
    "jiti": "^2.4.0",
    "tsx": "^4.21.0",
    "turbo": "^2.5.0",
    "typescript": "^5.9.0",
    "vitest": "^4.1.2"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"

# pnpm 10 no corre scripts de instalación salvo que se permitan aquí.
# esbuild y sharp los necesitan para bajar su binario nativo.
onlyBuiltDependencies:
  - esbuild
  - sharp
```

`turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": ["SKIP_ENV_VALIDATION", "NEXT_PUBLIC_*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**", "public/sw.js"]
    },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

`.nvmrc`:

```
24
```

`.gitignore`:

```
node_modules/
.next/
.turbo/
dist/
out/
coverage/
*.tsbuildinfo
next-env.d.ts
.env
.env.*
!.env.example
apps/web/public/sw.js
db-dumps/
.DS_Store
```

- [ ] **Step 3: Paquete de configuración compartida**

`packages/config/package.json`:

```json
{
  "name": "@repo/config",
  "private": true,
  "type": "module",
  "exports": {
    "./tsconfig/base.json": "./tsconfig/base.json",
    "./tsconfig/nextjs.json": "./tsconfig/nextjs.json"
  }
}
```

`packages/config/tsconfig/base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node"]
  }
}
```

`packages/config/tsconfig/nextjs.json`:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "allowJs": false,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

`scripts/tsconfig.json` (lo que exige el type stripping nativo de Node):

```json
{
  "extends": "../packages/config/tsconfig/base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "rewriteRelativeImportExtensions": true
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 4: ESLint y Vitest**

`eslint.config.ts`:

```ts
// ESLint en flat config. Next 16 ya no lintea en `next build`: se corre aparte con `pnpm lint`.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      // `_` marca lo que se descarta a propósito.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/out/**",
    "**/next-env.d.ts",
    "apps/web/public/sw.js",
    "apps/landing/**",
    "packages/db/migrations/**",
  ]),
]);
```

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

// Un solo runner para todo el monorepo: los tests viven junto al código (`*.test.ts`).
export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/*/src/**/*.test.{ts,tsx}",
      "apps/web/src/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
    // Los tests de integración comparten una base: se corren en serie.
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "apps/web/src") },
  },
});
```

`vitest.setup.ts` (en esta tarea solo los mocks; la base de test llega en Task 3):

```ts
import { vi } from "vitest";

// `server-only` lanza fuera de un bundle de servidor de Next; en tests no aplica.
vi.mock("server-only", () => ({}));

// Fuera de un request de Next, `revalidateTag` lanza y `unstable_cache` no tiene almacén.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn(<T>(fn: T) => fn),
}));
```

- [ ] **Step 5: Test que prueba el harness**

`packages/config/src/harness.test.ts`:

```ts
import { describe, expect, it } from "vitest";

// Prueba mínima de que Vitest corre desde la raíz del monorepo.
describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Claude y reglas del repo**

`.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "ui-ux-pro-max@ui-ux-pro-max-skill": true
  },
  "extraKnownMarketplaces": {
    "ui-ux-pro-max-skill": {
      "source": { "source": "github", "repo": "nextlevelbuilder/ui-ux-pro-max-skill" }
    }
  }
}
```

`CLAUDE.md`:

```
@AGENTS.md
```

`AGENTS.md` (versión inicial; Task 15 la completa):

```markdown
# starter-next-auth

Plantilla para arrancar ideas: Next 16 + Better Auth (Google) + Postgres (Drizzle) en un
monorepo pnpm/Turborepo. Ver `README.md` para arrancar.

## Reglas duras

- **Todo es TypeScript.** Nada de `.js`/`.mjs` a mano. PostCSS va en `postcss.config.json`.
- **Código en inglés, comentarios en español.** El copy que ve el usuario va en español.
- Los scripts de `scripts/` corren con `node scripts/x.ts`: solo sintaxis borrable (sin
  `enum`, `namespace` ni parameter properties) e imports relativos con `.ts`.
- **Cada página protegida llama a su guard** (`requireUser`, `requireCompletedProfile`,
  `requireAdmin`). Los layouts no protegen. `proxy.ts` es solo una redirección optimista.
- **Migraciones solo aditivas.** Nunca edites ni borres un `.sql` de
  `packages/db/migrations/`: agrega uno nuevo.
- `next build` nunca toca Postgres.
- Colores solo por tokens (`packages/ui/src/styles/globals.css`); `pnpm brand-lint` lo exige.
```

- [ ] **Step 7: Instalar y verificar**

```bash
pnpm install
pnpm test
pnpm lint
```

Expected: `pnpm test` → 1 passed. `pnpm lint` → sin errores.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: base del monorepo (pnpm, turbo, tsconfig, eslint, vitest)"
```

---

### Task 2: `@repo/env`

**Files:**
- Create: `packages/env/package.json`, `packages/env/tsconfig.json`, `packages/env/src/index.ts`, `.env.example`
- Test: `packages/env/src/index.test.ts`

**Interfaces:**
- Produces:
  - `required(name: string): string` — lanza `Error("Falta la variable de entorno <name>")` si falta o está vacía; devuelve `""` si `SKIP_ENV_VALIDATION === "1"`.
  - `optional(name: string): string | undefined`
  - `env` con getters perezosos: `databaseUrl`, `betterAuthSecret`, `betterAuthUrl`, `googleClientId` y `googleClientSecret` (`string | undefined`), `adminEmails` (string crudo, puede ser `""`), `nodeEnv`.

- [ ] **Step 1: Paquete**

`packages/env/package.json`:

```json
{
  "name": "@repo/env",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" },
  "devDependencies": { "@repo/config": "workspace:*" }
}
```

`packages/env/tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/base.json",
  "include": ["src"]
}
```

- [ ] **Step 2: Test que falla**

`packages/env/src/index.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { env, optional, required } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("required", () => {
  it("returns the value when present", () => {
    vi.stubEnv("SOME_VAR", "value");
    expect(required("SOME_VAR")).toBe("value");
  });

  it("throws in Spanish when missing", () => {
    vi.stubEnv("SOME_VAR", "");
    expect(() => required("SOME_VAR")).toThrow("Falta la variable de entorno SOME_VAR");
  });

  it("returns empty string when SKIP_ENV_VALIDATION=1", () => {
    vi.stubEnv("SOME_VAR", "");
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    expect(required("SOME_VAR")).toBe("");
  });
});

describe("optional", () => {
  it("returns undefined for empty values", () => {
    vi.stubEnv("SOME_VAR", "");
    expect(optional("SOME_VAR")).toBeUndefined();
  });
});

describe("env", () => {
  it("reads lazily on each access", () => {
    vi.stubEnv("DATABASE_URL", "postgres://a");
    expect(env.databaseUrl).toBe("postgres://a");
    vi.stubEnv("DATABASE_URL", "postgres://b");
    expect(env.databaseUrl).toBe("postgres://b");
  });

  it("defaults BETTER_AUTH_URL to localhost", () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(env.betterAuthUrl).toBe("http://localhost:3000");
  });

  it("allows empty ADMIN_EMAILS", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(env.adminEmails).toBe("");
  });
});
```

- [ ] **Step 3: Verificar que falla**

Run: `pnpm vitest run packages/env`
Expected: FAIL — `Failed to resolve import "./index"`.

- [ ] **Step 4: Implementación**

`packages/env/src/index.ts`:

```ts
// Variables de entorno del núcleo. Se leen en cada acceso (getters) para que los tests
// puedan cambiarlas y para que importar este módulo nunca falle por sí solo.

export function required(name: string): string {
  const value = process.env[name];
  if (value) return value;
  // En `next build` no hay secretos: el build corre con SKIP_ENV_VALIDATION=1.
  if (process.env.SKIP_ENV_VALIDATION === "1") return "";
  throw new Error(`Falta la variable de entorno ${name}`);
}

export function optional(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get betterAuthSecret() {
    return required("BETTER_AUTH_SECRET");
  },
  get betterAuthUrl() {
    return optional("BETTER_AUTH_URL") ?? "http://localhost:3000";
  },
  // Opcionales aquí: en desarrollo se puede entrar sin Google (login de dev). En
  // producción los exige packages/auth/src/server.ts.
  get googleClientId() {
    return optional("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return optional("GOOGLE_CLIENT_SECRET");
  },
  // Lista separada por comas; vacía significa que nadie nace admin.
  get adminEmails() {
    return process.env.ADMIN_EMAILS ?? "";
  },
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
};
```

- [ ] **Step 5: Verificar que pasa**

Run: `pnpm vitest run packages/env`
Expected: PASS (7 tests).

- [ ] **Step 6: `.env.example`**

```bash
# Base de datos (docker-compose.local.yaml)
DATABASE_URL=postgres://starter:starter@localhost:5432/starter_next_auth
POSTGRES_PORT=5432

# Better Auth — genera el secreto con: openssl rand -base64 32
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth (console.cloud.google.com → Credentials → OAuth client ID, tipo Web)
#   Origen:   http://localhost:3000
#   Redirect: http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Correos que nacen admin (separados por coma). Solo aplica al crear la cuenta.
ADMIN_EMAILS=
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(env): variables de entorno fail-fast con getters perezosos"
```

---
### Task 3: `@repo/db` — Postgres local, schema, cliente y migraciones con lock

**Files:**
- Create: `docker-compose.local.yaml`, `vitest.global-setup.ts`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`
- Create: `packages/db/src/test-url.ts`, `packages/db/src/lock-key.ts`, `packages/db/src/schema/auth.ts`, `packages/db/src/schema/app.ts`, `packages/db/src/schema/index.ts`, `packages/db/src/client.ts`, `packages/db/src/migrate.ts`, `packages/db/src/cli/load-env.ts`, `packages/db/src/cli/migrate.ts`, `packages/db/src/cli/dump.ts`, `packages/db/src/cli/restore.ts`
- Create (generado): `packages/db/migrations/0000_init.sql` + `packages/db/migrations/meta/*`
- Modify: `vitest.config.ts` (globalSetup), `vitest.setup.ts` (base de test y variables por defecto)
- Test: `packages/db/src/test-url.test.ts`, `packages/db/src/migrate.test.ts`

**Interfaces:**
- Consumes: `env.databaseUrl`, `env.nodeEnv` de `@repo/env`.
- Produces:
  - `@repo/db` → `db` (Drizzle con schema), `type Db`, `schema`, re-exports `eq`, `and`, `or`, `sql`, `desc`, `asc` de `drizzle-orm`.
  - `@repo/db/schema` → tablas `user`, `session`, `account`, `verification` (user incluye `role`, `banned`, `banReason`, `banExpires`, `profileCompleted`).
  - `@repo/db/migrate` → `runMigrations(opts: { databaseUrl: string; migrationsFolder?: string }): Promise<void>`, `DEFAULT_MIGRATIONS_FOLDER: string`.
  - `@repo/db/test-url` → `toTestDatabaseUrl(url: string): string`, `LOCAL_DATABASE_URL: string`.
  - `MIGRATION_LOCK_KEY: number` en `packages/db/src/lock-key.ts` (Task 14 lo reescribe).
  - En tests: `process.env.DATABASE_URL` apunta a `<db>_test`, ya migrada.

- [ ] **Step 1: Postgres local**

`docker-compose.local.yaml`:

```yaml
# Postgres para desarrollo y tests. `pnpm db:up` lo levanta y espera a que esté sano.
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: starter
      POSTGRES_PASSWORD: starter
      POSTGRES_DB: starter_next_auth
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U starter -d starter_next_auth"]
      interval: 2s
      timeout: 3s
      retries: 20

volumes:
  pgdata:
```

Run: `cp .env.example .env && pnpm db:up`
Expected: `Container ... Healthy`.

- [ ] **Step 2: Paquete**

`packages/db/package.json`:

```json
{
  "name": "@repo/db",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/client.ts",
    "./schema": "./src/schema/index.ts",
    "./migrate": "./src/migrate.ts",
    "./test-url": "./src/test-url.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/cli/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "db:dump": "tsx src/cli/dump.ts",
    "db:restore": "tsx src/cli/restore.ts"
  },
  "dependencies": {
    "@repo/env": "workspace:*",
    "drizzle-orm": "^0.45.1",
    "postgres": "^3.4.8"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "dotenv": "^17.2.3",
    "drizzle-kit": "^0.31.8",
    "tsx": "^4.21.0"
  }
}
```

`packages/db/tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/base.json",
  "include": ["src", "drizzle.config.ts"]
}
```

`packages/db/src/cli/load-env.ts`:

```ts
import path from "node:path";
import { config } from "dotenv";

// Los CLIs del paquete corren con cwd = packages/db; el .env vive en la raíz del monorepo.
config({ path: path.resolve(import.meta.dirname, "../../../../.env"), quiet: true });
```

`packages/db/drizzle.config.ts`:

```ts
import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: path.resolve(import.meta.dirname, "../../.env"), quiet: true });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 3: Test de `toTestDatabaseUrl` (falla)**

`packages/db/src/test-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toTestDatabaseUrl } from "./test-url";

describe("toTestDatabaseUrl", () => {
  it("appends _test to the database name", () => {
    expect(toTestDatabaseUrl("postgres://u:p@localhost:5432/app")).toBe(
      "postgres://u:p@localhost:5432/app_test",
    );
  });

  it("keeps query params", () => {
    expect(toTestDatabaseUrl("postgres://u:p@h:5432/app?sslmode=disable")).toBe(
      "postgres://u:p@h:5432/app_test?sslmode=disable",
    );
  });

  it("is idempotent", () => {
    const once = toTestDatabaseUrl("postgres://u:p@h/app");
    expect(toTestDatabaseUrl(once)).toBe(once);
  });

  it("rejects a URL without database name", () => {
    expect(() => toTestDatabaseUrl("postgres://u:p@h:5432/")).toThrow(
      "DATABASE_URL no trae nombre de base de datos",
    );
  });
});
```

Run: `pnpm vitest run packages/db/src/test-url.test.ts`
Expected: FAIL — no se resuelve `./test-url`.

- [ ] **Step 4: Implementación**

`packages/db/src/test-url.ts`:

```ts
// Valor de .env.example; setup.ts lo renombra junto con el proyecto.
export const LOCAL_DATABASE_URL = "postgres://starter:starter@localhost:5432/starter_next_auth";

// Los tests corren contra <base>_test para no tocar nunca la base de desarrollo.
export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, "");
  if (!name) throw new Error("DATABASE_URL no trae nombre de base de datos");
  if (name.endsWith("_test")) return url;
  parsed.pathname = `/${name}_test`;
  return parsed.toString();
}
```

Run: `pnpm vitest run packages/db/src/test-url.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Schema**

`packages/db/src/schema/auth.ts`:

```ts
// Tablas de Better Auth (núcleo + plugin admin) y el campo propio `profileCompleted`.
// Si cambias campos aquí, revisa `additionalFields` en packages/auth/src/server.ts.
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  role: text("role").default("user").notNull(),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  profileCompleted: boolean("profile_completed").default(false).notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
```

`packages/db/src/schema/app.ts`:

```ts
// Tablas propias de la idea. Ejemplo:
//
// import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
// import { user } from "./auth";
//
// export const note = pgTable("note", {
//   id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
//   userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
//   body: text("body").notNull(),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
// });
//
// Después: `pnpm db:generate` y commit del SQL generado.
export {};
```

`packages/db/src/schema/index.ts`:

```ts
export * from "./auth";
export * from "./app";
```

- [ ] **Step 6: Cliente**

`packages/db/src/client.ts`:

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@repo/env";
import * as schema from "./schema";

// En desarrollo, el hot reload de Next reevalúa módulos: se reutiliza el pool para no
// agotar conexiones. postgres.js no abre sockets hasta la primera consulta.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const client = globalForDb.pgClient ?? postgres(env.databaseUrl, { max: 10 });
if (env.nodeEnv !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
export { and, asc, desc, eq, or, sql } from "drizzle-orm";
```

- [ ] **Step 7: Lock y migrador**

`packages/db/src/lock-key.ts`:

```ts
// Clave del pg_advisory_lock que serializa las migraciones entre réplicas.
// setup.ts la deriva del nombre del proyecto; no debe cambiar entre despliegues.
export const MIGRATION_LOCK_KEY = 1_918_273_645;
```

`packages/db/src/migrate.ts`:

```ts
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { MIGRATION_LOCK_KEY } from "./lock-key";

export const DEFAULT_MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, "../migrations");

// Aplica las migraciones pendientes. Si dos contenedores arrancan a la vez, el segundo
// espera el lock y luego no encuentra nada pendiente.
export async function runMigrations(opts: {
  databaseUrl: string;
  migrationsFolder?: string;
}): Promise<void> {
  const client = postgres(opts.databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await client`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migrate(drizzle(client), {
        migrationsFolder: opts.migrationsFolder ?? DEFAULT_MIGRATIONS_FOLDER,
      });
    } finally {
      await client`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
  } finally {
    await client.end();
  }
}
```

- [ ] **Step 8: Generar la migración inicial**

Run: `pnpm db:generate --name init`
Expected: se crea `packages/db/migrations/0000_init.sql` con `CREATE TABLE "user"`, `"session"`, `"account"`, `"verification"`, y `packages/db/migrations/meta/`.

- [ ] **Step 9: Base de test global**

`vitest.global-setup.ts`:

```ts
import { config } from "dotenv";
import postgres from "postgres";
import { runMigrations } from "./packages/db/src/migrate.ts";
import { LOCAL_DATABASE_URL, toTestDatabaseUrl } from "./packages/db/src/test-url.ts";

// Crea <base>_test desde cero y la migra una vez por corrida de Vitest.
export default async function setup() {
  config({ quiet: true });
  const testUrl = toTestDatabaseUrl(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
  const target = new URL(testUrl);
  const dbName = target.pathname.slice(1);
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";

  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  await runMigrations({ databaseUrl: testUrl });

  return async () => {
    const cleanup = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
    await cleanup.unsafe(`drop database if exists "${dbName}" with (force)`);
    await cleanup.end();
  };
}
```

En `vitest.config.ts`, dentro de `test`, agregar:

```ts
    globalSetup: ["./vitest.global-setup.ts"],
```

Reemplazar `vitest.setup.ts` completo por:

```ts
import { config } from "dotenv";
import { vi } from "vitest";
import { LOCAL_DATABASE_URL, toTestDatabaseUrl } from "./packages/db/src/test-url.ts";

// Cada worker apunta a la base de test (creada en vitest.global-setup.ts) antes de que
// cualquier test importe @repo/db.
config({ quiet: true });
process.env.DATABASE_URL = toTestDatabaseUrl(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
process.env.BETTER_AUTH_SECRET ||= "test-secret-test-secret-test-secret-00";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";

// `server-only` lanza fuera de un bundle de servidor de Next; en tests no aplica.
vi.mock("server-only", () => ({}));

// Fuera de un request de Next, `revalidateTag` lanza y `unstable_cache` no tiene almacén.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn(<T>(fn: T) => fn),
}));
```

Agregar `postgres` y `drizzle-orm` a las devDependencies raíz (los usa el global setup):

```bash
pnpm add -Dw postgres@^3.4.8 drizzle-orm@^0.45.1
```

- [ ] **Step 10: Test del migrador (falla primero por el lock)**

`packages/db/src/migrate.test.ts`:

```ts
import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";

// Cada test usa una base propia y desechable, distinta de la base de test compartida.
const baseUrl = new URL(process.env.DATABASE_URL!);
const scratchName = `${baseUrl.pathname.slice(1)}_migrate`;
const scratchUrl = new URL(baseUrl);
scratchUrl.pathname = `/${scratchName}`;
const adminUrl = new URL(baseUrl);
adminUrl.pathname = "/postgres";

async function adminQuery(query: string) {
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(query);
  } finally {
    await admin.end();
  }
}

async function appliedCount(): Promise<number> {
  const client = postgres(scratchUrl.toString(), { max: 1 });
  try {
    const rows = await client`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return rows[0]!.n as number;
  } finally {
    await client.end();
  }
}

beforeEach(async () => {
  await adminQuery(`drop database if exists "${scratchName}" with (force)`);
  await adminQuery(`create database "${scratchName}"`);
});

afterEach(async () => {
  await adminQuery(`drop database if exists "${scratchName}" with (force)`);
});

describe("runMigrations", () => {
  it("creates the auth tables", async () => {
    await runMigrations({ databaseUrl: scratchUrl.toString() });
    const client = postgres(scratchUrl.toString(), { max: 1 });
    const rows = await client`select to_regclass('public.user') as t`;
    await client.end();
    expect(rows[0]!.t).toBe("user");
  });

  it("is idempotent", async () => {
    await runMigrations({ databaseUrl: scratchUrl.toString() });
    const first = await appliedCount();
    await runMigrations({ databaseUrl: scratchUrl.toString() });
    expect(await appliedCount()).toBe(first);
  });

  it("is safe when two processes migrate at the same time", async () => {
    await Promise.all([
      runMigrations({ databaseUrl: scratchUrl.toString() }),
      runMigrations({ databaseUrl: scratchUrl.toString() }),
    ]);
    expect(await appliedCount()).toBeGreaterThan(0);
  });
});
```

Para ver que el test de concurrencia prueba algo, comentar temporalmente las dos líneas de `pg_advisory_lock`/`pg_advisory_unlock` en `migrate.ts` y correr:

Run: `pnpm vitest run packages/db/src/migrate.test.ts`
Expected: FAIL en "is safe when two processes migrate at the same time" (error de relación duplicada o de llave duplicada). Si pasa igual sin lock, anotarlo en el reporte de la tarea: el test sigue siendo válido como regresión.

Restaurar las líneas del lock.

- [ ] **Step 11: Verificar que pasa**

Run: `pnpm vitest run packages/db`
Expected: PASS (7 tests).

- [ ] **Step 12: CLIs de base de datos**

`packages/db/src/cli/migrate.ts`:

```ts
import "./load-env";
import { env } from "@repo/env";
import { runMigrations } from "../migrate";

await runMigrations({ databaseUrl: env.databaseUrl });
console.log("Migraciones aplicadas.");
```

`packages/db/src/cli/dump.ts`:

```ts
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
```

`packages/db/src/cli/restore.ts`:

```ts
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
```

Run: `pnpm db:migrate`
Expected: `Migraciones aplicadas.`

- [ ] **Step 13: Typecheck y commit**

Run: `pnpm typecheck`
Expected: sin errores.

```bash
git add -A
git commit -m "feat(db): Postgres local, schema de auth, migraciones con advisory lock"
```

---

### Task 4: Check de migraciones aditivas

**Files:**
- Create: `scripts/check-migrations.ts`
- Test: `scripts/check-migrations.test.ts`

**Interfaces:**
- Produces:
  - `type Change = { status: "A" | "M" | "D" | "R"; path: string; newPath?: string }`
  - `parseNameStatus(output: string): Change[]`
  - `checkMigrations(changes: Change[], readFile: (path: string) => string): string[]` (lista de errores; vacía = OK)
  - CLI: `node scripts/check-migrations.ts [baseRef]` (por defecto `origin/main`), sale con 1 si hay errores.

- [ ] **Step 1: Test que falla**

`scripts/check-migrations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkMigrations, parseNameStatus } from "./check-migrations.ts";

const DIR = "packages/db/migrations";
const files: Record<string, string> = {
  [`${DIR}/0001_add.sql`]: `ALTER TABLE "user" ADD COLUMN "phone" text;`,
  [`${DIR}/0002_drop.sql`]: `ALTER TABLE "user" DROP COLUMN "phone";`,
  [`${DIR}/0003_drop_ok.sql`]: `-- allow-destructive: columna sin uso desde v2\nALTER TABLE "user" DROP COLUMN "phone";`,
  [`${DIR}/0004_rename.sql`]: `ALTER TABLE "user" RENAME COLUMN "a" TO "b";`,
  [`${DIR}/0005_type.sql`]: `ALTER TABLE "user" ALTER COLUMN "age" SET DATA TYPE bigint;`,
  [`${DIR}/0006_drop_table.sql`]: `DROP TABLE "old";`,
};
const read = (p: string) => files[p] ?? "";

describe("parseNameStatus", () => {
  it("parses added, modified, deleted and renamed entries", () => {
    const out = [
      `A\t${DIR}/0001_add.sql`,
      `M\t${DIR}/0000_init.sql`,
      `D\t${DIR}/0000_old.sql`,
      `R100\t${DIR}/0000_a.sql\t${DIR}/0000_b.sql`,
      "",
    ].join("\n");
    expect(parseNameStatus(out)).toEqual([
      { status: "A", path: `${DIR}/0001_add.sql` },
      { status: "M", path: `${DIR}/0000_init.sql` },
      { status: "D", path: `${DIR}/0000_old.sql` },
      { status: "R", path: `${DIR}/0000_a.sql`, newPath: `${DIR}/0000_b.sql` },
    ]);
  });
});

describe("checkMigrations", () => {
  it("accepts a new additive migration", () => {
    expect(checkMigrations([{ status: "A", path: `${DIR}/0001_add.sql` }], read)).toEqual([]);
  });

  it("ignores drizzle metadata changes", () => {
    expect(
      checkMigrations([{ status: "M", path: `${DIR}/meta/_journal.json` }], read),
    ).toEqual([]);
  });

  it.each(["M", "D"] as const)("rejects status %s on an existing migration", (status) => {
    const errors = checkMigrations([{ status, path: `${DIR}/0000_init.sql` }], read);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("0000_init.sql");
  });

  it("rejects a renamed migration", () => {
    const errors = checkMigrations(
      [{ status: "R", path: `${DIR}/0000_a.sql`, newPath: `${DIR}/0000_b.sql` }],
      read,
    );
    expect(errors).toHaveLength(1);
  });

  it.each(["0002_drop.sql", "0004_rename.sql", "0005_type.sql", "0006_drop_table.sql"])(
    "rejects destructive SQL in %s",
    (name) => {
      const errors = checkMigrations([{ status: "A", path: `${DIR}/${name}` }], read);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("allow-destructive");
    },
  );

  it("accepts destructive SQL with an explicit reason", () => {
    expect(checkMigrations([{ status: "A", path: `${DIR}/0003_drop_ok.sql` }], read)).toEqual([]);
  });

  it("ignores files outside the migrations folder", () => {
    expect(checkMigrations([{ status: "D", path: "apps/web/x.sql" }], read)).toEqual([]);
  });
});
```

Run: `pnpm vitest run scripts/check-migrations.test.ts`
Expected: FAIL — no se resuelve `./check-migrations.ts`.

- [ ] **Step 2: Implementación**

`scripts/check-migrations.ts`:

```ts
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
```

- [ ] **Step 3: Verificar**

Run: `pnpm vitest run scripts/check-migrations.test.ts && tsc -p scripts --noEmit`
Expected: PASS (12 tests) y typecheck limpio.

Run: `node scripts/check-migrations.ts HEAD`
Expected: `Migraciones OK: solo cambios aditivos.` (sin diferencias contra sí mismo; prueba que Node ejecuta el `.ts` directo).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ci): check de migraciones solo aditivas"
```

---
### Task 5: `@repo/auth` — Better Auth, roles, guards y login de desarrollo

**Files:**
- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`
- Create: `packages/auth/src/roles.ts`, `api-error.ts`, `safe-next.ts`, `access.ts`, `dev-login.ts`, `server.ts`, `session.ts`, `guards.ts`, `client.ts`, `cli/seed-dev.ts`
- Test: `packages/auth/src/roles.test.ts`, `api-error.test.ts`, `safe-next.test.ts`, `access.test.ts`, `dev-login.test.ts`, `server.test.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `eq` de `@repo/db`; `env`, `optional`, `required` de `@repo/env`.
- Produces:
  - `@repo/auth/roles` → `ROLES`, `type Role = "admin" | "user"`, `isRole(value: unknown): value is Role`, `parseAdminEmails(raw: string): string[]`, `roleForEmail(email: string, adminEmails: string[]): Role`
  - `@repo/auth/api-error` → `class ApiError(message: string, status: number)`, `handleApiError(error: unknown): Response`
  - `@repo/auth/safe-next` → `safeNext(next: string | null | undefined, fallback?: string): string` (fallback por defecto `"/app"`)
  - `@repo/auth/access` → `type SessionUser = { id: string; email: string; name: string; image: string | null; role: Role; banned: boolean; profileCompleted: boolean }`, `type Requirement = "user" | "completed-profile" | "admin"`, `type AccessDecision = { ok: true } | { ok: false; status: 401 | 403; redirectTo: string }`, `decideAccess(user: SessionUser | null, requirement: Requirement, currentPath?: string): AccessDecision`
  - `@repo/auth/dev-login` → `isDevLoginEnabled(nodeEnv?: string): boolean`, `DEV_PASSWORD = "starter-dev"`, `DEV_USERS: { email: string; name: string; role: Role }[]`
  - `@repo/auth/server` → `auth` (instancia Better Auth), `type AuthSession`, `isGoogleConfigured(): boolean`
  - `@repo/auth/session` → `getSessionUser(): Promise<SessionUser | null>`
  - `@repo/auth/guards` → `requireUser(path?)`, `requireCompletedProfile(path?)`, `requireAdmin(path?)` (páginas, `Promise<SessionUser>`, redirigen) y `requireApi(requirement: Requirement): Promise<SessionUser>` (lanza `ApiError`)
  - `@repo/auth/client` → `authClient`, `signIn`, `signOut`, `useSession`

- [ ] **Step 1: Paquete**

`packages/auth/package.json`:

```json
{
  "name": "@repo/auth",
  "private": true,
  "type": "module",
  "exports": {
    "./roles": "./src/roles.ts",
    "./api-error": "./src/api-error.ts",
    "./safe-next": "./src/safe-next.ts",
    "./access": "./src/access.ts",
    "./dev-login": "./src/dev-login.ts",
    "./server": "./src/server.ts",
    "./session": "./src/session.ts",
    "./guards": "./src/guards.ts",
    "./client": "./src/client.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "db:seed:dev": "tsx src/cli/seed-dev.ts"
  },
  "dependencies": {
    "@repo/db": "workspace:*",
    "@repo/env": "workspace:*",
    "better-auth": "^1.7.1",
    "server-only": "^0.0.1"
  },
  "peerDependencies": {
    "next": "^16.3.3",
    "react": "^19.2.4"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@types/react": "^19.2.14",
    "dotenv": "^17.2.3",
    "next": "^16.3.3",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "tsx": "^4.21.0"
  }
}
```

`packages/auth/tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/base.json",
  "compilerOptions": { "lib": ["ES2023", "DOM"] },
  "include": ["src"]
}
```

Run: `pnpm install`

- [ ] **Step 2: Tests puros (fallan)**

`packages/auth/src/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isRole, parseAdminEmails, roleForEmail } from "./roles";

describe("parseAdminEmails", () => {
  it("normalizes case, spaces and empty entries", () => {
    expect(parseAdminEmails(" Ana@Example.com, ,bob@example.com ,")).toEqual([
      "ana@example.com",
      "bob@example.com",
    ]);
  });

  it("returns an empty list for an empty string", () => {
    expect(parseAdminEmails("")).toEqual([]);
  });
});

describe("roleForEmail", () => {
  const admins = parseAdminEmails("ana@example.com");

  it("matches ignoring case and surrounding spaces", () => {
    expect(roleForEmail("  ANA@example.com ", admins)).toBe("admin");
  });

  it("defaults to user", () => {
    expect(roleForEmail("otro@example.com", admins)).toBe("user");
  });

  it("makes nobody admin when the list is empty", () => {
    expect(roleForEmail("ana@example.com", [])).toBe("user");
  });
});

describe("isRole", () => {
  it("accepts only known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("user")).toBe(true);
    expect(isRole("root")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
```

`packages/auth/src/api-error.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ApiError, handleApiError } from "./api-error";

describe("handleApiError", () => {
  it("maps ApiError to its status and message", async () => {
    const res = handleApiError(new ApiError("Acceso denegado", 403));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Acceso denegado" });
  });

  it("hides unknown errors behind a 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleApiError(new Error("detalle interno"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

`packages/auth/src/safe-next.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/app", "/app/settings", "/admin/users?page=2", "/onboarding"])(
    "keeps internal path %s",
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/api/auth/sign-out",
    "/app/../api/x",
    "javascript:alert(1)",
    "/app\n/x",
  ])("falls back for unsafe value %s", (value) => {
    expect(safeNext(value)).toBe("/app");
  });

  it("uses a custom fallback", () => {
    expect(safeNext("//evil.com", "/")).toBe("/");
  });
});
```

`packages/auth/src/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decideAccess, type SessionUser } from "./access";

const base: SessionUser = {
  id: "u1",
  email: "a@example.com",
  name: "Ana",
  image: null,
  role: "user",
  banned: false,
  profileCompleted: true,
};

describe("decideAccess", () => {
  it("sends anonymous users to login keeping the path", () => {
    expect(decideAccess(null, "user", "/app/x")).toEqual({
      ok: false,
      status: 401,
      redirectTo: "/login?next=%2Fapp%2Fx",
    });
  });

  it("sends anonymous users to plain login without a path", () => {
    expect(decideAccess(null, "user")).toEqual({ ok: false, status: 401, redirectTo: "/login" });
  });

  it("blocks banned users on every requirement", () => {
    for (const req of ["user", "completed-profile", "admin"] as const) {
      expect(decideAccess({ ...base, banned: true, role: "admin" }, req)).toEqual({
        ok: false,
        status: 403,
        redirectTo: "/login?error=banned",
      });
    }
  });

  it("lets a user with incomplete profile through the 'user' requirement", () => {
    expect(decideAccess({ ...base, profileCompleted: false }, "user")).toEqual({ ok: true });
  });

  it("sends incomplete profiles to onboarding", () => {
    expect(decideAccess({ ...base, profileCompleted: false }, "completed-profile")).toEqual({
      ok: false,
      status: 403,
      redirectTo: "/onboarding",
    });
  });

  it("requires a completed profile for admins too", () => {
    expect(
      decideAccess({ ...base, role: "admin", profileCompleted: false }, "admin"),
    ).toMatchObject({ ok: false, redirectTo: "/onboarding" });
  });

  it("rejects non-admins from admin", () => {
    expect(decideAccess(base, "admin")).toEqual({ ok: false, status: 403, redirectTo: "/app" });
  });

  it("allows admins", () => {
    expect(decideAccess({ ...base, role: "admin" }, "admin")).toEqual({ ok: true });
  });
});
```

`packages/auth/src/dev-login.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEV_USERS, isDevLoginEnabled } from "./dev-login";

describe("isDevLoginEnabled", () => {
  it("is off in production", () => {
    expect(isDevLoginEnabled("production")).toBe(false);
  });

  it.each(["development", "test"])("is on in %s", (nodeEnv) => {
    expect(isDevLoginEnabled(nodeEnv)).toBe(true);
  });
});

describe("DEV_USERS", () => {
  it("has one admin and one user on a non-routable domain", () => {
    expect(DEV_USERS.map((u) => u.role).sort()).toEqual(["admin", "user"]);
    expect(DEV_USERS.every((u) => u.email.endsWith("@local.test"))).toBe(true);
  });
});
```

Run: `pnpm vitest run packages/auth`
Expected: FAIL — no se resuelven los módulos.

- [ ] **Step 3: Implementación pura**

`packages/auth/src/roles.ts`:

```ts
export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// ADMIN_EMAILS llega como "a@x.com, B@x.com,". Se normaliza a minúsculas sin vacíos.
export function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function roleForEmail(email: string, adminEmails: string[]): Role {
  return adminEmails.includes(email.trim().toLowerCase()) ? "admin" : "user";
}
```

`packages/auth/src/api-error.ts`:

```ts
// Error con status HTTP para route handlers y server actions.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Convierte cualquier error en una respuesta JSON; los desconocidos no filtran detalles.
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Error interno" }, { status: 500 });
}
```

`packages/auth/src/safe-next.ts`:

```ts
// Solo rutas internas de la app: nada absoluto, ni "//host", ni "/\host", ni /api, ni "..".
// Así `?next=` nunca sirve de open redirect.
const INTERNAL_PATH = /^\/(?![/\\])[\w\-./~?=&%]*$/;

export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !INTERNAL_PATH.test(next)) return fallback;
  if (next.includes("..") || next === "/api" || next.startsWith("/api/")) return fallback;
  return next;
}
```

`packages/auth/src/access.ts`:

```ts
import type { Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  banned: boolean;
  profileCompleted: boolean;
};

export type Requirement = "user" | "completed-profile" | "admin";

export type AccessDecision = { ok: true } | { ok: false; status: 401 | 403; redirectTo: string };

// Decisión pura de acceso: la usan tanto los guards de página (redirect) como los de API
// (ApiError). El orden importa: sesión → baneo → perfil → rol.
export function decideAccess(
  user: SessionUser | null,
  requirement: Requirement,
  currentPath?: string,
): AccessDecision {
  if (!user) {
    const redirectTo = currentPath ? `/login?next=${encodeURIComponent(currentPath)}` : "/login";
    return { ok: false, status: 401, redirectTo };
  }
  if (user.banned) return { ok: false, status: 403, redirectTo: "/login?error=banned" };
  if (requirement === "user") return { ok: true };
  if (!user.profileCompleted) return { ok: false, status: 403, redirectTo: "/onboarding" };
  if (requirement === "admin" && user.role !== "admin") {
    return { ok: false, status: 403, redirectTo: "/app" };
  }
  return { ok: true };
}
```

`packages/auth/src/dev-login.ts`:

```ts
import type { Role } from "./roles";

// Atajo para entrar sin credenciales de Google. En producción el único camino es Google.
export function isDevLoginEnabled(nodeEnv: string = process.env.NODE_ENV ?? "development"): boolean {
  return nodeEnv !== "production";
}

export const DEV_PASSWORD = "starter-dev";

// Dominio .test: reservado, nunca enruta correo real.
export const DEV_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@local.test", name: "Admin Local", role: "admin" },
  { email: "user@local.test", name: "Usuario Local", role: "user" },
];
```

Run: `pnpm vitest run packages/auth`
Expected: PASS (todos los tests de roles, api-error, safe-next, access y dev-login).

- [ ] **Step 4: Commit de la parte pura**

```bash
git add -A
git commit -m "feat(auth): roles, decisión de acceso, next seguro y errores de API"
```

- [ ] **Step 5: Test de integración de Better Auth (falla)**

`packages/auth/src/server.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, eq, schema } from "@repo/db";
import { auth } from "./server";

const password = "a-long-test-password";

async function userByEmail(email: string) {
  const [row] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  return row;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.delete(schema.user);
});

describe("auth user creation", () => {
  it("creates admins from ADMIN_EMAILS regardless of case and spaces", async () => {
    vi.stubEnv("ADMIN_EMAILS", " Boss@Example.test , other@example.test");
    await auth.api.signUpEmail({
      body: { email: "boss@example.test", password, name: "Boss" },
    });
    expect((await userByEmail("boss@example.test"))?.role).toBe("admin");
  });

  it("creates regular users with an incomplete profile", async () => {
    vi.stubEnv("ADMIN_EMAILS", "boss@example.test");
    await auth.api.signUpEmail({
      body: { email: "someone@example.test", password, name: "Someone" },
    });
    const row = await userByEmail("someone@example.test");
    expect(row?.role).toBe("user");
    expect(row?.profileCompleted).toBe(false);
  });

  it("does not let sign-up set the role or profileCompleted", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    await auth.api
      .signUpEmail({
        body: {
          email: "sneaky@example.test",
          password,
          name: "Sneaky",
          // @ts-expect-error: campos que el cliente no debe poder fijar
          role: "admin",
          profileCompleted: true,
        },
      })
      .catch(() => undefined);
    const row = await userByEmail("sneaky@example.test");
    if (row) {
      expect(row.role).toBe("user");
      expect(row.profileCompleted).toBe(false);
    }
  });
});
```

Run: `pnpm vitest run packages/auth/src/server.test.ts`
Expected: FAIL — no se resuelve `./server`.

- [ ] **Step 6: Instancia de Better Auth**

`packages/auth/src/server.ts`:

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { db, schema } from "@repo/db";
import { env, required } from "@repo/env";
import { isDevLoginEnabled } from "./dev-login";
import { parseAdminEmails, roleForEmail } from "./roles";

export function isGoogleConfigured(): boolean {
  return !!env.googleClientId && !!env.googleClientSecret;
}

function socialProviders() {
  if (isGoogleConfigured()) {
    return { google: { clientId: env.googleClientId!, clientSecret: env.googleClientSecret! } };
  }
  // En producción Google es el único login: sin credenciales la app no debe arrancar.
  if (env.nodeEnv === "production") {
    required("GOOGLE_CLIENT_ID");
    required("GOOGLE_CLIENT_SECRET");
  }
  return {};
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  emailAndPassword: { enabled: isDevLoginEnabled(env.nodeEnv) },
  socialProviders: socialProviders(),
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    // Sin caché en cookie: completar el onboarding o un baneo deben verse en el acto.
    cookieCache: { enabled: false },
  },
  user: {
    additionalFields: {
      profileCompleted: { type: "boolean", required: false, input: false, defaultValue: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // El rol no se elige: sale de ADMIN_EMAILS al crear la cuenta. Se lee en cada
        // alta para que cambiar la variable no requiera reiniciar.
        before: async (user) => ({
          data: { ...user, role: roleForEmail(user.email, parseAdminEmails(env.adminEmails)) },
        }),
      },
    },
  },
  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
```

- [ ] **Step 7: Verificar**

Run: `pnpm vitest run packages/auth/src/server.test.ts`
Expected: PASS (3 tests).

Si "creates admins from ADMIN_EMAILS" falla con `role` = `"user"` (el plugin `admin` aplica `defaultRole` después de nuestro hook), mover la asignación a `create.after`, que corre cuando la fila ya existe:

```ts
      create: {
        after: async (user) => {
          const role = roleForEmail(user.email, parseAdminEmails(env.adminEmails));
          if (role !== "user") {
            await db.update(schema.user).set({ role }).where(eq(schema.user.id, user.id));
          }
        },
      },
```

(con `import { db, eq, schema } from "@repo/db";`) y volver a correr el test hasta PASS.

- [ ] **Step 8: Sesión, guards y cliente**

`packages/auth/src/session.ts`:

```ts
import "server-only";
import { headers } from "next/headers";
import type { SessionUser } from "./access";
import { isRole } from "./roles";
import { auth } from "./server";

// Usuario de la sesión actual, con los campos que usan los guards y la UI.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role: isRole(u.role) ? u.role : "user",
    banned: Boolean(u.banned),
    profileCompleted: Boolean(u.profileCompleted),
  };
}
```

`packages/auth/src/guards.ts`:

```ts
import "server-only";
import { redirect } from "next/navigation";
import { decideAccess, type Requirement, type SessionUser } from "./access";
import { ApiError } from "./api-error";
import { getSessionUser } from "./session";

// Guards de página: cada page.tsx protegida llama al suyo. Los layouts no protegen nada.
async function requirePage(requirement: Requirement, currentPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  const decision = decideAccess(user, requirement, currentPath);
  if (!decision.ok) redirect(decision.redirectTo);
  return user!;
}

export const requireUser = (currentPath?: string) => requirePage("user", currentPath);
export const requireCompletedProfile = (currentPath?: string) =>
  requirePage("completed-profile", currentPath);
export const requireAdmin = (currentPath?: string) => requirePage("admin", currentPath);

// Guard de route handlers y server actions: lanza ApiError(401|403).
export async function requireApi(requirement: Requirement): Promise<SessionUser> {
  const user = await getSessionUser();
  const decision = decideAccess(user, requirement);
  if (!decision.ok) {
    throw new ApiError(decision.status === 401 ? "No autenticado" : "Acceso denegado", decision.status);
  }
  return user!;
}
```

`packages/auth/src/client.ts`:

```ts
import { adminClient, inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./server";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
```

- [ ] **Step 9: Seed de desarrollo**

`packages/auth/src/cli/seed-dev.ts`:

```ts
import path from "node:path";
import { config } from "dotenv";

config({ path: path.resolve(import.meta.dirname, "../../../../.env"), quiet: true });

const { db, eq, schema } = await import("@repo/db");
const { auth } = await import("../server");
const { DEV_PASSWORD, DEV_USERS, isDevLoginEnabled } = await import("../dev-login");

// Crea los usuarios de desarrollo (idempotente). Nunca en producción.
if (!isDevLoginEnabled()) {
  console.error("db:seed:dev no corre con NODE_ENV=production.");
  process.exit(1);
}

for (const devUser of DEV_USERS) {
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, devUser.email));
  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: devUser.email, password: DEV_PASSWORD, name: devUser.name },
    });
  }
  await db
    .update(schema.user)
    .set({ role: devUser.role, profileCompleted: true, emailVerified: true })
    .where(eq(schema.user.email, devUser.email));
  console.log(`✓ ${devUser.email} (${devUser.role}) — clave: ${DEV_PASSWORD}`);
}
process.exit(0);
```

Run: `pnpm db:seed:dev`
Expected: dos líneas `✓ admin@local.test (admin)` y `✓ user@local.test (user)`. Correrlo otra vez produce la misma salida sin errores.

- [ ] **Step 10: Typecheck, tests y commit**

Run: `pnpm typecheck && pnpm vitest run packages/auth`
Expected: sin errores; todos los tests de `packages/auth` en PASS.

```bash
git add -A
git commit -m "feat(auth): Better Auth con Google, plugin admin, guards y seed de desarrollo"
```

---
### Task 6: `@repo/ui` — shadcn/ui, tokens claro/oscuro y brand-lint

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/components.json`, `packages/ui/src/styles/globals.css`, `packages/ui/src/lib/utils.ts`, `packages/ui/src/components/theme-provider.tsx`, `packages/ui/src/components/theme-toggle.tsx`
- Create (generado por shadcn): `packages/ui/src/components/{button,input,label,card,dialog,dropdown-menu,table,avatar,sonner}.tsx`
- Create: `scripts/brand-lint.ts`
- Test: `scripts/brand-lint.test.ts`

**Interfaces:**
- Produces:
  - `@repo/ui/styles.css` (tokens + `@theme inline`), `@repo/ui/lib/utils` → `cn(...inputs: ClassValue[]): string`
  - `@repo/ui/components/<nombre>` para cada componente shadcn; `@repo/ui/components/theme-provider` → `ThemeProvider`; `@repo/ui/components/theme-toggle` → `ThemeToggle`; `@repo/ui/components/sonner` → `Toaster`
  - `scripts/brand-lint.ts` → `type Violation = { file: string; line: number; text: string }`, `type Exception = { file: string; match: RegExp; reason: string }`, `EXCEPTIONS: Exception[]`, `findViolations(file: string, content: string, exceptions?: Exception[]): Violation[]`; CLI `pnpm brand-lint` (sale con 1 si hay violaciones).

- [ ] **Step 1: Paquete y tokens**

`packages/ui/package.json`:

```json
{
  "name": "@repo/ui",
  "private": true,
  "type": "module",
  "exports": {
    "./styles.css": "./src/styles/globals.css",
    "./lib/*": "./src/lib/*.ts",
    "./components/*": "./src/components/*.tsx"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.540.0",
    "next-themes": "^0.4.6",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.3.1",
    "tw-animate-css": "^1.3.7"
  },
  "peerDependencies": { "react": "^19.2.4", "react-dom": "^19.2.4" },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "react": "^19.2.4",
    "react-dom": "^19.2.4"
  }
}
```

`packages/ui/tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "incremental": false,
    "plugins": [],
    "paths": { "@repo/ui/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

`packages/ui/components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@repo/ui/components",
    "ui": "@repo/ui/components",
    "utils": "@repo/ui/lib/utils",
    "lib": "@repo/ui/lib",
    "hooks": "@repo/ui/hooks"
  }
}
```

`packages/ui/src/styles/globals.css`:

```css
/*
 * Identidad visual de la app: SOLO aquí viven colores. Cambiar de marca = editar estos
 * tokens. Los componentes usan clases (bg-primary, text-muted-foreground…), nunca
 * colores crudos; `pnpm brand-lint` lo exige.
 * Se importa desde apps/web/src/app/globals.css, después de `@import "tailwindcss"`.
 */
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

`packages/ui/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Une clases condicionales y resuelve conflictos de Tailwind (p. ej. "p-2 p-4" → "p-4").
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Run: `pnpm install`

- [ ] **Step 2: Componentes shadcn**

Run:

```bash
pnpm dlx shadcn@latest add button input label card dialog dropdown-menu table avatar sonner --cwd packages/ui --yes
```

Expected: se crean los `.tsx` en `packages/ui/src/components/` importando `@repo/ui/lib/utils`, y se agregan las dependencias de Radix a `packages/ui/package.json`. Si shadcn intenta modificar `globals.css`, revertir ese archivo con `git checkout packages/ui/src/styles/globals.css`.

Run: `pnpm install && pnpm --filter @repo/ui typecheck`
Expected: sin errores.

- [ ] **Step 3: Tema**

`packages/ui/src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

// Modo oscuro por clase `.dark`, siguiendo la preferencia del sistema por defecto.
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    />
  );
}
```

`packages/ui/src/components/theme-toggle.tsx`:

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@repo/ui/components/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <Button variant="ghost" size="icon" aria-label="Cambiar tema" onClick={() => setTheme(next)}>
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
```

- [ ] **Step 4: Test de brand-lint (falla)**

`scripts/brand-lint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findViolations } from "./brand-lint.ts";

describe("findViolations", () => {
  it("accepts token-based classes", () => {
    const code = `export const A = () => <div className="bg-primary text-muted-foreground" />;`;
    expect(findViolations("apps/web/src/a.tsx", code)).toEqual([]);
  });

  it.each([
    `<div style={{ color: "#ff0000" }} />`,
    `<div className="bg-[#123]" />`,
    `const c = "rgb(0, 0, 0)";`,
    `const c = "rgba(0,0,0,.5)";`,
    `const c = "hsl(10 20% 30%)";`,
    `const c = "oklch(0.5 0.1 20)";`,
  ])("flags raw color in %s", (line) => {
    const violations = findViolations("apps/web/src/a.tsx", `const x = 1;\n${line}`);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "apps/web/src/a.tsx", line: 2 });
  });

  it("does not flag anchors that are not hex colors", () => {
    expect(findViolations("apps/web/src/a.tsx", `<a href="#main">Ir</a>`)).toEqual([]);
  });

  it("honors an exception only for its file and pattern", () => {
    const exceptions = [
      { file: "apps/web/src/app/layout.tsx", match: /themeColor/, reason: "meta estático" },
    ];
    const line = `export const viewport = { themeColor: "#ffffff" };`;
    expect(findViolations("apps/web/src/app/layout.tsx", line, exceptions)).toEqual([]);
    expect(findViolations("apps/web/src/other.tsx", line, exceptions)).toHaveLength(1);
    expect(
      findViolations("apps/web/src/app/layout.tsx", `const c = "#000000";`, exceptions),
    ).toHaveLength(1);
  });
});
```

Run: `pnpm vitest run scripts/brand-lint.test.ts`
Expected: FAIL — no se resuelve `./brand-lint.ts`.

- [ ] **Step 5: Implementación**

`scripts/brand-lint.ts`:

```ts
// Piso duro de marca: los colores solo viven como tokens en
// packages/ui/src/styles/globals.css. Este script falla si un .ts/.tsx trae colores
// crudos (hex, rgb/hsl/oklch…). Las excepciones fijan archivo Y patrón de línea, así que
// no sirven de escape general.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type Violation = { file: string; line: number; text: string };
export type Exception = { file: string; match: RegExp; reason: string };

const COLOR_PATTERNS = [
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/,
  /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/,
];

const SCAN_DIRS = ["apps/web/src", "packages/ui/src"];

export const EXCEPTIONS: Exception[] = [
  {
    file: "apps/web/src/app/layout.tsx",
    match: /themeColor/,
    reason: "Viewport.themeColor se emite como <meta> literal: no puede usar var(--token).",
  },
];

export function findViolations(
  file: string,
  content: string,
  exceptions: Exception[] = EXCEPTIONS,
): Violation[] {
  const violations: Violation[] = [];
  content.split("\n").forEach((text, index) => {
    if (!COLOR_PATTERNS.some((pattern) => pattern.test(text))) return;
    const excused = exceptions.some((e) => e.file === file && e.match.test(text));
    if (!excused) violations.push({ file, line: index + 1, text: text.trim() });
  });
  return violations;
}

function listSourceFiles(root: string): string[] {
  return SCAN_DIRS.flatMap((dir) => {
    const abs = path.join(root, dir);
    let entries: string[];
    try {
      entries = readdirSync(abs, { recursive: true, encoding: "utf8" });
    } catch {
      return [];
    }
    return entries
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.posix.join(dir, f.split(path.sep).join("/")));
  });
}

if (import.meta.main) {
  const root = process.cwd();
  const violations = listSourceFiles(root).flatMap((file) =>
    findViolations(file, readFileSync(path.join(root, file), "utf8")),
  );
  if (violations.length === 0) {
    console.log("brand-lint OK: sin colores crudos.");
  } else {
    for (const v of violations) console.error(`${v.file}:${v.line}  ${v.text}`);
    console.error(`\n${violations.length} color(es) crudo(s). Usa tokens de @repo/ui/styles.css.`);
    process.exit(1);
  }
}
```

- [ ] **Step 6: Verificar**

Run: `pnpm vitest run scripts/brand-lint.test.ts && pnpm brand-lint && tsc -p scripts --noEmit`
Expected: tests PASS (9 tests); `brand-lint OK: sin colores crudos.`; typecheck limpio. Si algún componente generado por shadcn trae un color crudo, reemplazarlo por la clase de token equivalente (no agregar excepción).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): shadcn/ui con tokens claro/oscuro y brand-lint"
```

---

### Task 7: `apps/web` — esqueleto, login, proxy y health

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.json`, `apps/web/public/.gitkeep`
- Create: `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/login/page.tsx`, `apps/web/src/components/login-buttons.tsx`
- Create: `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/src/app/api/health/route.ts`, `apps/web/src/app/api/health/db/route.ts`
- Create: `apps/web/src/proxy.ts`, `apps/web/src/lib/cache.ts`
- Test: `apps/web/src/app/api/health/health.test.ts`, `apps/web/src/architecture.test.ts`

**Interfaces:**
- Consumes: `@repo/auth/*` (Task 5), `@repo/ui/*` (Task 6), `@repo/db` (Task 3).
- Produces:
  - Rutas `/`, `/login`, `/api/auth/*`, `/api/health` (liveness, `{ status: "ok" }`), `/api/health/db` (200 `{ status: "ok" }` o 503 `{ status: "error" }`).
  - `@/lib/cache` → `CACHE_TAGS`, `cached(fn, keyParts, tags)`, `invalidate(tag)`.

- [ ] **Step 1: Paquete y configuración**

`apps/web/package.json`:

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/auth": "workspace:*",
    "@repo/db": "workspace:*",
    "@repo/env": "workspace:*",
    "@repo/ui": "workspace:*",
    "better-auth": "^1.7.1",
    "next": "^16.3.3",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@repo/config": "workspace:*",
    "@tailwindcss/postcss": "^4.3.3",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "tailwindcss": "^4.3.3"
  }
}
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/nextjs.json",
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts`:

```ts
import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Monorepo: el tracing del standalone parte de la raíz para incluir packages/*.
  // `next build` corre con cwd = apps/web (turbo/pnpm --filter).
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  // Los paquetes internos se publican como TypeScript fuente.
  transpilePackages: ["@repo/auth", "@repo/db", "@repo/env", "@repo/ui"],
};

export default config;
```

`apps/web/postcss.config.json`:

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

`apps/web/public/.gitkeep`: archivo vacío (Docker copia `public/`, que debe existir).

Run: `pnpm install`

- [ ] **Step 2: Health (tests primero)**

`apps/web/src/app/api/health/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GET as dbHealth } from "./db/route";
import { GET as liveness } from "./route";

describe("health endpoints", () => {
  it("liveness answers without touching the database", async () => {
    const res = liveness();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("db health confirms the migrated schema", async () => {
    const res = await dbHealth();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});
```

Run: `pnpm vitest run apps/web/src/app/api/health`
Expected: FAIL — no se resuelven las rutas.

`apps/web/src/app/api/health/route.ts`:

```ts
// Liveness para Coolify. A propósito NO toca la base: si Postgres se cae, el contenedor
// sigue sano y el orquestador no debe reiniciarlo en falso.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
```

`apps/web/src/app/api/health/db/route.ts`:

```ts
import { db, sql } from "@repo/db";

// Readiness: la base responde y las migraciones corrieron (existe la tabla "user").
// Lo usa el smoke test de la imagen en CI.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1 from "user" limit 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error(error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
```

Run: `pnpm vitest run apps/web/src/app/api/health`
Expected: PASS (2 tests).

- [ ] **Step 3: Test de arquitectura (falla si alguien rompe la frontera cliente/servidor)**

`apps/web/src/architecture.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Un módulo "use client" termina en el navegador: no puede importar la base de datos ni
// la parte de servidor de auth (secretos, conexiones). Este test lo hace explícito.
const ROOT = path.resolve(import.meta.dirname, "../../..");
const SCAN = ["apps/web/src", "packages/ui/src", "packages/auth/src"];
const FORBIDDEN = [/from\s+["']@repo\/db/, /from\s+["']@repo\/auth\/(server|session|guards)["']/];

function clientModules(): string[] {
  return SCAN.flatMap((dir) =>
    readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.join(dir, f))
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(path.join(ROOT, f), "utf8"))),
  );
}

describe("client/server boundary", () => {
  it("finds client modules to check", () => {
    expect(clientModules().length).toBeGreaterThan(0);
  });

  it("client modules never import server-only packages", () => {
    const offenders = clientModules().filter((file) => {
      const content = readFileSync(path.join(ROOT, file), "utf8");
      return FORBIDDEN.some((pattern) => pattern.test(content));
    });
    expect(offenders).toEqual([]);
  });
});
```

Run: `pnpm vitest run apps/web/src/architecture.test.ts`
Expected: PASS (2 tests; los módulos cliente de `packages/ui` ya existen).

- [ ] **Step 4: Rutas de auth, proxy y caché**

`apps/web/src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@repo/auth/server";

export const { GET, POST } = toNextJsHandler(auth.handler);
```

`apps/web/src/proxy.ts`:

```ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Redirección optimista: si no hay cookie de sesión, ni siquiera se renderiza la página.
// NO es la barrera de seguridad (la cookie podría ser vieja o falsa): cada página llama
// a su guard de @repo/auth/guards.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/onboarding"],
};
```

`apps/web/src/lib/cache.ts`:

```ts
import { revalidateTag, unstable_cache } from "next/cache";

// Todo el cacheo de datos de la app vive aquí. Las escrituras llaman a `invalidate` con el
// tag afectado. Las páginas que leen de la base son dinámicas, así `next build` no
// necesita Postgres.
export const CACHE_TAGS = {
  users: "users",
} as const;

export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  tags: string[],
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, keyParts, { tags });
}

export function invalidate(tag: string): void {
  revalidateTag(tag, "max");
}
```

- [ ] **Step 5: Layout y página pública**

`apps/web/src/app/globals.css`:

```css
@import "tailwindcss";
@import "@repo/ui/styles.css";

/* Tailwind debe escanear las clases usadas en los componentes compartidos. */
@source "../../../../packages/ui/src";
```

`apps/web/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "starter-next-auth", template: "%s · starter-next-auth" },
  description: "Una idea nueva, con login de Google desde el primer día.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@repo/auth/session";
import { Button } from "@repo/ui/components/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect(user.profileCompleted ? "/app" : "/onboarding");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">starter-next-auth</h1>
      <p className="text-muted-foreground">Una idea nueva, con login de Google desde el primer día.</p>
      <Button asChild size="lg">
        <Link href="/login">Entrar</Link>
      </Button>
    </main>
  );
}
```

- [ ] **Step 6: Login**

`apps/web/src/components/login-buttons.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "@repo/auth/client";
import { DEV_PASSWORD, DEV_USERS } from "@repo/auth/dev-login";
import { Button } from "@repo/ui/components/button";

type Props = { next: string; googleEnabled: boolean; devLogin: boolean };

export function LoginButtons({ next, googleEnabled, devLogin }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function withGoogle() {
    setPending(true);
    const { error } = await signIn.social({ provider: "google", callbackURL: next });
    if (error) {
      toast.error("No se pudo iniciar sesión con Google.");
      setPending(false);
    }
  }

  // Solo se muestra en desarrollo; en producción el servidor tiene apagado email/clave.
  async function asDevUser(email: string) {
    setPending(true);
    const { error } = await signIn.email({ email, password: DEV_PASSWORD });
    if (error) {
      toast.error("Usuario de desarrollo no encontrado. Corre `pnpm db:seed:dev`.");
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {googleEnabled ? (
        <Button size="lg" onClick={withGoogle} disabled={pending}>
          Entrar con Google
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Google no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
        </p>
      )}
      {devLogin && (
        <div className="mt-4 flex flex-col gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">Solo desarrollo</p>
          {DEV_USERS.map((u) => (
            <Button key={u.email} variant="outline" onClick={() => asDevUser(u.email)} disabled={pending}>
              Entrar como {u.role}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
```

`apps/web/src/app/login/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDevLoginEnabled } from "@repo/auth/dev-login";
import { safeNext } from "@repo/auth/safe-next";
import { isGoogleConfigured } from "@repo/auth/server";
import { getSessionUser } from "@repo/auth/session";
import { LoginButtons } from "@/components/login-buttons";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  const user = await getSessionUser();
  if (user && !user.banned) redirect(target);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {error === "banned" && (
        <p role="alert" className="text-sm text-destructive">
          Tu cuenta está suspendida. Escríbenos si crees que es un error.
        </p>
      )}
      <LoginButtons next={target} googleEnabled={isGoogleConfigured()} devLogin={isDevLoginEnabled()} />
    </main>
  );
}
```

- [ ] **Step 7: Verificar en el navegador**

Run: `pnpm typecheck && pnpm lint && pnpm brand-lint`
Expected: sin errores.

Run: `pnpm dev` y abrir `http://localhost:3000`.
Expected:
- `/` muestra "Entrar"; `/login` muestra el aviso de Google no configurado (si `.env` no trae credenciales) y los botones "Entrar como admin" / "Entrar como user".
- `http://localhost:3000/app` sin sesión redirige a `/login?next=%2Fapp` (proxy).
- `http://localhost:3000/login?next=//evil.com` y luego entrar como user: termina en `/app` (404 por ahora, la página llega en Task 8), nunca en `evil.com`.
- `curl -s localhost:3000/api/health/db` → `{"status":"ok"}`.
- El tema sigue la preferencia del sistema.

- [ ] **Step 8: Build sin base de datos**

Run: `docker compose -f docker-compose.local.yaml stop && SKIP_ENV_VALIDATION=1 pnpm --filter web build && pnpm db:up`
Expected: `next build` termina bien con Postgres apagado.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(web): esqueleto de la app con login, proxy y health"
```

---

### Task 8: Onboarding, `/app` y administración de usuarios

**Files:**
- Create: `apps/web/src/test/factories.ts`
- Create: `apps/web/src/lib/profile.ts`, `apps/web/src/app/onboarding/page.tsx`, `apps/web/src/app/onboarding/actions.ts`, `apps/web/src/app/onboarding/onboarding-form.tsx`
- Create: `apps/web/src/app/app/page.tsx`, `apps/web/src/components/sign-out-button.tsx`
- Create: `apps/web/src/lib/admin-users.ts`, `apps/web/src/app/admin/users/page.tsx`, `apps/web/src/app/admin/users/actions.ts`
- Test: `apps/web/src/lib/profile.test.ts`, `apps/web/src/lib/admin-users.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `requireCompletedProfile`, `requireAdmin` (Task 5); `SessionUser`, `isRole`, `ApiError`; `db`, `schema`, `eq`, `desc`.
- Produces:
  - `@/lib/profile` → `profileSchema`, `completeProfile(userId: string, input: unknown): Promise<{ ok: true } | { ok: false; error: string }>`
  - `@/lib/admin-users` → `type UserRow = { id: string; name: string; email: string; role: string; banned: boolean; createdAt: Date }`, `listUsers(): Promise<UserRow[]>`, `assertCanManage(actor: SessionUser, targetId: string): void`, `setUserRole(actor: SessionUser, targetId: string, role: unknown): Promise<void>`, `setUserBanned(actor: SessionUser, targetId: string, banned: boolean): Promise<void>`
  - `@/test/factories` → `createUser(overrides?: Partial<typeof schema.user.$inferInsert>): Promise<typeof schema.user.$inferSelect>`, `sessionUserFrom(row): SessionUser`

- [ ] **Step 1: Fábrica de datos de test**

`apps/web/src/test/factories.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { SessionUser } from "@repo/auth/access";
import { isRole } from "@repo/auth/roles";
import { db, schema } from "@repo/db";

// Inserta un usuario directo en la base de test (sin pasar por Better Auth).
export async function createUser(overrides: Partial<typeof schema.user.$inferInsert> = {}) {
  const id = randomUUID();
  const [row] = await db
    .insert(schema.user)
    .values({ id, name: "Test", email: `${id}@example.test`, ...overrides })
    .returning();
  return row!;
}

export function sessionUserFrom(row: typeof schema.user.$inferSelect): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.image,
    role: isRole(row.role) ? row.role : "user",
    banned: Boolean(row.banned),
    profileCompleted: row.profileCompleted,
  };
}
```

- [ ] **Step 2: Perfil (test primero)**

`apps/web/src/lib/profile.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { db, eq, schema } from "@repo/db";
import { createUser } from "@/test/factories";
import { completeProfile } from "./profile";

afterEach(async () => {
  await db.delete(schema.user);
});

describe("completeProfile", () => {
  it("saves the trimmed name and marks the profile complete", async () => {
    const user = await createUser({ name: "x" });
    expect(await completeProfile(user.id, { name: "  Ana María  " })).toEqual({ ok: true });
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, user.id));
    expect(row?.name).toBe("Ana María");
    expect(row?.profileCompleted).toBe(true);
  });

  it.each([{ name: "" }, { name: " a " }, { name: "x".repeat(81) }, {}, null])(
    "rejects invalid input %j without touching the user",
    async (input) => {
      const user = await createUser();
      const result = await completeProfile(user.id, input);
      expect(result.ok).toBe(false);
      const [row] = await db.select().from(schema.user).where(eq(schema.user.id, user.id));
      expect(row?.profileCompleted).toBe(false);
    },
  );
});
```

Run: `pnpm vitest run apps/web/src/lib/profile.test.ts`
Expected: FAIL — no se resuelve `./profile`.

`apps/web/src/lib/profile.ts`:

```ts
import "server-only";
import { z } from "zod";
import { db, eq, schema } from "@repo/db";

// Onboarding mínimo: solo el nombre. Cada idea agrega aquí sus campos obligatorios.
export const profileSchema = z.object({
  name: z
    .string({ error: "Escribe tu nombre" })
    .trim()
    .min(2, "Escribe tu nombre (mínimo 2 letras)")
    .max(80, "El nombre admite máximo 80 caracteres"),
});

export async function completeProfile(
  userId: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  await db
    .update(schema.user)
    .set({ name: parsed.data.name, profileCompleted: true })
    .where(eq(schema.user.id, userId));
  return { ok: true };
}
```

Run: `pnpm vitest run apps/web/src/lib/profile.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 3: Pantalla de onboarding**

`apps/web/src/app/onboarding/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@repo/auth/guards";
import { completeProfile } from "@/lib/profile";

export type OnboardingState = { error?: string };

export async function submitOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser("/onboarding");
  const result = await completeProfile(user.id, { name: formData.get("name") });
  if (!result.ok) return { error: result.error };
  redirect("/app");
}
```

`apps/web/src/app/onboarding/onboarding-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { submitOnboarding, type OnboardingState } from "./actions";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(submitOnboarding, {});
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">¿Cómo te llamas?</Label>
        <Input id="name" name="name" defaultValue={defaultName} autoComplete="name" required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Continuar
      </Button>
    </form>
  );
}
```

`apps/web/src/app/onboarding/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@repo/auth/guards";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (user.profileCompleted) redirect("/app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Antes de empezar</h1>
      <OnboardingForm defaultName={user.name} />
    </main>
  );
}
```

- [ ] **Step 4: Página principal y salida**

`apps/web/src/components/sign-out-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Salir
    </Button>
  );
}
```

`apps/web/src/app/app/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireCompletedProfile } from "@repo/auth/guards";
import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Inicio" };

export default async function AppHomePage() {
  const user = await requireCompletedProfile("/app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Hola, {user.name.split(/\s+/)[0]}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <p className="text-muted-foreground">Aquí empieza tu idea.</p>
      {user.role === "admin" && (
        <Button asChild variant="secondary" className="self-start">
          <Link href="/admin/users">Administrar usuarios</Link>
        </Button>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Reglas de administración (test primero)**

`apps/web/src/lib/admin-users.test.ts`:

```ts
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import { db, eq, schema } from "@repo/db";
import { createUser, sessionUserFrom } from "@/test/factories";
import { listUsers, setUserBanned, setUserRole } from "./admin-users";

afterEach(async () => {
  await db.delete(schema.user);
});

async function reload(id: string) {
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  return row!;
}

describe("admin users", () => {
  it("lists users newest first", async () => {
    await createUser({ email: "old@example.test", createdAt: new Date("2026-01-01") });
    await createUser({ email: "new@example.test", createdAt: new Date("2026-02-01") });
    expect((await listUsers()).map((u) => u.email)).toEqual(["new@example.test", "old@example.test"]);
  });

  it("promotes another user to admin", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin", profileCompleted: true }));
    const target = await createUser();
    await setUserRole(actor, target.id, "admin");
    expect((await reload(target.id)).role).toBe("admin");
  });

  it("rejects unknown roles", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    const target = await createUser();
    await expect(setUserRole(actor, target.id, "root")).rejects.toThrow(ApiError);
    expect((await reload(target.id)).role).toBe("user");
  });

  it("does not let an admin change their own role", async () => {
    const row = await createUser({ role: "admin" });
    await expect(setUserRole(sessionUserFrom(row), row.id, "user")).rejects.toThrow(
      "No puedes cambiar tu propio rol ni suspender tu cuenta",
    );
    expect((await reload(row.id)).role).toBe("admin");
  });

  it("does not let an admin ban themselves", async () => {
    const row = await createUser({ role: "admin" });
    await expect(setUserBanned(sessionUserFrom(row), row.id, true)).rejects.toThrow(ApiError);
    expect((await reload(row.id)).banned).toBe(false);
  });

  it("banning revokes the target's sessions; unbanning restores access", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    const target = await createUser();
    await db.insert(schema.session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: target.id,
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });

    await setUserBanned(actor, target.id, true);
    expect((await reload(target.id)).banned).toBe(true);
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, target.id))).toEqual([]);

    await setUserBanned(actor, target.id, false);
    expect((await reload(target.id)).banned).toBe(false);
  });

  it("fails with 404 for a user that does not exist", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    await expect(setUserRole(actor, "missing", "admin")).rejects.toMatchObject({ status: 404 });
  });
});
```

Run: `pnpm vitest run apps/web/src/lib/admin-users.test.ts`
Expected: FAIL — no se resuelve `./admin-users`.

`apps/web/src/lib/admin-users.ts`:

```ts
import "server-only";
import type { SessionUser } from "@repo/auth/access";
import { ApiError } from "@repo/auth/api-error";
import { isRole } from "@repo/auth/roles";
import { db, desc, eq, schema } from "@repo/db";

// Gestión de usuarios del panel /admin/users. Se escribe directo en la base (y no con la
// API HTTP del plugin admin) para poder probar las reglas sin sesión HTTP; el efecto es
// el mismo: rol, baneo y revocación de sesiones.

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  createdAt: Date;
};

export async function listUsers(): Promise<UserRow[]> {
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      banned: schema.user.banned,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(desc(schema.user.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, banned: Boolean(r.banned) }));
}

// Un admin no puede degradarse ni suspenderse: así la app nunca queda sin admins por
// un clic equivocado.
export function assertCanManage(actor: SessionUser, targetId: string): void {
  if (actor.id === targetId) {
    throw new ApiError("No puedes cambiar tu propio rol ni suspender tu cuenta", 400);
  }
}

async function assertExists(targetId: string): Promise<void> {
  const [row] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, targetId));
  if (!row) throw new ApiError("Usuario no encontrado", 404);
}

export async function setUserRole(actor: SessionUser, targetId: string, role: unknown): Promise<void> {
  assertCanManage(actor, targetId);
  if (!isRole(role)) throw new ApiError("Rol inválido", 400);
  await assertExists(targetId);
  await db.update(schema.user).set({ role }).where(eq(schema.user.id, targetId));
}

export async function setUserBanned(actor: SessionUser, targetId: string, banned: boolean): Promise<void> {
  assertCanManage(actor, targetId);
  await assertExists(targetId);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set({ banned, banReason: null, banExpires: null })
      .where(eq(schema.user.id, targetId));
    // Al suspender, se cierran sus sesiones abiertas en el acto.
    if (banned) await tx.delete(schema.session).where(eq(schema.session.userId, targetId));
  });
}
```

Run: `pnpm vitest run apps/web/src/lib/admin-users.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Panel `/admin/users`**

`apps/web/src/app/admin/users/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@repo/auth/guards";
import { setUserBanned, setUserRole } from "@/lib/admin-users";

export async function changeRole(formData: FormData): Promise<void> {
  const actor = await requireAdmin("/admin/users");
  await setUserRole(actor, String(formData.get("userId")), formData.get("role"));
  revalidatePath("/admin/users");
}

export async function changeBan(formData: FormData): Promise<void> {
  const actor = await requireAdmin("/admin/users");
  await setUserBanned(actor, String(formData.get("userId")), formData.get("banned") === "true");
  revalidatePath("/admin/users");
}
```

`apps/web/src/app/admin/users/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@repo/auth/guards";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { listUsers } from "@/lib/admin-users";
import { changeBan, changeRole } from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

export default async function AdminUsersPage() {
  const actor = await requireAdmin("/admin/users");
  const users = await listUsers();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Button asChild variant="ghost">
          <Link href="/app">Volver</Link>
        </Button>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            const self = u.id === actor.id;
            return (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.banned ? "Suspendido" : "Activo"}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  <form action={changeRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="role" value={u.role === "admin" ? "user" : "admin"} />
                    <Button size="sm" variant="outline" disabled={self}>
                      {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                    </Button>
                  </form>
                  <form action={changeBan}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="banned" value={u.banned ? "false" : "true"} />
                    <Button size="sm" variant={u.banned ? "outline" : "destructive"} disabled={self}>
                      {u.banned ? "Reactivar" : "Suspender"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}
```

- [ ] **Step 7: Verificación completa en el navegador**

Run: `pnpm typecheck && pnpm lint && pnpm brand-lint && pnpm test`
Expected: todo en verde.

Run: `pnpm db:seed:dev && pnpm dev`
Expected, en `http://localhost:3000/login`:
1. "Entrar como user" → `/app` con "Hola, Usuario"; no aparece "Administrar usuarios". Abrir `/admin/users` → vuelve a `/app`.
2. Salir; "Entrar como admin" → `/app` con el botón "Administrar usuarios" → tabla con ambos usuarios; los botones de la fila propia están deshabilitados.
3. Suspender a `user@local.test`; en otra ventana privada entrar como user → `/login?error=banned` con el mensaje de cuenta suspendida. Reactivar y verificar que entra.
4. Con un usuario nuevo con `profileCompleted = false` (en `pnpm db:studio`, poner `profile_completed` en false para `user@local.test`): entrar lleva a `/onboarding`; un nombre de 1 letra muestra el error; uno válido lleva a `/app`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): onboarding, inicio y administración de usuarios"
```

---
### Task 9: Imagen Docker, entrypoint con migraciones y compose de producción

**Files:**
- Create: `docker/Dockerfile`, `docker/entrypoint.ts`, `docker/tsconfig.json`, `.dockerignore`, `docker-compose.yaml`
- Modify: `docker-compose.local.yaml` (servicio `web` con perfil `image`), `package.json` (typecheck de `docker/`)
- Test: verificación con la imagen real (Step 5)

**Interfaces:**
- Consumes: `runMigrations` de `packages/db/src/migrate.ts` (import relativo; esbuild lo empaqueta).
- Produces: imagen que escucha en `:3000`, migra al arrancar (salvo `SKIP_MIGRATIONS=1`), y sale con código ≠ 0 si la migración falla. Variables de runtime: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`.

- [ ] **Step 1: Entrypoint**

`docker/entrypoint.ts`:

```ts
// Arranque del contenedor: primero la base al día, después el servidor de Next.
// Las migraciones no pueden correr en el build (ahí no hay Postgres), así que este es el
// único momento en que se aplican. Si fallan, el contenedor muere: es preferible a servir
// contra un esquema viejo. esbuild empaqueta este archivo (con postgres y drizzle) a
// dist/entrypoint.mjs; en runtime no hay TypeScript.
import { spawn } from "node:child_process";
import { constants } from "node:os";
import path from "node:path";
import { runMigrations } from "../packages/db/src/migrate.ts";

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? path.resolve(import.meta.dirname, "migrations");
const SERVER = path.resolve(import.meta.dirname, "apps/web/server.js");

async function migrate(): Promise<void> {
  if (process.env.SKIP_MIGRATIONS === "1") {
    console.log("→ SKIP_MIGRATIONS=1: se arranca sin tocar la base.");
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Falta la variable de entorno DATABASE_URL");
  console.log("→ Aplicando migraciones pendientes…");
  await runMigrations({ databaseUrl, migrationsFolder: MIGRATIONS_DIR });
  console.log("→ Migraciones al día.");
}

function startServer(): void {
  const server = spawn(process.execPath, [SERVER], { stdio: "inherit" });
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => server.kill(signal));
  }
  // Se propaga la salida del server. Con señal se usa la convención 128 + número: volver
  // a enviarse la señal no sirve porque este proceso ya la intercepta.
  server.on("exit", (code, signal) => {
    process.exit(signal ? 128 + (constants.signals[signal] ?? 0) : (code ?? 0));
  });
}

try {
  await migrate();
} catch (error) {
  console.error("✗ Error aplicando migraciones:", error);
  process.exit(1);
}
startServer();
```

`docker/tsconfig.json`:

```json
{
  "extends": "../packages/config/tsconfig/base.json",
  "compilerOptions": { "allowImportingTsExtensions": true },
  "include": ["./entrypoint.ts"]
}
```

En `package.json` raíz, cambiar el script `typecheck` por:

```json
    "typecheck": "turbo run typecheck && tsc -p scripts --noEmit && tsc -p docker --noEmit",
```

Run: `tsc -p docker --noEmit`
Expected: sin errores.

- [ ] **Step 2: Dockerfile**

`docker/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
#
# Imagen de la app. La construye GitHub Actions y la publica en GHCR; Coolify solo hace
# pull. Se construye desde la raíz del monorepo:
#   docker build -f docker/Dockerfile -t app .
#
# Debian slim y no Alpine: sharp y otros binarios nativos se resuelven contra glibc.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# --- pruner: deja solo `web` y los paquetes de los que depende --------------------
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2 prune web --docker

# --- builder: instala, construye Next y empaqueta el entrypoint -------------------
FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY docker ./docker
# NEXT_PUBLIC_* se hornea en el bundle: llega como build arg, no como env de Coolify.
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
# El build no tiene secretos ni base de datos.
RUN SKIP_ENV_VALIDATION=1 pnpm turbo run build --filter=web
RUN pnpm exec esbuild docker/entrypoint.ts \
      --bundle --platform=node --format=esm --target=node24 \
      --outfile=dist/entrypoint.mjs \
      --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"

# --- runner: solo lo que el standalone necesita -----------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/dist/entrypoint.mjs ./entrypoint.mjs
USER nextjs
EXPOSE 3000
CMD ["node", "entrypoint.mjs"]
```

`.dockerignore`:

```
**/node_modules
**/.next
**/.turbo
**/dist
.git
.env
.env.*
!.env.example
db-dumps
docs
```

- [ ] **Step 3: Compose de producción**

`docker-compose.yaml`:

```yaml
# Producción (Coolify). Hace pull de la imagen de GHCR; nada se construye aquí.
# Sin `ports`: Traefik de Coolify entra por la red interna de Docker; publicar 3000 en el
# host choca con cualquier otro contenedor que ya lo use.
# Sin defaults: si falta una variable en Coolify, el deploy falla en vez de arrancar con
# placeholders.
services:
  web:
    image: ghcr.io/juancadavidc/starter-next-auth/web:${TAG:-latest}
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      DATABASE_URL: ${DATABASE_URL:?falta DATABASE_URL}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET:?falta BETTER_AUTH_SECRET}
      BETTER_AUTH_URL: ${BETTER_AUTH_URL:?falta BETTER_AUTH_URL}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:?falta GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:?falta GOOGLE_CLIENT_SECRET}
      ADMIN_EMAILS: ${ADMIN_EMAILS:-}
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 15s
      timeout: 5s
      retries: 5
      start_period: 30s
```

En `docker-compose.local.yaml`, agregar bajo `services:` (después de `postgres`):

```yaml
  # Prueba local de la imagen de producción: `docker compose -f docker-compose.local.yaml
  # --profile image up --build web`. No arranca con `pnpm db:up`.
  web:
    profiles: ["image"]
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: postgres://starter:starter@postgres:5432/starter_next_auth
      BETTER_AUTH_SECRET: local-image-secret-local-image-secret
      BETTER_AUTH_URL: http://localhost:3001
      GOOGLE_CLIENT_ID: local-image
      GOOGLE_CLIENT_SECRET: local-image
    depends_on:
      postgres:
        condition: service_healthy
```

- [ ] **Step 4: Construir la imagen**

Run: `docker build -f docker/Dockerfile -t starter-next-auth:local .`
Expected: build exitoso. Si `turbo prune` no incluye algún archivo raíz que el build necesite (p. ej. `turbo.json` o `.nvmrc`), agregarlo con un `COPY` explícito en la etapa `builder` y repetir.

- [ ] **Step 5: Verificar arranque, migración y health**

Run:

```bash
docker compose -f docker-compose.local.yaml --profile image up --build -d web
sleep 10
curl -fsS localhost:3001/api/health
curl -fsS localhost:3001/api/health/db
docker compose -f docker-compose.local.yaml logs web | head -20
```

Expected: `{"status":"ok"}` dos veces; en los logs `→ Aplicando migraciones pendientes…` y `→ Migraciones al día.` antes del arranque de Next.

Verificar la falla segura:

```bash
docker run --rm -e DATABASE_URL=postgres://nadie:nada@127.0.0.1:1/x starter-next-auth:local; echo "exit=$?"
```

Expected: `✗ Error aplicando migraciones` y `exit=1`.

Verificar el apagado limpio:

```bash
docker compose -f docker-compose.local.yaml stop web
docker compose -f docker-compose.local.yaml ps -a web
```

Expected: el contenedor se detiene en menos de 10 s (sin esperar al SIGKILL), con estado `Exited (143)` o `Exited (0)`.

```bash
docker compose -f docker-compose.local.yaml --profile image down web
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(docker): imagen standalone con migraciones al arrancar y compose de producción"
```

---

### Task 10: CI/CD — checks, smoke test de la imagen y publicación en GHCR

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/build-and-push.yml`

**Interfaces:**
- Consumes: scripts raíz (`lint`, `typecheck`, `brand-lint`, `check-migrations`, `test`), `docker/Dockerfile`, `/api/health`, `/api/health/db`.
- Produces: imagen `ghcr.io/juancadavidc/starter-next-auth/web:{latest,<sha>}` en cada push a `main`; POST al webhook de Coolify si existen los secrets `COOLIFY_WEBHOOK_URL` y `COOLIFY_TOKEN`.

- [ ] **Step 1: CI**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  DATABASE_URL: postgres://starter:starter@localhost:5432/starter_next_auth

jobs:
  checks:
    name: Lint, tipos y tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: starter
          POSTGRES_PASSWORD: starter
          POSTGRES_DB: starter_next_auth
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U starter"
          --health-interval 2s --health-timeout 3s --health-retries 20
    steps:
      # fetch-depth 0: el check de migraciones compara contra la rama base.
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm brand-lint
      - name: Migraciones solo aditivas
        if: github.event_name == 'pull_request'
        run: pnpm check-migrations origin/${{ github.base_ref }}
      - run: pnpm test

  image-smoke:
    name: La imagen arranca y migra
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_USER: starter
          POSTGRES_PASSWORD: starter
          POSTGRES_DB: starter_next_auth
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U starter"
          --health-interval 2s --health-timeout 3s --health-retries 20
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/Dockerfile
          load: true
          tags: app:ci
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - name: Arrancar la imagen
        run: |
          docker run -d --name app --network host \
            -e DATABASE_URL="$DATABASE_URL" \
            -e BETTER_AUTH_SECRET=ci-secret-ci-secret-ci-secret-0000 \
            -e BETTER_AUTH_URL=http://localhost:3000 \
            -e GOOGLE_CLIENT_ID=ci -e GOOGLE_CLIENT_SECRET=ci \
            app:ci
      - name: Health y base migrada
        run: |
          for i in $(seq 1 30); do
            if curl -fsS localhost:3000/api/health && curl -fsS localhost:3000/api/health/db; then
              exit 0
            fi
            sleep 2
          done
          docker logs app
          exit 1
```

- [ ] **Step 2: Publicación**

`.github/workflows/build-and-push.yml`:

```yaml
name: Build and push

on:
  push:
    branches: [main]

env:
  IMAGE: ghcr.io/juancadavidc/starter-next-auth/web

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v5
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/Dockerfile
          push: true
          # La Measurement ID de GA4 no es secreta: variable de repo, horneada en build.
          build-args: |
            NEXT_PUBLIC_GA_ID=${{ vars.NEXT_PUBLIC_GA_ID }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          tags: |
            ${{ env.IMAGE }}:latest
            ${{ env.IMAGE }}:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Redeploy en Coolify
        env:
          WEBHOOK: ${{ secrets.COOLIFY_WEBHOOK_URL }}
          TOKEN: ${{ secrets.COOLIFY_TOKEN }}
        # Un repo recién creado aún no tiene app en Coolify: se avisa y no se falla.
        # Coolify 4 registra /api/v1/deploy como POST.
        run: |
          if [ -z "$WEBHOOK" ] || [ -z "$TOKEN" ]; then
            echo "::warning::Sin COOLIFY_WEBHOOK_URL/COOLIFY_TOKEN: no se dispara el deploy. Corre /coolify-deploy."
            exit 0
          fi
          curl --fail -X POST -H "Authorization: Bearer $TOKEN" "$WEBHOOK"
```

- [ ] **Step 3: Validar sintaxis**

Run: `pnpm dlx yaml-lint .github/workflows/ci.yml .github/workflows/build-and-push.yml`
Expected: sin errores. (La ejecución real se verifica en Task 15, al subir el repo.)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: checks, smoke test de la imagen y publicación en GHCR con deploy a Coolify"
```

---

### Task 11: Módulo opcional — `@repo/storage` (R2 + variantes webp)

Todo lo que este módulo agrega fuera de `packages/storage/` va entre marcadores `<optional:storage>` … `</optional:storage>` para que `setup.ts` (Task 14) pueda quitarlo.

**Files:**
- Create: `packages/storage/package.json`, `packages/storage/tsconfig.json`, `packages/storage/src/env.ts`, `packages/storage/src/keys.ts`, `packages/storage/src/image-variants.ts`, `packages/storage/src/r2.ts`, `packages/storage/src/upload.ts`
- Create: `apps/web/src/app/api/files/[...key]/route.ts`
- Modify: `apps/web/package.json` (dependencia `@repo/storage`), `apps/web/next.config.ts` (transpilePackages con marcador), `.env.example` (variables R2 con marcador)
- Test: `packages/storage/src/keys.test.ts`, `packages/storage/src/image-variants.test.ts`, `packages/storage/src/upload.test.ts`

**Interfaces:**
- Produces:
  - `@repo/storage/keys` → `safeExtension(filename: string): string`, `newObjectKey(prefix: string, filename: string): string`, `isSafeKey(key: string): boolean`
  - `@repo/storage/image-variants` → `type VariantSize = "sm" | "md" | "lg"`, `VARIANT_WIDTHS: Record<VariantSize, number>`, `type ImageVariant = { size: VariantSize; buffer: Buffer; contentType: "image/webp" }`, `makeImageVariants(input: Buffer): Promise<ImageVariant[]>`
  - `@repo/storage/upload` → `ALLOWED_IMAGE_TYPES`, `MAX_IMAGE_BYTES`, `assertImageFile(value: unknown): asserts value is File`, `uploadImage(file: File, prefix: string): Promise<{ baseKey: string; keys: Record<VariantSize, string> }>`
  - `@repo/storage/r2` → `putObject(key, body, contentType)`, `getObject(key): Promise<{ body: ReadableStream; contentType: string } | null>`, `deleteObjects(keys: string[])`
  - Ruta `GET /api/files/<key>` que sirve el objeto con caché inmutable.

- [ ] **Step 1: Paquete**

`packages/storage/package.json`:

```json
{
  "name": "@repo/storage",
  "private": true,
  "type": "module",
  "exports": {
    "./keys": "./src/keys.ts",
    "./image-variants": "./src/image-variants.ts",
    "./upload": "./src/upload.ts",
    "./r2": "./src/r2.ts"
  },
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.978.0",
    "@repo/auth": "workspace:*",
    "@repo/env": "workspace:*",
    "sharp": "^0.34.5"
  },
  "devDependencies": { "@repo/config": "workspace:*" }
}
```

`packages/storage/tsconfig.json`:

```json
{
  "extends": "@repo/config/tsconfig/base.json",
  "compilerOptions": { "lib": ["ES2023", "DOM"] },
  "include": ["src"]
}
```

`packages/storage/src/env.ts`:

```ts
import { required } from "@repo/env";

// Credenciales de Cloudflare R2 (API compatible con S3). Solo las exige este módulo.
export const storageEnv = {
  get accountId() {
    return required("R2_ACCOUNT_ID");
  },
  get accessKeyId() {
    return required("R2_ACCESS_KEY_ID");
  },
  get secretAccessKey() {
    return required("R2_SECRET_ACCESS_KEY");
  },
  get bucket() {
    return required("R2_BUCKET_NAME");
  },
};
```

Run: `pnpm install`

- [ ] **Step 2: Tests (fallan)**

`packages/storage/src/keys.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isSafeKey, newObjectKey, safeExtension } from "./keys";

describe("safeExtension", () => {
  it.each([
    ["foto.JPG", ".jpg"],
    ["a.b.png", ".png"],
    ["sin-extension", ""],
    ["malo.ph/p", ""],
    ["largo.abcdefgh", ""],
  ])("%s → %s", (name, ext) => {
    expect(safeExtension(name)).toBe(ext);
  });
});

describe("newObjectKey", () => {
  it("builds prefix/uuid.ext with a sanitized prefix", () => {
    expect(newObjectKey("Avatars/../x", "a.png")).toMatch(/^avatars-x\/[0-9a-f-]{36}\.png$/);
  });
});

describe("isSafeKey", () => {
  it.each(["avatars/abc.webp", "a/b/c-lg.webp"])("accepts %s", (key) => {
    expect(isSafeKey(key)).toBe(true);
  });

  it.each(["../etc/passwd", "/abs", "a//b", "a/../b", "", "a b"])("rejects %s", (key) => {
    expect(isSafeKey(key)).toBe(false);
  });
});
```

`packages/storage/src/image-variants.test.ts`:

```ts
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { makeImageVariants, VARIANT_WIDTHS } from "./image-variants";

async function png(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: { r: 10, g: 20, b: 30 } } })
    .png()
    .toBuffer();
}

describe("makeImageVariants", () => {
  it("produces sm/md/lg webp at the configured widths", async () => {
    const variants = await makeImageVariants(await png(1600, 800));
    expect(variants.map((v) => v.size)).toEqual(["sm", "md", "lg"]);
    for (const v of variants) {
      const meta = await sharp(v.buffer).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(VARIANT_WIDTHS[v.size]);
      expect(v.contentType).toBe("image/webp");
    }
  });

  it("never enlarges small images", async () => {
    const variants = await makeImageVariants(await png(300, 300));
    const widths = await Promise.all(variants.map(async (v) => (await sharp(v.buffer).metadata()).width));
    expect(widths).toEqual([200, 300, 300]);
  });

  it("rejects data that is not an image", async () => {
    await expect(makeImageVariants(Buffer.from("no soy una imagen"))).rejects.toThrow();
  });
});
```

`packages/storage/src/upload.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import { assertImageFile, MAX_IMAGE_BYTES } from "./upload";

describe("assertImageFile", () => {
  it("accepts an allowed image under the size limit", () => {
    expect(() => assertImageFile(new File([new Uint8Array(10)], "a.png", { type: "image/png" }))).not.toThrow();
  });

  it("rejects non-files", () => {
    expect(() => assertImageFile("a.png")).toThrow(ApiError);
  });

  it("rejects disallowed types", () => {
    expect(() => assertImageFile(new File(["x"], "a.svg", { type: "image/svg+xml" }))).toThrow(
      "Tipo de archivo no permitido",
    );
  });

  it("rejects files over the limit", () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "a.png", { type: "image/png" });
    expect(() => assertImageFile(big)).toThrow("El archivo supera 5 MB");
  });
});
```

Run: `pnpm vitest run packages/storage`
Expected: FAIL — no se resuelven los módulos.

- [ ] **Step 3: Implementación**

`packages/storage/src/keys.ts`:

```ts
import { randomUUID } from "node:crypto";

// La extensión viene de un nombre de archivo del usuario y termina en la key: solo se
// acepta una extensión corta alfanumérica.
export function safeExtension(filename: string): string {
  const match = filename.match(/\.([^./\\]+)$/);
  const ext = match?.[1]?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? `.${ext}` : "";
}

export function newObjectKey(prefix: string, filename: string): string {
  const cleanPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${cleanPrefix}/${randomUUID()}${safeExtension(filename)}`;
}

// Segmentos [a-z0-9._-], sin vacíos ni "..": una key así no escapa del bucket en la ruta
// pública /api/files/<key>.
export function isSafeKey(key: string): boolean {
  if (!key) return false;
  return key.split("/").every((segment) => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== "..");
}
```

`packages/storage/src/image-variants.ts`:

```ts
import sharp from "sharp";

export type VariantSize = "sm" | "md" | "lg";

export const VARIANT_WIDTHS: Record<VariantSize, number> = { sm: 200, md: 600, lg: 1200 };

export type ImageVariant = { size: VariantSize; buffer: Buffer; contentType: "image/webp" };

// Tres anchos en webp; nunca agranda una imagen pequeña. Lanza si el buffer no es imagen.
export async function makeImageVariants(input: Buffer): Promise<ImageVariant[]> {
  const sizes = Object.entries(VARIANT_WIDTHS) as [VariantSize, number][];
  return Promise.all(
    sizes.map(async ([size, width]) => ({
      size,
      buffer: await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
      contentType: "image/webp" as const,
    })),
  );
}
```

`packages/storage/src/r2.ts`:

```ts
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { storageEnv } from "./env";

let client: S3Client | undefined;

function r2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${storageEnv.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: storageEnv.accessKeyId, secretAccessKey: storageEnv.secretAccessKey },
  });
  return client;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2().send(new PutObjectCommand({ Bucket: storageEnv.bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: storageEnv.bucket, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await r2().send(
    new DeleteObjectsCommand({
      Bucket: storageEnv.bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
```

`packages/storage/src/upload.ts`:

```ts
import { ApiError } from "@repo/auth/api-error";
import { makeImageVariants, type VariantSize } from "./image-variants";
import { newObjectKey } from "./keys";
import { deleteObjects, putObject } from "./r2";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Valida lo que llega por multipart antes de gastar CPU en sharp.
export function assertImageFile(value: unknown): asserts value is File {
  if (!(value instanceof File)) throw new ApiError("No se envió ningún archivo", 400);
  if (!ALLOWED_IMAGE_TYPES.includes(value.type)) throw new ApiError("Tipo de archivo no permitido", 400);
  if (value.size > MAX_IMAGE_BYTES) throw new ApiError("El archivo supera 5 MB", 400);
}

// Sube las tres variantes como <prefijo>/<uuid>-<talla>.webp. Si alguna falla, borra las
// que alcanzaron a subir para no dejar huérfanos.
export async function uploadImage(
  file: File,
  prefix: string,
): Promise<{ baseKey: string; keys: Record<VariantSize, string> }> {
  assertImageFile(file);
  const variants = await makeImageVariants(Buffer.from(await file.arrayBuffer())).catch(() => {
    throw new ApiError("La imagen no se pudo procesar", 400);
  });
  const baseKey = newObjectKey(prefix, "x").replace(/\.[^.]+$/, "");
  const keys = Object.fromEntries(variants.map((v) => [v.size, `${baseKey}-${v.size}.webp`])) as Record<
    VariantSize,
    string
  >;
  const results = await Promise.allSettled(variants.map((v) => putObject(keys[v.size], v.buffer, v.contentType)));
  if (results.some((r) => r.status === "rejected")) {
    await deleteObjects(Object.values(keys)).catch(() => undefined);
    throw new ApiError("No se pudo guardar la imagen", 502);
  }
  return { baseKey, keys };
}
```

Run: `pnpm vitest run packages/storage`
Expected: PASS (keys 14, image-variants 3, upload 4).

- [ ] **Step 4: Ruta pública de archivos y cableado en la app**

`apps/web/src/app/api/files/[...key]/route.ts`:

```ts
import { handleApiError, ApiError } from "@repo/auth/api-error";
import { isSafeKey } from "@repo/storage/keys";
import { getObject } from "@repo/storage/r2";

// Sirve objetos de R2 a través de la app. Las keys llevan UUID: el contenido de una key
// nunca cambia, por eso la caché es inmutable.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const key = (await params).key.join("/");
    if (!isSafeKey(key)) throw new ApiError("No encontrado", 404);
    const object = await getObject(key);
    if (!object) throw new ApiError("No encontrado", 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
```

En `apps/web/package.json`, en `dependencies`, agregar:

```json
    "@repo/storage": "workspace:*",
```

En `apps/web/next.config.ts`, reemplazar la línea de `transpilePackages` por:

```ts
  transpilePackages: [
    "@repo/auth",
    "@repo/db",
    "@repo/env",
    "@repo/ui",
    // <optional:storage>
    "@repo/storage",
    // </optional:storage>
  ],
```

Al final de `.env.example`, agregar:

```bash
# <optional:storage>
# Cloudflare R2 (dash.cloudflare.com → R2 → Manage API tokens)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
# </optional:storage>
```

Y en `docker-compose.yaml`, dentro de `environment:` del servicio `web`:

```yaml
      # <optional:storage>
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID:?falta R2_ACCOUNT_ID}
      R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID:?falta R2_ACCESS_KEY_ID}
      R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY:?falta R2_SECRET_ACCESS_KEY}
      R2_BUCKET_NAME: ${R2_BUCKET_NAME:?falta R2_BUCKET_NAME}
      # </optional:storage>
```

Mover `/api/files/[...key]` dentro del módulo: la carpeta completa `apps/web/src/app/api/files/` es propiedad de storage (Task 14 la borra con el módulo).

Run: `pnpm install && pnpm typecheck && pnpm lint && SKIP_ENV_VALIDATION=1 pnpm --filter web build`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(storage): módulo opcional de R2 con variantes webp"
```

---
### Task 12: Módulos opcionales — PWA y analytics

Todo lo que estos módulos agregan en archivos compartidos va entre marcadores `<optional:pwa>` / `<optional:analytics>`.

**Files:**
- Create: `apps/web/src/sw-strategy.ts`, `apps/web/src/sw.ts`, `apps/web/tsconfig.sw.json`, `apps/web/src/components/sw-register.tsx`, `apps/web/src/app/offline/page.tsx`, `apps/web/src/app/manifest.ts`, `apps/web/src/app/icon.tsx`
- Create: `apps/web/src/lib/ga.ts`, `apps/web/src/components/analytics.tsx`
- Modify: `apps/web/package.json` (scripts y esbuild), `apps/web/tsconfig.json` (excluir sw), `apps/web/next.config.ts` (headers de `/sw.js`), `apps/web/src/app/layout.tsx`, `scripts/brand-lint.ts` (excepciones), `.env.example`, `docker/Dockerfile`, `.github/workflows/build-and-push.yml`
- Test: `apps/web/src/sw-strategy.test.ts`, `apps/web/src/lib/ga.test.ts`

**Interfaces:**
- Produces:
  - `@/sw-strategy` → `type Strategy = "network-with-offline-fallback" | "cache-first" | "bypass"`, `strategyFor(url: URL, request: { method: string; mode: string }, origin: string): Strategy`
  - `@/lib/ga` → `isValidGaId(id: string | undefined): id is string`
  - `public/sw.js` generado en cada `dev`/`build` (no versionado).

- [ ] **Step 1: Tests (fallan)**

`apps/web/src/sw-strategy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { strategyFor } from "./sw-strategy";

const origin = "https://app.example.com";
const req = (method = "GET", mode = "cors") => ({ method, mode });

describe("strategyFor", () => {
  it("serves hashed static assets cache-first", () => {
    expect(strategyFor(new URL(`${origin}/_next/static/chunks/a.js`), req(), origin)).toBe("cache-first");
  });

  it("uses network with offline fallback for navigations", () => {
    expect(strategyFor(new URL(`${origin}/app`), req("GET", "navigate"), origin)).toBe(
      "network-with-offline-fallback",
    );
  });

  it.each([
    ["non-GET", new URL(`${origin}/app`), req("POST", "navigate")],
    ["API", new URL(`${origin}/api/auth/get-session`), req()],
    ["cross-origin", new URL("https://accounts.google.com/x"), req("GET", "navigate")],
    ["other same-origin", new URL(`${origin}/icon`), req()],
  ])("bypasses %s requests", (_label, url, request) => {
    expect(strategyFor(url, request, origin)).toBe("bypass");
  });
});
```

`apps/web/src/lib/ga.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidGaId } from "./ga";

describe("isValidGaId", () => {
  it("accepts GA4 measurement ids", () => {
    expect(isValidGaId("G-ABC123XYZ9")).toBe(true);
  });

  it.each([undefined, "", "UA-123-1", "G-abc", "G-1');alert(1);//"])("rejects %s", (id) => {
    expect(isValidGaId(id)).toBe(false);
  });
});
```

Run: `pnpm vitest run apps/web/src/sw-strategy.test.ts apps/web/src/lib/ga.test.ts`
Expected: FAIL — no se resuelven los módulos.

- [ ] **Step 2: Implementación pura**

`apps/web/src/sw-strategy.ts`:

```ts
export type Strategy = "network-with-offline-fallback" | "cache-first" | "bypass";

// Qué hace el service worker con cada request. A propósito NO cachea páginas HTML: son
// por usuario y en un dispositivo compartido filtrarían datos. Sin red, se muestra /offline.
export function strategyFor(url: URL, request: { method: string; mode: string }, origin: string): Strategy {
  if (request.method !== "GET" || url.origin !== origin) return "bypass";
  if (url.pathname.startsWith("/api/")) return "bypass";
  if (url.pathname.startsWith("/_next/static/")) return "cache-first";
  if (request.mode === "navigate") return "network-with-offline-fallback";
  return "bypass";
}
```

`apps/web/src/lib/ga.ts`:

```ts
// El ID se interpola en un <script> inline: solo se acepta el formato de GA4.
export function isValidGaId(id: string | undefined): id is string {
  return !!id && /^G-[A-Z0-9]{4,}$/.test(id);
}
```

Run: `pnpm vitest run apps/web/src/sw-strategy.test.ts apps/web/src/lib/ga.test.ts`
Expected: PASS (6 + 6 tests).

- [ ] **Step 3: Service worker y registro**

`apps/web/src/sw.ts`:

```ts
/// <reference lib="webworker" />
// Service worker mínimo: assets estáticos cache-first y página /offline sin red.
// Se compila con esbuild a public/sw.js (ver scripts de apps/web/package.json).
import { strategyFor } from "./sw-strategy";

const sw = self as unknown as ServiceWorkerGlobalScope;
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_CACHE = `offline-${VERSION}`;
const OFFLINE_URL = "/offline";

sw.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![STATIC_CACHE, OFFLINE_CACHE].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const strategy = strategyFor(url, event.request, sw.location.origin);
  if (strategy === "cache-first") {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) void cache.put(event.request, res.clone());
        return res;
      }),
    );
  } else if (strategy === "network-with-offline-fallback") {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
  }
});
```

`apps/web/tsconfig.sw.json`:

```json
{
  "extends": "@repo/config/tsconfig/base.json",
  "compilerOptions": { "lib": ["ES2023", "WebWorker"], "types": [] },
  "include": ["src/sw.ts", "src/sw-strategy.ts"]
}
```

En `apps/web/tsconfig.json`, reemplazar `"exclude"` por:

```jsonc
  "exclude": [
    "node_modules",
    // <optional:pwa>
    "src/sw.ts",
    // </optional:pwa>
  ]
```

`apps/web/src/components/sw-register.tsx`:

```tsx
"use client";

import { useEffect } from "react";

// Solo en producción: en desarrollo un SW cacheando chunks confunde el hot reload.
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);
  return null;
}
```

`apps/web/src/app/offline/page.tsx`:

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-muted-foreground">Revisa tu internet y vuelve a intentarlo.</p>
    </main>
  );
}
```

`apps/web/src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "starter-next-auth",
    short_name: "starter-next-auth",
    start_url: "/app",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#171717",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
```

`apps/web/src/app/icon.tsx`:

```tsx
import { ImageResponse } from "next/og";

// Ícono provisional generado: reemplázalo por el de la marca (icon.png en esta carpeta).
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#171717",
          color: "#fafafa",
          fontSize: 320,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
```

- [ ] **Step 4: Cableado de PWA**

En `apps/web/package.json`: cambiar `scripts` a

```json
  "scripts": {
    "build:sw": "esbuild src/sw.ts --bundle --format=iife --target=es2022 --minify --outfile=public/sw.js",
    "dev": "pnpm build:sw && next dev",
    "build": "pnpm build:sw && next build",
    "start": "next start",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.sw.json --noEmit"
  },
```

y agregar en `devDependencies`: `"esbuild": "^0.25.0"`.

En `apps/web/next.config.ts`, dentro de `config`, agregar:

```ts
  // <optional:pwa>
  // El service worker debe controlar todo el origen y no quedarse cacheado.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  // </optional:pwa>
```

En `scripts/brand-lint.ts`, dentro de `EXCEPTIONS`, agregar:

```ts
  // <optional:pwa>
  {
    file: "apps/web/src/app/manifest.ts",
    match: /(background_color|theme_color)/,
    reason: "El manifest es JSON estático para el sistema operativo: no resuelve var(--token).",
  },
  {
    file: "apps/web/src/app/icon.tsx",
    match: /(background|color):/,
    reason: "ImageResponse rasteriza fuera del navegador: no hay CSS de la app.",
  },
  // </optional:pwa>
```

- [ ] **Step 5: Analytics**

`apps/web/src/components/analytics.tsx`:

```tsx
import Script from "next/script";
import { isValidGaId } from "@/lib/ga";

// Google Analytics 4. Sin NEXT_PUBLIC_GA_ID (o con uno inválido) no se carga nada.
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!isValidGaId(id)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
```

Al final de `.env.example`:

```bash
# <optional:analytics>
# Google Analytics 4 (se hornea en build: en CI es una variable de repo, no un secret)
NEXT_PUBLIC_GA_ID=
# </optional:analytics>
```

En `docker/Dockerfile`, envolver las líneas del build arg:

```dockerfile
# <optional:analytics>
# NEXT_PUBLIC_* se hornea en el bundle: llega como build arg, no como env de Coolify.
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
# </optional:analytics>
```

En `.github/workflows/build-and-push.yml`, envolver el bloque `build-args`:

```yaml
          # <optional:analytics>
          # La Measurement ID de GA4 no es secreta: variable de repo, horneada en build.
          build-args: |
            NEXT_PUBLIC_GA_ID=${{ vars.NEXT_PUBLIC_GA_ID }}
          # </optional:analytics>
```

- [ ] **Step 6: Layout**

Reemplazar `apps/web/src/app/layout.tsx` completo por:

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@repo/ui/components/sonner";
import { ThemeProvider } from "@repo/ui/components/theme-provider";
// <optional:analytics>
import { Analytics } from "@/components/analytics";
// </optional:analytics>
// <optional:pwa>
import { SwRegister } from "@/components/sw-register";
// </optional:pwa>
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "starter-next-auth", template: "%s · starter-next-auth" },
  description: "Una idea nueva, con login de Google desde el primer día.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
        {/* <optional:analytics> */}
        <Analytics />
        {/* </optional:analytics> */}
        {/* <optional:pwa> */}
        <SwRegister />
        {/* </optional:pwa> */}
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Verificar**

Run: `pnpm install && pnpm typecheck && pnpm lint && pnpm brand-lint && pnpm test`
Expected: todo en verde; existe `apps/web/public/sw.js` después de `pnpm --filter web build:sw` y `git status` no lo muestra (ignorado).

Run: `SKIP_ENV_VALIDATION=1 pnpm --filter web build && pnpm --filter web start` y abrir `http://localhost:3000/manifest.webmanifest` y `/icon`.
Expected: manifest JSON con `start_url: "/app"`; ícono PNG de 512×512. En DevTools → Application → Service Workers, `sw.js` activado; con "Offline" marcado, navegar a `/app` muestra "Sin conexión".

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): módulos opcionales de PWA y analytics"
```

---

### Task 13: Módulo opcional — landing en Astro

**Files:**
- Create: `apps/landing/package.json`, `apps/landing/tsconfig.json`, `apps/landing/astro.config.ts`, `apps/landing/wrangler.jsonc`, `apps/landing/src/styles/global.css`, `apps/landing/src/pages/index.astro`

**Interfaces:**
- Consumes: `@repo/ui/styles.css` (mismos tokens que la app).
- Produces: sitio estático en `apps/landing/dist`, desplegable con `pnpm --filter landing deploy` (Cloudflare Workers static assets). Variable `PUBLIC_APP_URL` para el botón de entrar.

- [ ] **Step 1: Paquete**

`apps/landing/package.json`:

```json
{
  "name": "landing",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev --port 4321",
    "build": "astro build",
    "typecheck": "astro check",
    "deploy": "astro build && wrangler deploy"
  },
  "dependencies": {
    "@repo/ui": "workspace:*",
    "@tailwindcss/vite": "^4.3.3",
    "astro": "^7.2.6",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.10",
    "typescript": "^5.9.0",
    "wrangler": "^4.126.0"
  }
}
```

`apps/landing/tsconfig.json`:

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`apps/landing/astro.config.ts`:

```ts
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// Sitio estático: sin servidor, sin base de datos, sin sesiones. La app vive aparte.
export default defineConfig({
  vite: { plugins: [tailwindcss()] },
});
```

`apps/landing/wrangler.jsonc`:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "starter-next-auth-landing",
  "compatibility_date": "2026-09-01",
  // Sitio estático puro: Cloudflare sirve dist/ tal cual. Este archivo evita que
  // `wrangler deploy` suba por el árbol buscando otra configuración.
  "assets": { "directory": "./dist" }
}
```

`apps/landing/src/styles/global.css`:

```css
@import "tailwindcss";
@import "@repo/ui/styles.css";
```

`apps/landing/src/pages/index.astro`:

```astro
---
import "../styles/global.css";

const appUrl = import.meta.env.PUBLIC_APP_URL ?? "http://localhost:3000";
---

<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>starter-next-auth</title>
    <meta name="description" content="Una idea nueva, con login de Google desde el primer día." />
  </head>
  <body class="min-h-dvh">
    <main class="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 class="text-5xl font-semibold tracking-tight">starter-next-auth</h1>
      <p class="text-lg text-muted-foreground">Una idea nueva, con login de Google desde el primer día.</p>
      <a
        href={`${appUrl}/login`}
        class="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
      >
        Entrar
      </a>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Verificar**

Run: `pnpm install && pnpm --filter landing build && pnpm --filter landing typecheck`
Expected: `apps/landing/dist/index.html` con el título y el enlace a `http://localhost:3000/login`; `astro check` sin errores.

Run: `pnpm build`
Expected: turbo construye `web` y `landing`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(landing): módulo opcional de landing en Astro para Cloudflare"
```

---
### Task 14: `scripts/setup.ts` — renombrar, secretos y quitar opcionales

`pnpm setup` es un comando interno de pnpm (configura `PNPM_HOME`) y no correría nuestro script. Por eso el script raíz (definido en Task 1) se llama **`bootstrap`**: `pnpm bootstrap` (o `node scripts/setup.ts`, que funciona incluso antes de `pnpm install`).

**Files:**
- Create: `scripts/setup.ts`
- Test: `scripts/setup.test.ts`

**Interfaces:**
- Consumes: marcadores `<optional:*>` de Tasks 11–12; `MIGRATION_LOCK_KEY = <n>;` en `packages/db/src/lock-key.ts`.
- Produces:
  - `TEMPLATE_NAME = "starter-next-auth"`, `TEMPLATE_SNAKE = "starter_next_auth"`, `MODULES = ["storage", "landing", "pwa", "analytics"]`, `type Module`
  - `validateName(name: string): string | null` (mensaje de error o `null`)
  - `toSnake(name: string): string`, `lockKeyFor(name: string): number`
  - `replaceIdentity(content: string, name: string): string`, `setLockKey(content: string, key: number): string`
  - `removeMarkedBlocks(content: string, module: Module): string`, `withSecret(envExample: string, secret: string): string`
  - `listTextFiles(root: string): string[]`
  - `type SetupOptions = { name: string; remove: Module[]; secret?: string }`, `type SetupResult = { changedFiles: string[]; envCreated: boolean; removed: Module[] }`, `runSetup(root: string, opts: SetupOptions): SetupResult` (solo sistema de archivos, síncrono)
  - CLI: `node scripts/setup.ts [--name x] [--domain d] [--no-storage] [--no-landing] [--no-pwa] [--no-analytics] [--no-db] [--yes]`

- [ ] **Step 1: Tests (fallan)**

`scripts/setup.test.ts`:

```ts
import { mkdirSync, mkdtempSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  lockKeyFor,
  removeMarkedBlocks,
  replaceIdentity,
  runSetup,
  setLockKey,
  validateName,
  withSecret,
} from "./setup.ts";

describe("validateName", () => {
  it.each(["mi-idea", "abc", "app2", "a1-b2-c3"])("accepts %s", (name) => {
    expect(validateName(name)).toBeNull();
  });

  it.each(["", "ab", "Mi-Idea", "mi_idea", "-mi", "mi-", "mi--idea", "1app", "a".repeat(41)])(
    "rejects %j",
    (name) => {
      expect(validateName(name)).toEqual(expect.any(String));
    },
  );
});

describe("lockKeyFor", () => {
  it("is deterministic, positive and fits in 31 bits", () => {
    const key = lockKeyFor("mi-idea");
    expect(lockKeyFor("mi-idea")).toBe(key);
    expect(key).toBeGreaterThan(0);
    expect(key).toBeLessThanOrEqual(0x7fffffff);
  });

  it("differs between projects", () => {
    expect(lockKeyFor("mi-idea")).not.toBe(lockKeyFor("otra-idea"));
  });
});

describe("replaceIdentity", () => {
  it("replaces kebab and snake forms and is idempotent", () => {
    const input = "name: starter-next-auth\ndb: starter_next_auth_test";
    const once = replaceIdentity(input, "mi-idea");
    expect(once).toBe("name: mi-idea\ndb: mi_idea_test");
    expect(replaceIdentity(once, "mi-idea")).toBe(once);
  });
});

describe("setLockKey", () => {
  it("rewrites the constant", () => {
    expect(setLockKey("export const MIGRATION_LOCK_KEY = 1_918_273_645;", 42)).toBe(
      "export const MIGRATION_LOCK_KEY = 42;",
    );
  });
});

describe("removeMarkedBlocks", () => {
  it("removes // # and JSX blocks of one module only", () => {
    const input = [
      "a",
      "// <optional:pwa>",
      "pwa-ts",
      "// </optional:pwa>",
      "# <optional:pwa>",
      "pwa-yaml",
      "# </optional:pwa>",
      "{/* <optional:pwa> */}",
      "<SwRegister />",
      "{/* </optional:pwa> */}",
      "// <optional:storage>",
      "storage",
      "// </optional:storage>",
      "b",
    ].join("\n");
    expect(removeMarkedBlocks(input, "pwa")).toBe(
      ["a", "// <optional:storage>", "storage", "// </optional:storage>", "b"].join("\n"),
    );
  });

  it("leaves content without markers untouched", () => {
    expect(removeMarkedBlocks("x\ny", "pwa")).toBe("x\ny");
  });
});

describe("withSecret", () => {
  it("fills an empty BETTER_AUTH_SECRET line", () => {
    expect(withSecret("A=1\nBETTER_AUTH_SECRET=\nB=2", "s3cr3t")).toBe("A=1\nBETTER_AUTH_SECRET=s3cr3t\nB=2");
  });
});

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "setup-"));
  const write = (rel: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  };
  write("package.json", JSON.stringify({ name: "starter-next-auth" }, null, 2) + "\n");
  write(
    "apps/web/package.json",
    JSON.stringify(
      {
        name: "web",
        scripts: {
          "build:sw": "esbuild ...",
          dev: "pnpm build:sw && next dev",
          build: "pnpm build:sw && next build",
          typecheck: "tsc --noEmit && tsc -p tsconfig.sw.json --noEmit",
        },
        dependencies: { "@repo/storage": "workspace:*", next: "^16" },
        devDependencies: { esbuild: "^0.25.0" },
      },
      null,
      2,
    ) + "\n",
  );
  write("packages/db/src/lock-key.ts", "export const MIGRATION_LOCK_KEY = 1_918_273_645;\n");
  write(".env.example", "DATABASE_URL=postgres://s:s@localhost:5432/starter_next_auth\nBETTER_AUTH_SECRET=\n");
  write("apps/web/next.config.ts", "a\n// <optional:storage>\n\"@repo/storage\",\n// </optional:storage>\nb\n");
  write("packages/storage/src/r2.ts", "starter-next-auth");
  write("apps/web/src/sw.ts", "sw");
  write("apps/landing/package.json", "{}");
  write("docs/superpowers/specs/x.md", "starter-next-auth");
  write("tools/skill/SKILL.md", "juancadavidc/starter-next-auth");
  write("node_modules/foo/index.ts", "starter-next-auth");
  return root;
}

const read = (root: string, rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("runSetup", () => {
  it("renames, sets the lock key, creates .env and removes modules", () => {
    const root = fixture();
    const result = runSetup(root, { name: "mi-idea", remove: ["storage", "pwa"], secret: "abc" });

    expect(JSON.parse(read(root, "package.json")).name).toBe("mi-idea");
    expect(read(root, "packages/db/src/lock-key.ts")).toContain(`= ${lockKeyFor("mi-idea")};`);
    expect(read(root, ".env")).toContain("BETTER_AUTH_SECRET=abc");
    expect(read(root, ".env")).toContain("/mi_idea");
    expect(result.envCreated).toBe(true);

    expect(existsSync(path.join(root, "packages/storage"))).toBe(false);
    expect(existsSync(path.join(root, "apps/web/src/sw.ts"))).toBe(false);
    expect(existsSync(path.join(root, "apps/landing"))).toBe(true);
    expect(read(root, "apps/web/next.config.ts")).toBe("a\nb\n");

    const web = JSON.parse(read(root, "apps/web/package.json"));
    expect(web.dependencies["@repo/storage"]).toBeUndefined();
    expect(web.scripts).toEqual({ dev: "next dev", build: "next build", typecheck: "tsc --noEmit" });
    expect(web.devDependencies.esbuild).toBeUndefined();

    // Lo que no es del proyecto nuevo no se toca: la skill apunta a la plantilla.
    expect(read(root, "tools/skill/SKILL.md")).toContain("juancadavidc/starter-next-auth");
    expect(read(root, "node_modules/foo/index.ts")).toBe("starter-next-auth");
    // La spec y el plan de la plantilla no viajan al proyecto nuevo.
    expect(existsSync(path.join(root, "docs/superpowers"))).toBe(false);
  });

  it("is idempotent and never overwrites an existing .env", () => {
    const root = fixture();
    runSetup(root, { name: "mi-idea", remove: ["storage"], secret: "first" });
    writeFileSync(path.join(root, ".env"), "BETTER_AUTH_SECRET=mine\n");
    const again = runSetup(root, { name: "mi-idea", remove: ["storage"], secret: "second" });

    expect(again.changedFiles).toEqual([]);
    expect(again.envCreated).toBe(false);
    expect(read(root, ".env")).toBe("BETTER_AUTH_SECRET=mine\n");
  });

  it("keeps the template docs when run on the template itself", () => {
    const root = fixture();
    runSetup(root, { name: "starter-next-auth", remove: [], secret: "x" });
    expect(existsSync(path.join(root, "docs/superpowers/specs/x.md"))).toBe(true);
  });
});
```

Run: `pnpm vitest run scripts/setup.test.ts`
Expected: FAIL — no se resuelve `./setup.ts`.

- [ ] **Step 2: Implementación**

`scripts/setup.ts`:

```ts
// Convierte la plantilla en un proyecto nuevo: renombra, fija la clave del lock de
// migraciones, crea .env con secreto y quita los módulos opcionales que no se quieran.
// Corre con `node scripts/setup.ts` antes o después de `pnpm install`: solo usa node:*.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";

export const TEMPLATE_NAME = "starter-next-auth";
export const TEMPLATE_SNAKE = "starter_next_auth";
export const MODULES = ["storage", "landing", "pwa", "analytics"] as const;
export type Module = (typeof MODULES)[number];

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
  paths: string[];
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
            pkg.scripts.dev = "next dev";
            pkg.scripts.build = "next build";
            pkg.scripts.typecheck = "tsc --noEmit";
          }
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

export function replaceIdentity(content: string, name: string): string {
  return content.replaceAll(TEMPLATE_NAME, name).replaceAll(TEMPLATE_SNAKE, toSnake(name));
}

export function setLockKey(content: string, key: number): string {
  return content.replace(/MIGRATION_LOCK_KEY = [\d_]+;/, `MIGRATION_LOCK_KEY = ${key};`);
}

// Borra las líneas entre `<optional:x>` y `</optional:x>` (incluidas), sea cual sea el
// estilo de comentario (//, #, {/* */}).
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
  return kept.join("\n");
}

export function withSecret(envExample: string, secret: string): string {
  return envExample.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`);
}

const SKIP_DIRS = new Set(["node_modules", ".git", ".next", ".turbo", "dist", "out", "db-dumps", ".astro"]);
// La skill apunta a la plantilla a propósito; setup.ts y su test contienen el nombre.
const SKIP_PATHS = ["tools/skill", "docs/superpowers", "scripts/setup.ts", "scripts/setup.test.ts"];
const TEXT_FILE =
  /\.(ts|tsx|json|jsonc|ya?ml|md|css|astro|sql|toml)$|(^|\/)(Dockerfile|\.env\.example|\.gitignore|\.dockerignore|\.nvmrc)$/;

export function listTextFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (SKIP_PATHS.some((p) => childRel === p || childRel.startsWith(`${p}/`))) continue;
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

export function runSetup(root: string, opts: SetupOptions): SetupResult {
  const error = validateName(opts.name);
  if (error) throw new Error(error);
  const abs = (rel: string) => path.join(root, rel);

  // 1. Módulos: primero se borran carpetas para no reescribir archivos que se van.
  for (const module of opts.remove) {
    for (const rel of MODULE_SPECS[module].paths) rmSync(abs(rel), { recursive: true, force: true });
    for (const { file, edit } of MODULE_SPECS[module].packageJson ?? []) {
      if (!existsSync(abs(file))) continue;
      const pkg = JSON.parse(readFileSync(abs(file), "utf8")) as PackageJson;
      edit(pkg);
      writeFileSync(abs(file), `${JSON.stringify(pkg, null, 2)}\n`);
    }
  }

  // 2. Identidad, marcadores y clave del lock en todos los archivos de texto.
  const changedFiles: string[] = [];
  const lockKey = lockKeyFor(opts.name);
  for (const rel of listTextFiles(root)) {
    const before = readFileSync(abs(rel), "utf8");
    let after = opts.remove.reduce((text, module) => removeMarkedBlocks(text, module), before);
    if (opts.name !== TEMPLATE_NAME) after = replaceIdentity(after, opts.name);
    if (rel === "packages/db/src/lock-key.ts") after = setLockKey(after, lockKey);
    if (after !== before) {
      writeFileSync(abs(rel), after);
      changedFiles.push(rel);
    }
  }

  // 3. La spec y el plan describen la plantilla, no la idea nueva.
  if (opts.name !== TEMPLATE_NAME) rmSync(abs("docs/superpowers"), { recursive: true, force: true });

  // 4. .env: se crea una sola vez; nunca se pisa uno existente.
  let envCreated = false;
  if (!existsSync(abs(".env")) && existsSync(abs(".env.example"))) {
    const secret = opts.secret ?? randomBytes(32).toString("base64");
    writeFileSync(abs(".env"), withSecret(readFileSync(abs(".env.example"), "utf8"), secret));
    envCreated = true;
  }

  return { changedFiles, envCreated, removed: opts.remove };
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
  const domain = values.domain ?? (rl ? (await rl.question("Dominio de producción (opcional): ")).trim() || undefined : undefined);

  const skip: Record<Module, boolean> = {
    storage: values["no-storage"],
    landing: values["no-landing"],
    pwa: values["no-pwa"],
    analytics: values["no-analytics"],
  };
  const remove: Module[] = [];
  for (const module of MODULES) {
    if (skip[module]) {
      remove.push(module);
    } else if (rl) {
      const answer = (await rl.question(`¿Incluir ${MODULE_LABELS[module]}? (S/n) `)).trim().toLowerCase();
      if (answer === "n" || answer === "no") remove.push(module);
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
```

- [ ] **Step 3: Verificar**

Run: `pnpm vitest run scripts/setup.test.ts && tsc -p scripts --noEmit`
Expected: PASS (todos los tests de setup) y typecheck limpio.

Run (sobre una copia, nunca sobre la plantilla):

```bash
SCRATCH=$(mktemp -d) && git clone -q . "$SCRATCH/demo-idea" && cd "$SCRATCH/demo-idea" \
  && node scripts/setup.ts --name demo-idea --no-storage --no-landing --no-db --yes \
  && git status --short | head -30 && grep -c starter-next-auth -r --include=*.ts --include=*.json --include=*.yaml . --exclude-dir=node_modules --exclude-dir=tools | grep -v ':0' ; cd -
```

Expected: `✓ … archivo(s) actualizados`, `✓ Módulos quitados: storage, landing`, `pnpm install` corre, y el `grep` no lista archivos (solo quedan menciones en `tools/skill` y `scripts/setup*.ts`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(setup): script de bootstrap para convertir la plantilla en un proyecto"
```

---

### Task 15: Skill `/new-starter-next-auth`, documentación y publicación

**Files:**
- Create: `tools/skill/SKILL.md`, `README.md`
- Modify: `AGENTS.md` (versión final)
- Externo: symlink `~/.claude/skills/new-starter-next-auth`, repo `juancadavidc/starter-next-auth` en GitHub

**Interfaces:**
- Consumes: CLI de `scripts/setup.ts` (Task 14), workflows (Task 10).
- Produces: skill invocable como `/new-starter-next-auth`; repo público marcado como template con CI en verde.

- [ ] **Step 1: Skill**

`tools/skill/SKILL.md`:

````markdown
---
name: new-starter-next-auth
description: Úsalo cuando Juan quiera arrancar una idea o app nueva con login de Google, Next.js y Postgres — "nueva idea", "arranca un proyecto", "créame una app con login", "/new-starter-next-auth". Crea el repo desde la plantilla juancadavidc/starter-next-auth en ~/dev/personal/opensource/<nombre>, lo configura (nombre, secretos, módulos opcionales, base local) y lo deja con tests en verde.
---

# /new-starter-next-auth

Crea un proyecto nuevo a partir de la plantilla `juancadavidc/starter-next-auth`
(monorepo Next 16 + Better Auth con Google + Postgres/Drizzle + shadcn/ui, desplegable
en Coolify vía GHCR).

## 1. Preguntar (una sola ronda)

- **Nombre** en kebab-case (3–40 caracteres, empieza por letra). Será el nombre del repo,
  de la carpeta y de la base de datos.
- **Qué se quiere construir**, en una línea (se usa para el README y para el brainstorming).
- **Opcionales** (por defecto todos incluidos): storage R2, landing Astro, PWA, analytics.
- **Dominio de producción** (opcional).

## 2. Confirmar antes de crear el repo

`gh repo create` publica un repo en GitHub: mostrar el comando exacto y esperar un sí.

## 3. Crear y configurar

```bash
cd ~/dev/personal/opensource
gh repo create juancadavidc/<nombre> --template juancadavidc/starter-next-auth --public --clone
cd <nombre>
node scripts/setup.ts --name <nombre> [--domain <dominio>] [--no-storage] [--no-landing] [--no-pwa] [--no-analytics] --yes
```

`setup.ts` renombra, genera `.env` con `BETTER_AUTH_SECRET`, quita los opcionales
rechazados, corre `pnpm install`, levanta Postgres, migra y siembra los usuarios de dev.
Si el puerto 5432 está ocupado por otro proyecto, poner `POSTGRES_PORT` en `.env` (y el
mismo puerto en `DATABASE_URL`) y repetir con `pnpm db:up && pnpm db:migrate && pnpm db:seed:dev`.

Reemplazar la primera línea descriptiva del `README.md` con la línea de la idea.

## 4. Verificar

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Todo debe pasar. Si algo falla, diagnosticar antes de seguir (no reportar éxito).

## 5. Primer commit y push

```bash
git add -A && git commit -m "chore: proyecto creado desde starter-next-auth" && git push
```

(Sin trailers de atribución.)

## 6. Siguientes pasos para Juan

- Crear el OAuth client de Google con los valores que imprimió `setup.ts`.
- Poner su correo en `ADMIN_EMAILS`.
- Ofrecer arrancar el brainstorming de superpowers sobre la idea.
- Cuando quiera desplegar: `/coolify-deploy` y luego `gh secret set COOLIFY_WEBHOOK_URL` /
  `gh secret set COOLIFY_TOKEN`. El paquete de GHCR nace privado: hacerlo público en
  GitHub → Packages → Settings o darle credenciales de GHCR a Coolify.
````

Instalar la skill con symlink (así viaja con la plantilla):

```bash
ln -s ~/dev/personal/opensource/starter-next-auth/tools/skill ~/.claude/skills/new-starter-next-auth
ls -la ~/.claude/skills/new-starter-next-auth/SKILL.md
```

Expected: el symlink resuelve al `SKILL.md`.

- [ ] **Step 2: README**

`README.md`:

````markdown
# starter-next-auth

Plantilla para arrancar ideas: **Next 16 + Better Auth (Google) + Postgres (Drizzle)** en un
monorepo pnpm/Turborepo, con shadcn/ui, tests contra Postgres real y despliegue
GitHub Actions → GHCR → Coolify.

## Qué trae

- Login con Google; en desarrollo, atajos "Entrar como admin/user" sin OAuth.
- Roles `admin` / `user`. El primer admin sale de `ADMIN_EMAILS`; después, `/admin/users`.
- Onboarding mínimo (nombre) con guard: nadie entra a `/app` sin perfil completo.
- Migraciones Drizzle que se aplican al arrancar el contenedor, con advisory lock.
- shadcn/ui con tokens claro/oscuro; `brand-lint` prohíbe colores crudos.
- CI: lint, tipos, tests, migraciones solo aditivas y smoke test de la imagen.
- Opcionales: storage R2, landing Astro, PWA, Google Analytics.

## Crear una idea nueva

Con Claude Code: **`/new-starter-next-auth`**.

A mano:

```bash
gh repo create juancadavidc/mi-idea --template juancadavidc/starter-next-auth --public --clone
cd mi-idea
pnpm bootstrap            # o: node scripts/setup.ts --name mi-idea --no-landing --yes
```

## Desarrollo local

Requisitos: Node 24 (`nvm use`), pnpm 10, Docker.

```bash
pnpm install
pnpm db:up               # Postgres 17 en :5432 (POSTGRES_PORT para cambiarlo)
pnpm db:migrate
pnpm db:seed:dev         # admin@local.test / user@local.test, clave starter-dev
pnpm dev                 # http://localhost:3000
```

## Google OAuth

console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web):

- Orígenes: `http://localhost:3000`, `https://<dominio>`
- Redirects: `http://localhost:3000/api/auth/callback/google`, `https://<dominio>/api/auth/callback/google`

Copia los valores a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. En producción son obligatorios.

## Estructura

| Carpeta | Qué hay |
|---|---|
| `apps/web` | La app Next (App Router, `proxy.ts`, server actions) |
| `apps/landing` | Landing estática en Astro (opcional) |
| `packages/env` | Variables de entorno fail-fast |
| `packages/db` | Schema, migraciones, cliente y `runMigrations()` |
| `packages/auth` | Better Auth, roles, guards, login de dev |
| `packages/ui` | shadcn/ui y tokens de marca |
| `packages/storage` | R2 + variantes webp (opcional) |
| `docker/` | Dockerfile y entrypoint (migrar → servir) |
| `scripts/` | `setup.ts`, `brand-lint.ts`, `check-migrations.ts` |

## Base de datos

1. Edita `packages/db/src/schema/app.ts`.
2. `pnpm db:generate` y commit del SQL generado.
3. Nunca edites ni borres una migración existente: agrega otra. Si una migración nueva
   necesita `DROP`/`RENAME`, justifícalo con `-- allow-destructive: <motivo>`.

`pnpm db:dump "<url de producción>"` y `pnpm db:restore db-dumps/<archivo>` traen datos a local.

## Tests

`pnpm test` corre todo contra `<base>_test` (se crea y migra sola). Necesita `pnpm db:up`.

## Desplegar

1. Push a `main` → GitHub Actions publica `ghcr.io/juancadavidc/<repo>/web`.
2. `/coolify-deploy` crea la app "Docker Image" en Coolify con las variables de
   `docker-compose.yaml`.
3. `gh secret set COOLIFY_WEBHOOK_URL` y `gh secret set COOLIFY_TOKEN`: desde ahí cada
   merge redepliega solo.

El contenedor aplica las migraciones al arrancar; si fallan, no arranca.
`SKIP_MIGRATIONS=1` permite entrar a mirar sin tocar la base.
````

- [ ] **Step 3: AGENTS.md final**

Agregar al final de `AGENTS.md`:

```markdown
## Dónde va cada cosa

- Reglas de acceso: `packages/auth/src/access.ts` (pura) y guards en `guards.ts`.
- Tablas nuevas: `packages/db/src/schema/app.ts` → `pnpm db:generate`.
- Componentes: `pnpm dlx shadcn@latest add <x> --cwd packages/ui`.
- Caché de datos: `apps/web/src/lib/cache.ts` (único lugar con `unstable_cache`).
- Variables nuevas: getter en `packages/env/src/index.ts` + `.env.example` +
  `docker-compose.yaml`.

## Comandos

`pnpm dev` · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm brand-lint` ·
`pnpm db:up|db:migrate|db:generate|db:seed:dev|db:studio`

## Despliegue

GitHub Actions → GHCR → Coolify (`/coolify-deploy`, `/coolify-debug`). Coolify no
construye imágenes. Las migraciones corren en `docker/entrypoint.ts` al arrancar.
```

- [ ] **Step 4: Verificación final local**

Run: `pnpm install && pnpm lint && pnpm typecheck && pnpm brand-lint && pnpm test && pnpm build`
Expected: todo en verde.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: README, AGENTS y skill /new-starter-next-auth"
```

- [ ] **Step 6: Publicar en GitHub (confirmar con Juan antes)**

Crear un repo público es externo: mostrar los comandos y esperar un sí explícito.

```bash
gh repo create juancadavidc/starter-next-auth --public --source . --push \
  --description "Plantilla: Next 16 + Better Auth (Google) + Postgres (Drizzle) en monorepo"
gh api -X PATCH repos/juancadavidc/starter-next-auth -F is_template=true
gh run watch --exit-status
```

Expected: CI (`checks` e `image-smoke`) y `Build and push` en verde; el job `deploy`
termina con el aviso de "Sin COOLIFY_WEBHOOK_URL" (esperado sin app en Coolify).

- [ ] **Step 7: Prueba de extremo a extremo de la skill**

En una sesión nueva de Claude Code, invocar `/new-starter-next-auth` con el nombre
`demo-idea` y todos los opcionales. Antes, detener el Postgres de la plantilla
(`docker compose -f docker-compose.local.yaml stop`) para liberar el puerto.

Expected: repo `juancadavidc/demo-idea` creado, `pnpm typecheck && pnpm lint && pnpm test`
en verde, login de dev funcionando en `http://localhost:3000`. Después, con confirmación de
Juan, borrar el repo de prueba: `gh repo delete juancadavidc/demo-idea --yes`.
