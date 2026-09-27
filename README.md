# starter-next-auth

Plantilla para arrancar ideas: **Next 16 + Better Auth (Google) + Postgres (Drizzle)** en un
monorepo pnpm/Turborepo, con shadcn/ui, tests contra Postgres real y despliegue
GitHub Actions → GHCR → Coolify.

## Qué trae

- Login con Google; en desarrollo, atajos "Entrar como admin/user" sin OAuth.
- Roles `admin` / `user`. El primer admin sale de `ADMIN_EMAILS` (solo al crear la
  cuenta); después, `/admin/users`.
- Onboarding mínimo (nombre) con guard: nadie entra a `/app` sin perfil completo.
- Migraciones Drizzle que se aplican al arrancar el contenedor, con advisory lock.
- shadcn/ui con tokens claro/oscuro; `brand-lint` prohíbe colores crudos.
- CI: lint, tipos, tests, migraciones solo aditivas y smoke test de la imagen.
- Opcionales: storage R2, landing Astro, PWA, Google Analytics.

## Crear una idea nueva

<!-- <keep:template> -->
Con Claude Code: **`/new-starter-next-auth`**.
<!-- </keep:template> -->

A mano:

```bash
<!-- <keep:template> -->
gh repo create juancadavidc/mi-idea --template juancadavidc/starter-next-auth --public --clone
<!-- </keep:template> -->
cd mi-idea
pnpm bootstrap            # o: node scripts/setup.ts --name mi-idea --no-landing --yes
```

`setup.ts` renombra el proyecto (kebab y snake_case), genera `.env` con un
`BETTER_AUTH_SECRET` nuevo, quita los módulos opcionales rechazados, instala
dependencias, levanta Postgres, migra y siembra los usuarios de desarrollo. Nunca
sobrescribe un `.env` ya existente y es idempotente (correrlo dos veces no rompe nada).
Si se quitó algún opcional, commitea el `pnpm-lock.yaml` regenerado antes de abrir CI
(el workflow usa `--frozen-lockfile`).

## Desarrollo local

Requisitos: Node 24 (`nvm use`), pnpm 10, Docker.

```bash
pnpm install
pnpm db:up               # Postgres 17 en :5432 (POSTGRES_PORT en .env para cambiarlo
                          # si el puerto ya está ocupado por otro proyecto)
pnpm db:migrate
pnpm db:seed:dev         # admin@local.test / user@local.test, clave starter-dev
pnpm dev                 # http://localhost:3000
```

## Google OAuth

console.cloud.google.com → APIs & Services → Credentials → OAuth client ID (Web):

- Orígenes: `http://localhost:3000`, `https://<dominio>`
- Redirects: `http://localhost:3000/api/auth/callback/google`,
  `https://<dominio>/api/auth/callback/google` (en general,
  `<BETTER_AUTH_URL>/api/auth/callback/google` para cada origen)

Copia los valores a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`. En producción son
obligatorios (sin ellos el server no arranca).

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

La landing (opcional) apunta a la app con la variable `PUBLIC_APP_URL` (Astro/Vite);
sin ella cae a `http://localhost:3000`. En Cloudflare Pages/Wrangler, defínela como
variable de build apuntando al dominio de producción de la app.

## Base de datos

1. Edita `packages/db/src/schema/app.ts`.
2. `pnpm db:generate` y commit del SQL generado.
3. Nunca edites ni borres una migración existente: agrega otra. Si una migración nueva
   necesita `DROP`/`RENAME`, justifícalo con `-- allow-destructive: <motivo>`.

`pnpm db:dump "<url de producción>"` y `pnpm db:restore db-dumps/<archivo>` traen datos a local.

## Tests

`pnpm test` corre todo contra `<base>_test` (se crea y migra sola). Necesita `pnpm db:up`.

## Build de producción en local

`pnpm build` genera un standalone (`output: "standalone"` en `next.config.ts`); no uses
`next start` para probarlo, avisa que no sirve con ese modo. Dos formas de correr el
resultado real:

- **Servidor standalone**, copiando los estáticos que Next no incluye ahí:
  ```bash
  cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
  cp -r apps/web/public apps/web/.next/standalone/apps/web/public
  node apps/web/.next/standalone/apps/web/server.js
  ```
- **Imagen de Docker** (la misma que corre en Coolify):
  ```bash
  docker compose -f docker-compose.local.yaml --profile image up --build web
  ```

## Desplegar

1. Push a `main` → GitHub Actions publica `ghcr.io/juancadavidc/<repo>/web`. El paquete
   de GHCR nace **privado**: hazlo público en GitHub → Packages → Settings, o dale
   credenciales de GHCR a Coolify.
2. `/coolify-deploy` crea la app "Docker Image" en Coolify con las variables de
   `docker-compose.yaml`.
3. `gh secret set COOLIFY_WEBHOOK_URL` y `gh secret set COOLIFY_TOKEN`: desde ahí cada
   merge redepliega solo (sin esos secrets, el job `deploy` solo avisa y no falla).

El contenedor aplica las migraciones al arrancar; si fallan, no arranca.
`SKIP_MIGRATIONS=1` permite entrar a mirar sin tocar la base.
