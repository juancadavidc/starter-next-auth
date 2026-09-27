export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

// ADMIN_EMAILS llega como "a@x.com, B@x.com,". Se normaliza a minúsculas sin vacíos.
export function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function roleForEmail(email: string, adminEmails: string[]): Role {
  return adminEmails.includes(email.trim().toLowerCase()) ? "admin" : "user";
}
