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
- Next 16 genera `apps/web/AGENTS.md` y `apps/web/CLAUDE.md` al correr `next dev`
  (`generate-agent-files.js`). Están en `.gitignore`: son generados y locales, no se
  commitean; este `AGENTS.md` de la raíz es el que manda.

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
