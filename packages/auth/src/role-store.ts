import "server-only";
import { asc, db, eq, schema } from "@repo/db";
import { resolvePermissions, type Permission } from "./permissions";
import { ADMIN_ROLE } from "./roles";

// Lecturas de roles que comparten la sesión y el panel de admin. Las escrituras (y sus
// reglas) están en apps/web/src/lib/admin-roles.ts.

export type RoleRecord = {
  key: string;
  name: string;
  description: string;
  system: boolean;
  permissions: Permission[];
};

// Filas crudas de role_permission (toSessionUser las resuelve). admin no guarda filas:
// resolvePermissions le da todo.
export async function getStoredPermissions(roleKey: string): Promise<string[]> {
  if (roleKey === ADMIN_ROLE) return [];
  const rows = await db
    .select({ permission: schema.rolePermission.permission })
    .from(schema.rolePermission)
    .where(eq(schema.rolePermission.roleKey, roleKey));
  return rows.map((r) => r.permission);
}

export async function getRolePermissions(roleKey: string): Promise<Permission[]> {
  return resolvePermissions(roleKey, await getStoredPermissions(roleKey));
}

export async function getRole(roleKey: string): Promise<RoleRecord | null> {
  const [row] = await db.select().from(schema.role).where(eq(schema.role.key, roleKey));
  if (!row) return null;
  return { ...pick(row), permissions: await getRolePermissions(row.key) };
}

export async function listRoles(): Promise<RoleRecord[]> {
  const [roles, perms] = await Promise.all([
    db.select().from(schema.role).orderBy(asc(schema.role.createdAt), asc(schema.role.key)),
    db.select().from(schema.rolePermission),
  ]);
  return roles.map((row) => ({
    ...pick(row),
    permissions: resolvePermissions(
      row.key,
      perms.filter((p) => p.roleKey === row.key).map((p) => p.permission),
    ),
  }));
}

function pick(row: typeof schema.role.$inferSelect) {
  return { key: row.key, name: row.name, description: row.description, system: row.system };
}
