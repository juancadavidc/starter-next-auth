# starter-next-auth — diseño

Fecha: 2026-09-26
Estado: aprobado en conversación, pendiente de revisión escrita

## 1. Objetivo

Plantilla (bootstrap) para arrancar ideas nuevas: un monorepo con Next.js, login con
Google (Better Auth) y Postgres, listo para desplegar con el flujo de la org
(GitHub Actions → GHCR → Coolify).

**Criterio de éxito:** de "tengo una idea" a una app con login de Google, roles
admin/user, tests en verde y desplegable en Coolify en minutos, sin copiar código de
otros repos.

**Origen:** se extrae la capa de plataforma de `benestare` (Better Auth + Google, login
de desarrollo, guard de onboarding, `ADMIN_EMAILS`, migrar al arrancar, PWA) y de
`griferia-baru` (Drizzle, advisory lock en migraciones, `env` fail-fast, guards +
`ApiError`, Vitest con Postgres real y mocks de Next, R2 + sharp, compose sin
defaults, brand-lint). No se lleva nada del dominio de ninguno de los dos.

### Convenciones

- **Código en inglés, comentarios en español.** Copy visible al usuario en español;
  sin i18n en el núcleo.
- Node 24 LTS (`.nvmrc` + `engines`), pnpm fijado con `packageManager`.
- **Todo es TypeScript.** No hay archivos `.js`/`.mjs` escritos a mano: scripts, configs
  (`eslint.config.ts`, `next.config.ts`, `drizzle.config.ts`, `vitest.config.ts`,
  `astro.config.ts`), entrypoint del contenedor y skill tooling van en `.ts`.
  - Los scripts de desarrollo (`setup.ts`, `brand-lint.ts`, `check-migrations.ts`) se
    ejecutan con el *type stripping* nativo de Node (`node scripts/setup.ts`), sin
    dependencias. Solo `scripts/` tiene un `tsconfig` propio con `erasableSyntaxOnly`
    (sin `enum`, `namespace` ni parameter properties) e imports relativos con extensión
    `.ts`; el resto del monorepo no lleva esas restricciones (Next, Vitest y esbuild
    compilan por su cuenta).
  - `setup.ts` corre antes de `pnpm install`: es autocontenido y solo importa módulos
    `node:*`.
  - El service worker de la PWA se escribe en `apps/web/src/sw.ts` y se compila con
    esbuild a `public/sw.js` en el build (el `.js` generado no se versiona).
  - La config de PostCSS que Tailwind v4 usa en Next va en `postcss.config.json`
    (formato que Next soporta), así que no queda ningún archivo JS a mano.
  - Lo que corre en la imagen de producción se compila (ver sección 6); en runtime
    solo hay JavaScript generado, nunca fuentes a mano.
- Repo público `juancadavidc/starter-next-auth`, marcado como *template* en GitHub.
  Vive en `~/dev/personal/opensource/starter-next-auth`.

### Fuera de alcance

- Multi-tenant / organizaciones (se agrega como módulo si una idea lo pide).
- Roles configurables más allá de `admin` / `user`.
- i18n, e2e con Playwright, ui-loop de Baru (agentes de UI + verify-ui).
- CLI propio tipo `create-*`.
- Crear el OAuth client de Google automáticamente.

## 2. Estructura

```
starter-next-auth/
  apps/
    web/                   Next 16 App Router, output standalone
    landing/               Astro → Cloudflare                       [opcional]
  packages/
    env/                   required() fail-fast; objeto `env` tipado
    db/                    Drizzle + postgres.js: schema, migraciones, cliente, runMigrations()
    auth/                  Better Auth server + client, guards, roles, login de dev
    ui/                    shadcn/ui + tokens Tailwind v4 (claro/oscuro) + brand-lint
    storage/               R2 (S3 SDK) + variantes webp con sharp       [opcional]
    config/                tsconfig base, eslint, preset de vitest
  docker/
    Dockerfile
    entrypoint.ts
  docker-compose.yaml        producción (Coolify)
  docker-compose.local.yaml  Postgres 17 local (+ servicio para probar la imagen)
  .github/workflows/
    ci.yml
    build-and-push.yml
  scripts/                 setup.ts, brand-lint.ts, check-migrations.ts
  tools/skill/             fuente de la skill /new-starter-next-auth
  .claude/settings.json    plugins habilitados: superpowers, ui-ux-pro-max
  AGENTS.md                reglas duras (CLAUDE.md → @AGENTS.md)
  README.md                de cero a desplegado
```

- **pnpm workspaces + Turborepo.**
- **Paquetes internos como TypeScript fuente** (sin build propio); `apps/web` los
  consume con `transpilePackages`.
- Opcionales (`storage`, `landing`, PWA, analytics) vienen incluidos y compilan
  siempre; `setup.ts` los elimina si el usuario no los quiere.

## 3. Autenticación y usuarios

### Configuración (`packages/auth`)

- `drizzleAdapter` sobre el schema de `packages/db`.
- `socialProviders.google` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- Plugin `admin()` → campos `role`, `banned`, `banReason`, `banExpires` y API de gestión.
- Campo adicional `profileCompleted: boolean` (`input: false`, default `false`).
- `databaseHooks.user.create.before`: `role = "admin"` si el correo (normalizado a
  minúsculas) está en `ADMIN_EMAILS`, si no `"user"`. Solo aplica al crear la cuenta.
- Sesión: 30 días, `updateAge` 1 día, `cookieCache` **apagado** (el cambio de
  `profileCompleted` debe verse en la misma sesión).
- **Login de desarrollo:** `emailAndPassword.enabled = NODE_ENV !== "production"`.
  `pnpm db:seed:dev` crea `admin@local.test` y `user@local.test` (clave
  `starter-dev`). La pantalla de login muestra los atajos solo en desarrollo.
- `nextCookies()` para que las server actions puedan fijar cookies.

### Rutas y flujo

```
/              pública: presentación mínima + "Entrar con Google"
/login         Google (+ atajos de dev)
/onboarding    formulario mínimo (nombre) → profileCompleted = true
/app/**        sesión + perfil completo
/admin/**      role = admin
  /admin/users lista, cambiar rol, banear/desbanear
```

Tras el callback: si `profileCompleted` es falso → `/onboarding`; si no → `/app`.

### Guards

| Contexto | Funciones | Falla con |
|---|---|---|
| Páginas (Server Components) | `requireUser()`, `requireCompletedProfile()`, `requireAdmin()` | `redirect()` a `/login`, `/onboarding` o `/app` |
| Route handlers y server actions | `requireUserApi()`, `requireAdminApi()` | `ApiError(401 \| 403)` |

- `handleApiError(error)` convierte `ApiError` en JSON `{ error }` con su status y
  cualquier otro error en 500 (con `console.error`).
- **Cada página llama a su guard.** Los layouts no protegen nada.
- `proxy.ts` solo hace una redirección optimista a `/login` si no hay cookie de sesión
  en `/app` y `/admin`. No es barrera de seguridad.

## 4. Datos

- `postgres.js` + Drizzle, conexión por `DATABASE_URL`.
- Schema en `packages/db/src/schema/`: `auth.ts` (user, session, account,
  verification — escrito siguiendo el schema que genera el CLI de Better Auth, más
  `profileCompleted`) y `app.ts`
  (vacío, con un ejemplo comentado).
- Scripts del paquete: `db:generate` (drizzle-kit), `db:migrate` (`runMigrations()`),
  `db:studio`, `db:dump`, `db:restore`. `db:seed:dev` vive en `packages/auth` (usa Better
  Auth para crear las cuentas); desde la raíz todos se llaman igual (`pnpm db:*`).
- `runMigrations(databaseUrl)`: toma `pg_advisory_lock(LOCK_KEY)`, aplica
  `migrate()`, libera en `finally`. `LOCK_KEY` es una constante derivada del nombre
  del proyecto, fijada por `setup.ts`.
- **Caché:** todo `unstable_cache` / `revalidateTag` en un solo módulo por app; las
  páginas que leen de la base son dinámicas, de modo que `next build` nunca necesita
  Postgres.
- **Migraciones aditivas:** `scripts/check-migrations.ts` corre en CI y falla si
  (a) un `.sql` de `packages/db/migrations/` ya existente se borra, modifica o
  renombra (las aplicadas son historia; `meta/` sí puede cambiar porque drizzle-kit
  la regenera), o (b) un `.sql` nuevo contiene `DROP`, `RENAME` o `ALTER ... TYPE`,
  salvo que lleve el comentario `-- allow-destructive: <motivo>`.

### Variables de entorno (`packages/env`)

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `ADMIN_EMAILS`; opcionales `NEXT_PUBLIC_GA_ID` y, con storage,
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

- `required(name)` lanza `Falta la variable de entorno <name>` al primer acceso.
- `SKIP_ENV_VALIDATION=1` (solo en el build de CI/Docker) devuelve valores vacíos en
  vez de lanzar.

## 5. UI

- `packages/ui`: shadcn/ui sobre Tailwind v4. Componentes iniciales: Button, Input,
  Label, Card, Dialog, DropdownMenu, Table, Avatar, Sonner.
- Tokens semánticos como variables CSS en un solo archivo, con valores para claro y
  oscuro. Cambiar la identidad de una idea = editar tokens.
- Modo oscuro por clase (`next-themes`), respetando la preferencia del sistema.
- `brand-lint`: falla si un `.ts/.tsx` contiene colores crudos (hex, `rgb()`,
  `hsl()`, `oklch()`) fuera del archivo de tokens; admite excepciones puntuales
  documentadas (archivo + patrón).

## 6. Despliegue

### Imagen

- `docker/Dockerfile`: `turbo prune web --docker` → `pnpm install --frozen-lockfile`
  → `SKIP_ENV_VALIDATION=1 turbo build --filter=web` → runner `node:24-slim` con la
  salida standalone. `outputFileTracingRoot` apunta a la raíz del monorepo.
- `docker/entrypoint.ts` importa `runMigrations()` de `packages/db` (una sola fuente;
  no se duplica la lógica como en Baru). En la etapa de build se empaqueta con
  `esbuild` a un único `entrypoint.js` (bundle con `postgres` y `drizzle-orm`
  incluidos), así que el runner no necesita `node_modules` extra ni `tsx`. La imagen
  copia además la carpeta de migraciones SQL.
- `entrypoint.ts`: si el comando es el servidor y `SKIP_MIGRATIONS !== "1"`,
  corre las migraciones con lock; si fallan, `exit 1`. Luego lanza `server.js`
  reenviando `SIGTERM`/`SIGINT` y propagando el código de salida.

### Compose

- `docker-compose.yaml` (producción): imagen
  `ghcr.io/juancadavidc/<proyecto>/web:${TAG:-latest}`, `expose: ["3000"]` (sin
  `ports`), variables como `${VAR:?falta VAR}` sin defaults.
- `docker-compose.local.yaml`: Postgres 17 con volumen y un servicio `web` opcional
  para probar la imagen.

### CI/CD

- `ci.yml` (PR y push): install, lint, typecheck, brand-lint, check de migraciones
  aditivas, tests con Postgres como service.
- `ci.yml` también construye la imagen y hace un **smoke test**: la levanta contra un
  Postgres de servicio y verifica que `GET /api/health` y `GET /api/health/db`
  responden 200. `/api/health` es liveness y **no** toca la base (una caída de
  Postgres no debe hacer que Coolify reinicie el contenedor en falso; lección de
  benestare); `/api/health/db` consulta `SELECT 1` y la tabla `user` (prueba que
  las migraciones corrieron). Protege el entrypoint empaquetado y el
  Dockerfile.
- `build-and-push.yml` (push a `main`): build de la imagen, push a GHCR con tags
  `sha` y `latest` usando `GITHUB_TOKEN`, y `curl` al webhook de Coolify
  (`COOLIFY_WEBHOOK_URL`, `COOLIFY_TOKEN` como secrets). Si faltan los secrets, el
  paso se salta con aviso en vez de fallar.
- Compatible con el plugin `coolify-devops`: la plantilla ya trae el workflow, así que
  `/coolify-deploy` solo crea la app "Docker Image" y configura el webhook.

## 7. Testing

- Preset de Vitest en `packages/config`; `vitest.setup.ts` mockea `server-only` y
  `next/cache`.
- Postgres real: `globalSetup` crea una base `<proyecto>_test`, la migra y la borra
  al final. En CI, Postgres como service.
- Tests incluidos:
  - Guards de página y de API (sin sesión, rol insuficiente, perfil incompleto).
  - Hook de `ADMIN_EMAILS` (mayúsculas, espacios, lista vacía).
  - Login de dev apagado con `NODE_ENV=production`.
  - `env`: falla si falta una variable; no falla con `SKIP_ENV_VALIDATION=1`.
  - `runMigrations`: idempotente y seguro con dos llamadas concurrentes.
  - `handleApiError`.
  - Test de arquitectura: ningún módulo con `"use client"` importa `@repo/db` ni
    `@repo/auth/server`.
  - `brand-lint` y el check de migraciones con casos fixture.

## 8. Setup y skill

### `scripts/setup.ts`

TypeScript ejecutado por Node sin dependencias (funciona antes de `pnpm install`),
idempotente, `pnpm bootstrap` (`pnpm setup` es un comando interno de pnpm y no sirve
como nombre de script). Modo interactivo o por flags
(`--name`, `--domain`, `--no-storage`, `--no-landing`, `--no-pwa`, `--no-analytics`,
`--yes`).

1. Nombre del proyecto (kebab-case, validado) y dominio de producción (opcional).
2. Reemplaza `starter-next-auth` en package.json, compose, workflows, README, título
   y metadata de la app; fija `LOCK_KEY` derivado del nombre.
3. Genera `BETTER_AUTH_SECRET` y crea `.env` desde `.env.example` sin sobrescribir
   uno existente.
4. Por cada opcional rechazado: borra sus carpetas y quita referencias (deps,
   imports, variables de `.env.example`, pasos de workflow).
5. Levanta Postgres local, migra y siembra usuarios de dev (se puede saltar con
   `--no-db`).
6. Imprime los pendientes: OAuth client de Google (orígenes y redirect exactos),
   `ADMIN_EMAILS`, secrets de GitHub, `/coolify-deploy`.

### Skill `/new-starter-next-auth`

- Fuente en `tools/skill/SKILL.md` del repo de la plantilla; instalada con symlink en
  `~/.claude/skills/new-starter-next-auth/`.
- Flujo:
  1. Pregunta nombre, qué se quiere construir (una línea) y opcionales.
  2. `gh repo create juancadavidc/<nombre> --template juancadavidc/starter-next-auth
     --public --clone` en `~/dev/personal/opensource/<nombre>`.
  3. `node scripts/setup.ts --name <nombre> [--no-...] --yes` (el script corre `pnpm install`,
     levanta Postgres, migra y siembra).
  4. Verifica `pnpm typecheck && pnpm test`.
  5. Ofrece continuar con el brainstorming de superpowers sobre la idea y, cuando
     toque, `/coolify-deploy`.
- No crea el OAuth client de Google; deja enlace y valores exactos a copiar.

## 9. Orden de construcción sugerido

1. Monorepo base: pnpm, turbo, `packages/config`, `packages/env`.
2. `packages/db` + Postgres local + `runMigrations` con lock y sus tests.
3. `packages/auth` + guards + tests.
4. `packages/ui` (shadcn, tokens, modo oscuro, brand-lint).
5. `apps/web`: páginas, onboarding, `/admin/users`, `proxy.ts`.
6. Docker + entrypoint + compose; verificar la imagen en local.
7. CI/CD.
8. Opcionales: storage, PWA, analytics, landing.
9. `setup.ts` + skill + README/AGENTS.md; marcar el repo como template.
