import type { Permission } from "./permissions";

// Atajo para entrar sin credenciales de Google. En producción el único camino es Google.
export function isDevLoginEnabled(nodeEnv: string = process.env.NODE_ENV ?? "development"): boolean {
  return nodeEnv !== "production";
}

export const DEV_PASSWORD = "starter-dev";

// Rol de ejemplo que siembra db:seed:dev, para ver un rol dinámico sin crearlo a mano.
export const DEV_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  {
    key: "soporte",
    name: "Soporte",
    description: "Ejemplo de desarrollo: ve la lista de usuarios pero no los cambia.",
    permissions: ["users.view"],
  },
];

// Dominio .test: reservado, nunca enruta correo real.
export const DEV_USERS: { email: string; name: string; role: string; label: string }[] = [
  { email: "admin@local.test", name: "Admin Local", role: "admin", label: "Administrador" },
  { email: "soporte@local.test", name: "Soporte Local", role: "soporte", label: "Soporte" },
  { email: "user@local.test", name: "Usuario Local", role: "user", label: "Usuario" },
];
