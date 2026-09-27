// Variables de entorno del núcleo. Se leen en cada acceso (getters) para que los tests
// puedan cambiarlas y para que importar este módulo nunca falle por sí solo.

export function required(name: string): string {
  const value = process.env[name];
  if (value) return value;
  // En `next build` no hay secretos: el build corre con SKIP_ENV_VALIDATION=1.
  if (process.env.SKIP_ENV_VALIDATION === "1") return "";
  throw new Error(`Falta la variable de entorno ${name}`);
}

export function optional(name: string): string | undefined {
  const value = process.env[name];
  return value ? value : undefined;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get betterAuthSecret() {
    return required("BETTER_AUTH_SECRET");
  },
  get betterAuthUrl() {
    return optional("BETTER_AUTH_URL") ?? "http://localhost:3000";
  },
  // Opcionales aquí: en desarrollo se puede entrar sin Google (login de dev). En
  // producción los exige packages/auth/src/server.ts.
  get googleClientId() {
    return optional("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return optional("GOOGLE_CLIENT_SECRET");
  },
  // Lista separada por comas; vacía significa que nadie nace admin.
  get adminEmails() {
    return process.env.ADMIN_EMAILS ?? "";
  },
  get nodeEnv() {
    return process.env.NODE_ENV ?? "development";
  },
};
