import type { Role } from "./roles";

// Atajo para entrar sin credenciales de Google. En producción el único camino es Google.
export function isDevLoginEnabled(nodeEnv: string = process.env.NODE_ENV ?? "development"): boolean {
  return nodeEnv !== "production";
}

export const DEV_PASSWORD = "starter-dev";

// Dominio .test: reservado, nunca enruta correo real.
export const DEV_USERS: { email: string; name: string; role: Role }[] = [
  { email: "admin@local.test", name: "Admin Local", role: "admin" },
  { email: "user@local.test", name: "Usuario Local", role: "user" },
];
