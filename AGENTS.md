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
