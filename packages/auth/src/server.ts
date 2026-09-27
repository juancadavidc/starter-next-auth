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

// Endpoints HTTP del plugin admin (/api/auth/admin/*). La app no los usa: roles y baneos
// pasan por apps/web/src/lib/admin-users.ts, que aplica la regla "un admin no se toca a sí
// mismo". Expuestos, un admin podría saltársela (set-role, ban-user, impersonate-user,
// create-user, set-user-password…). Se apagan todos; auth.api.* en el servidor sigue
// funcionando porque disabledPaths solo filtra peticiones HTTP.
export const DISABLED_ADMIN_PATHS = [
  "/admin/set-role",
  "/admin/get-user",
  "/admin/create-user",
  "/admin/update-user",
  "/admin/list-users",
  "/admin/list-user-sessions",
  "/admin/unban-user",
  "/admin/ban-user",
  "/admin/impersonate-user",
  "/admin/stop-impersonating",
  "/admin/revoke-user-session",
  "/admin/revoke-user-sessions",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/has-permission",
];

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  disabledPaths: DISABLED_ADMIN_PATHS,
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
