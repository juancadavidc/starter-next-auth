# starter-next-auth

Plantilla para arrancar ideas: **Next 16 + Better Auth (Google) + Postgres (Drizzle)** en un
monorepo pnpm/Turborepo, con shadcn/ui, tests contra Postgres real y despliegue
GitHub Actions → GHCR → Coolify.

## Qué trae

- Login con Google; en desarrollo, atajos "Entrar como Administrador/Soporte/Usuario" sin
  OAuth.
- Roles dinámicos con permisos: se crean y editan en `/admin/roles` y se asignan en
  `/admin/users`. `admin` y `user` vienen de fábrica; el primer admin sale de
  `ADMIN_EMAILS` (solo al crear la cuenta). Ver [Roles y permisos](#roles-y-permisos).
- Onboarding mínimo (nombre) con guard: nadie entra a `/app` sin perfil completo.
- Migraciones Drizzle que se aplican al arrancar el contenedor, con advisory lock.
- shadcn/ui con tokens claro/oscuro; `brand-lint` prohíbe colores crudos.
- CI con los workflows comunes de
  [`shared-gha-stackless`](https://github.com/juancadavidc/shared-gha-stackless): lint,
  tipos, tests, migraciones solo aditivas y smoke test de la imagen. Cada merge a `main`
  despliega **staging**; un pre-release `vX.Y.Z-rc.N` promueve a **producción**.
<!-- <optional:storage> -->
- Opcional: subida de imágenes a Cloudflare R2 con variantes webp.
<!-- </optional:storage> -->
<!-- <optional:landing> -->
- Opcional: landing estática en Astro para Cloudflare.
<!-- </optional:landing> -->
<!-- <optional:pwa> -->
- Opcional: PWA instalable con página sin conexión.
<!-- </optional:pwa> -->
<!-- <optional:analytics> -->
- Opcional: Google Analytics 4 (`NEXT_PUBLIC_GA_ID`; en CI, variable de repo del mismo
  nombre).
<!-- </optional:analytics> -->

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
pnpm db:seed:dev         # admin@ / soporte@ / user@local.test, clave starter-dev
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
| `packages/env` | Variables de entorno fail-fast |
| `packages/db` | Schema, migraciones, cliente y `runMigrations()` |
| `packages/auth` | Better Auth, roles y permisos, guards, login de dev |
| `packages/ui` | shadcn/ui y tokens de marca |
| `docker/` | Dockerfile y entrypoint (migrar → servir) |
| `scripts/` | `setup.ts`, `brand-lint.ts`, `check-migrations.ts` |
<!-- <optional:storage> -->

`packages/storage` (opcional): almacén de objetos y variantes webp; la app sirve los
archivos en `/api/files/<key>`. En producción usa Cloudflare R2 (variables `R2_*`,
obligatorias). En desarrollo y tests, si no hay `R2_ACCOUNT_ID`, guarda en un directorio
local (`.storage`, o `STORAGE_LOCAL_DIR`), así que no hace falta una cuenta de Cloudflare
para arrancar; con las `R2_*` en `.env`, `pnpm dev` usa el bucket.
<!-- </optional:storage> -->
<!-- <optional:landing> -->

`apps/landing` (opcional): landing estática en Astro. Apunta a la app con la variable
`PUBLIC_APP_URL` (Astro/Vite); sin ella cae a `http://localhost:3000`. En Cloudflare
Pages/Wrangler, defínela como variable de build apuntando al dominio de producción de la
app.
<!-- </optional:landing> -->

## Base de datos

1. Edita `packages/db/src/schema/app.ts`.
2. `pnpm db:generate` y commit del SQL generado.
3. Nunca edites ni borres una migración existente: agrega otra. Si una migración nueva
   necesita `DROP`/`RENAME`, justifícalo con `-- allow-destructive: <motivo>`.

`pnpm db:dump "<url de producción>"` y `pnpm db:restore db-dumps/<archivo>` traen datos a local.

## Tests

`pnpm test` corre todo contra `<base>_test` (se crea y migra sola). Necesita `pnpm db:up`.

## Build de producción en local

```bash
SKIP_ENV_VALIDATION=1 pnpm build
```

Genera un standalone (`output: "standalone"` en `next.config.ts`). Sin
`SKIP_ENV_VALIDATION=1` el build exige `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (en
producción son obligatorios); con ellos en `.env`, basta `pnpm build`. No uses
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

Los workflows son llamadas cortas a
[`juancadavidc/shared-gha-stackless`](https://github.com/juancadavidc/shared-gha-stackless)
(`@v1`); la lógica vive allá.

| Workflow | Cuándo | Qué hace |
|----------|--------|----------|
| `ci.yml` | cada PR | checks + smoke test de la imagen |
| `staging.yml` | merge a `main` | checks + smoke → `ghcr.io/<owner>/<repo>/web:staging` y `:<sha>` → redeploy de **staging** |
| `release.yml` | pre-release `vX.Y.Z-rc.N` | checks + smoke sobre ese commit → `:vX.Y.Z` y `:latest` → release final `vX.Y.Z` → redeploy de **producción**, espera y health check |

`latest` es solo de producción y solo lo mueve un release. El repo de la plantilla no
publica ni despliega nada.

1. El primer merge a `main` publica la imagen. El paquete de GHCR nace **privado**:
   hazlo público en GitHub → Packages → Settings, o dale credenciales de GHCR a Coolify.
2. `/coolify-deploy` crea **dos** apps "Docker Image" en Coolify con las variables de
   `docker-compose.yaml`: staging con `TAG=staging` y producción con `TAG=latest`
   (cada una con su base de datos).
3. Secrets y variables:
   ```bash
   gh secret set COOLIFY_TOKEN
   gh secret set COOLIFY_WEBHOOK_URL                            # webhook de staging
   gh secret set COOLIFY_PROD_WEBHOOK_URL --env production      # webhook de producción
   gh variable set STAGING_URL --body https://staging.<dominio>
   gh variable set PRODUCTION_URL --body https://<dominio>      # habilita el health check
   ```
   Sin los de staging, `staging.yml` publica la imagen y solo avisa. En producción, un
   secret faltante hace fallar el release. En Settings → Environments → `production`
   puedes exigir aprobación manual antes de cada deploy.
4. Release a producción:
   ```bash
   gh release create v1.0.0-rc.1 --prerelease --target main --generate-notes
   ```

El contenedor aplica las migraciones al arrancar; si fallan, no arranca.
`SKIP_MIGRATIONS=1` permite entrar a mirar sin tocar la base.

## Roles y permisos

Cada usuario tiene **un rol** (`user.role`) y cada rol, un conjunto de **permisos**.

- **Permisos**: catálogo en código, `packages/auth/src/permissions.ts` (`users.view`,
  `users.manage`, `roles.manage`). Un permiso solo existe si un guard lo revisa, por eso
  no se crean desde la UI.
- **Roles**: datos en las tablas `role` y `role_permission`. Se gestionan en
  `/admin/roles` (permiso `roles.manage`). `admin` tiene todos los permisos por código y no
  se edita; `user` es el rol de toda cuenta nueva (sin permisos de administración, pero
  editable). Ninguno de los dos se borra, ni un rol con usuarios asignados.
- **Asignación**: `/admin/users` (ver: `users.view`; cambiar rol y suspender:
  `users.manage`).
- **Anti-escalada**: nadie cambia su propio rol, se suspende ni edita su rol; solo se
  otorgan (o se gestiona a quien tiene) permisos que uno mismo tiene, y el rol `admin`
  solo lo da o lo quita otro admin. Las reglas viven en `apps/web/src/lib/admin-users.ts`
  y `apps/web/src/lib/admin-roles.ts`, con tests.
- Los permisos se leen en cada petición: editar un rol aplica en el acto, sin re-login.

Para proteger algo nuevo con un permiso:

1. Agrégalo a `PERMISSIONS` en `packages/auth/src/permissions.ts`.
2. Página: `await requirePermission("x.y", "/ruta")`. Server action o route handler:
   `await requirePermissionApi("x.y")`. UI condicional: `hasPermission(user, "x.y")`.
3. Dale el permiso a los roles que correspondan en `/admin/roles` (admin ya lo tiene).

## Recuperar acceso de admin

`ADMIN_EMAILS` solo se aplica al **crear** la cuenta: agregar un correo después no
vuelve admin a un usuario que ya existe. Si la app se quedó sin admins (o necesitas
promover a alguien existente), cambia el rol directo en la base, con `pnpm db:studio`
o con `psql "$DATABASE_URL"`:

```sql
UPDATE "user" SET role = 'admin' WHERE lower(email) = lower('tu-correo@gmail.com');
```

El cambio aplica en la siguiente petición (la sesión no se cachea en cookie).
