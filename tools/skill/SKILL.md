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
rechazados, corre `pnpm install`, levanta Postgres, migra y siembra los usuarios de dev
(`admin@local.test` / `user@local.test`, clave `starter-dev`).
Si el puerto 5432 está ocupado por otro proyecto, poner `POSTGRES_PORT` en `.env` (y el
mismo puerto en `DATABASE_URL`) y repetir con `pnpm db:up && pnpm db:migrate && pnpm db:seed:dev`.

Reemplazar la primera línea descriptiva del `README.md` con la línea de la idea (no tocar
la región `<!-- <keep:template> -->` … `<!-- </keep:template> -->`: ahí vive el comando
`gh repo create ... --template juancadavidc/starter-next-auth`, que debe seguir apuntando
a la plantilla).

Si se quitó algún opcional, `pnpm install` ya deja el `pnpm-lock.yaml` regenerado
(`setup.ts` lo corre solo); confirmar que quedó en el commit del paso 5 antes de hacer
push, porque CI usa `--frozen-lockfile`.

## 4. Verificar

```bash
pnpm typecheck && pnpm lint && pnpm brand-lint && pnpm test
```

Todo debe pasar. Si algo falla, diagnosticar antes de seguir (no reportar éxito).

## 5. Primer commit y push

```bash
git add -A && git commit -m "chore: proyecto creado desde starter-next-auth" && git push
```

(Sin trailers de atribución.)

## 6. Siguientes pasos para Juan

- Crear el OAuth client de Google con los valores que imprimió `setup.ts` (orígenes
  `http://localhost:3000` y `https://<dominio>`; redirects
  `<origen>/api/auth/callback/google`).
- Poner su correo en `ADMIN_EMAILS` **antes** de crear su cuenta (solo aplica al alta;
  si ya existe, cambiar el rol desde `/admin/users` o directo en la base).
- Ofrecer arrancar el brainstorming de superpowers sobre la idea.
- Cuando quiera desplegar: `/coolify-deploy` y luego `gh secret set COOLIFY_WEBHOOK_URL` /
  `gh secret set COOLIFY_TOKEN`. El paquete de GHCR nace privado: hacerlo público en
  GitHub → Packages → Settings o darle credenciales de GHCR a Coolify.
