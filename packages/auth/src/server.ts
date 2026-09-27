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

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
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
