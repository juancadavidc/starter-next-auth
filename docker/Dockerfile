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
# <optional:analytics>
# NEXT_PUBLIC_* se hornea en el bundle: llega como build arg, no como env de Coolify.
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
# </optional:analytics>
# El build no tiene secretos ni base de datos. BETTER_AUTH_SECRET es un placeholder solo
# para esta línea de build (silencia el warning de "default secret" de Better Auth); nunca
# se usa en runtime ni se fija como ENV de la imagen. `--env-mode=loose` es necesario para
# que turbo (que por defecto solo deja pasar las env vars declaradas en turbo.json) le
# entregue esta variable al proceso de build; turbo.json no se toca.
RUN SKIP_ENV_VALIDATION=1 BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime \
      pnpm turbo run build --filter=web --env-mode=loose
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
