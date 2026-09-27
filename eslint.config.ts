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
