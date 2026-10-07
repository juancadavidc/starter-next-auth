import { randomUUID } from "node:crypto";
import { toSessionUser, type SessionUser } from "@repo/auth/access";
import type { Permission } from "@repo/auth/permissions";
import { getStoredPermissions } from "@repo/auth/role-store";
import { db, eq, schema } from "@repo/db";

// Inserta un usuario directo en la base de test (sin pasar por Better Auth).
export async function createUser(overrides: Partial<typeof schema.user.$inferInsert> = {}) {
  const id = randomUUID();
  const [row] = await db
    .insert(schema.user)
    .values({ id, name: "Test", email: `${id}@example.test`, ...overrides })
    .returning();
  return row!;
}

// Inserta un rol (no del sistema) con sus permisos.
export async function createRole(key: string, permissions: Permission[] = []) {
  await db.insert(schema.role).values({ key, name: key });
  if (permissions.length) {
    await db.insert(schema.rolePermission).values(permissions.map((permission) => ({ roleKey: key, permission })));
  }
  return key;
}

// Deja la base como la dejó la migración: sin usuarios, solo los roles del sistema y
// `user` sin permisos.
export async function resetUsersAndRoles() {
  await db.delete(schema.user);
  await db.delete(schema.role).where(eq(schema.role.system, false));
  await db.delete(schema.rolePermission);
}

// Reusa el único mapeo fila → SessionUser de @repo/auth (nada de reescribirlo aquí), con
// los permisos que la sesión leería de la base.
export async function sessionUserFrom(row: typeof schema.user.$inferSelect): Promise<SessionUser> {
  return toSessionUser(row, await getStoredPermissions(row.role));
}
