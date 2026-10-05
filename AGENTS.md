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
- **Roles y baneos solo por `apps/web/src/lib/admin-users.ts`**, que impide que un admin
  se quite el rol o se banee a sí mismo. Los endpoints HTTP del plugin admin de Better
  Auth (`/api/auth/admin/*`: `set-role`, `ban-user`, `impersonate-user`, `create-user`,
  `set-user-password`…) se saltan esa regla, por eso están apagados con `disabledPaths`
  (`DISABLED_ADMIN_PATHS` en `packages/auth/src/server.ts`). No los reactives ni uses
  `authClient.admin.*` sin replicar la regla; `auth.api.*` en el servidor sí funciona.
- Colores solo por tokens (`packages/ui/src/styles/globals.css`); `pnpm brand-lint` lo exige.
- Next 16 genera `apps/web/AGENTS.md` y `apps/web/CLAUDE.md` al correr `next dev`
  (`generate-agent-files.js`). Están en `.gitignore`: son generados y locales, no se
  commitean; este `AGENTS.md` de la raíz es el que manda.

## Dónde va cada cosa

- Reglas de acceso: `packages/auth/src/access.ts` (pura) y guards en `guards.ts`.
- Tablas nuevas: `packages/db/src/schema/app.ts` → `pnpm db:generate`.
- Componentes: `pnpm dlx shadcn@latest add <x> --cwd packages/ui`.
- Caché de datos: `apps/web/src/lib/cache.ts` (único lugar con `unstable_cache`).
- Variables nuevas: getter en `packages/env/src/index.ts` + `.env.example` +
  `docker-compose.yaml` + `passThroughEnv` de la tarea `dev` en `turbo.json` (sin eso,
  una variable exportada en el shell no llega a `pnpm dev`). Si es `NEXT_PUBLIC_*`, se
  hornea en build: va como build-arg en `docker/Dockerfile` y en `build-args` de
  `staging.yml` y `release.yml`.
<!-- <optional:storage> -->
- Las variables de un módulo van en su paquete: las `R2_*` de storage tienen su getter en
  `packages/storage/src/env.ts` y siguen el mismo camino (`.env.example`,
  `docker-compose.yaml`, `turbo.json`).
- Archivos: siempre por `@repo/storage/objects` (`putObject`, `getObject`,
  `deleteObjects`, `listObjects`) o `@repo/storage/upload`, nunca con el SDK de S3 directo.
  Usa R2 si hay `R2_ACCOUNT_ID` y siempre en producción; en desarrollo y tests, sin
  credenciales, un directorio local (`STORAGE_LOCAL_DIR`, por defecto `.storage`).
<!-- </optional:storage> -->

## Comandos

`pnpm dev` · `pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm brand-lint` ·
`pnpm db:up|db:migrate|db:generate|db:seed:dev|db:studio`

## Despliegue

GitHub Actions → GHCR → Coolify (`/coolify-deploy`, `/coolify-debug`). Los workflows
llaman a los comunes de `juancadavidc/shared-gha-stackless@v1`: `ci.yml` (PR: checks y
smoke), `staging.yml` (merge a `main` → `:staging` → Coolify staging) y `release.yml`
(pre-release `vX.Y.Z-rc.N` → `:vX.Y.Z` + `:latest` → Coolify producción). Esos flujos solo
publican si pasan los checks y el smoke; no agregues un workflow de publicación aparte que
se los salte. Si hace falta algo que el repo común no cubre, cámbialo allá. Coolify no construye imágenes. Las
migraciones corren en `docker/entrypoint.ts` al arrancar.
