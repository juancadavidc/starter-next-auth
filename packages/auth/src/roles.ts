// Roles del sistema. El resto de roles son datos (tabla role) y se gestionan en /admin/roles.
export const ADMIN_ROLE = "admin";
export const DEFAULT_ROLE = "user";
export const SYSTEM_ROLES: readonly string[] = [ADMIN_ROLE, DEFAULT_ROLE];

// Clave de un rol nuevo: minúsculas, dígitos y guiones; es lo que guarda user.role.
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

export function isRoleKey(value: unknown): value is string {
  return typeof value === "string" && ROLE_KEY_PATTERN.test(value);
}

// ADMIN_EMAILS llega como "a@x.com, B@x.com,". Se normaliza a minúsculas sin vacíos.
export function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function roleForEmail(email: string, adminEmails: string[]): string {
  return adminEmails.includes(email.trim().toLowerCase()) ? ADMIN_ROLE : DEFAULT_ROLE;
}
