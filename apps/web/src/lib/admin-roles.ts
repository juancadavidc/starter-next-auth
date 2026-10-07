import "server-only";
import { z } from "zod";
import type { SessionUser } from "@repo/auth/access";
import { ApiError } from "@repo/auth/api-error";
import { includesAll, normalizePermissions, type Permission } from "@repo/auth/permissions";
import { getRole, listRoles, type RoleRecord } from "@repo/auth/role-store";
import { ADMIN_ROLE, isRoleKey } from "@repo/auth/roles";
import { count, db, eq, schema } from "@repo/db";

// Gestión de roles del panel /admin/roles. El permiso (roles.manage) lo exige la server
// action; aquí van las reglas:
// - admin no se edita ni se borra (tiene todos los permisos por código).
// - Roles del sistema (admin, user) no se borran; un rol con usuarios tampoco.
// - Nadie edita su propio rol (no se quita permisos por error ni se los da).
// - Anti-escalada: solo se otorgan, o se tocan roles con, permisos que el actor tiene.

export type RoleWithUsage = RoleRecord & { userCount: number };

export async function listRolesWithUsage(): Promise<RoleWithUsage[]> {
  const [roles, counts] = await Promise.all([
    listRoles(),
    db.select({ role: schema.user.role, n: count() }).from(schema.user).groupBy(schema.user.role),
  ]);
  return roles.map((r) => ({ ...r, userCount: counts.find((c) => c.role === r.key)?.n ?? 0 }));
}

const roleFields = z.object({
  name: z
    .string({ error: "Escribe un nombre" })
    .trim()
    .min(2, "El nombre necesita mínimo 2 letras")
    .max(40, "El nombre admite máximo 40 caracteres"),
  description: z.string().trim().max(200, "La descripción admite máximo 200 caracteres").default(""),
  permissions: z.array(z.string()).default([]),
});

export type RoleInput = { name?: unknown; description?: unknown; permissions?: unknown };

function parseFields(input: RoleInput) {
  const parsed = roleFields.safeParse(input);
  if (!parsed.success) throw new ApiError(parsed.error.issues[0]?.message ?? "Datos inválidos", 400);
  return { ...parsed.data, permissions: normalizePermissions(parsed.data.permissions) };
}

function assertCanGrant(actor: SessionUser, permissions: readonly Permission[]): void {
  if (!includesAll(actor.permissions, permissions)) {
    throw new ApiError("No puedes otorgar permisos que tú no tienes", 403);
  }
}

// Versión booleana de las reglas de loadEditable, para que la UI esconda lo que se
// rechazaría igual.
export function canEditRole(actor: SessionUser, role: Pick<RoleRecord, "key" | "permissions">): boolean {
  return role.key !== ADMIN_ROLE && role.key !== actor.role && includesAll(actor.permissions, role.permissions);
}

async function loadEditable(actor: SessionUser, key: string): Promise<RoleRecord> {
  const role = await getRole(key);
  if (!role) throw new ApiError("Rol no encontrado", 404);
  if (role.key === ADMIN_ROLE) {
    throw new ApiError("El rol admin no se edita: siempre tiene todos los permisos", 400);
  }
  if (role.key === actor.role) throw new ApiError("No puedes editar ni borrar tu propio rol", 400);
  assertCanGrant(actor, role.permissions);
  return role;
}

export async function createRole(actor: SessionUser, key: unknown, input: RoleInput): Promise<string> {
  if (!isRoleKey(key)) {
    throw new ApiError("La clave usa minúsculas, números y guiones (2 a 32, empieza por letra)", 400);
  }
  const fields = parseFields(input);
  assertCanGrant(actor, fields.permissions);
  if (await getRole(key)) throw new ApiError("Ya existe un rol con esa clave", 409);
  await db.transaction(async (tx) => {
    await tx.insert(schema.role).values({ key, name: fields.name, description: fields.description });
    if (fields.permissions.length) {
      await tx.insert(schema.rolePermission).values(fields.permissions.map((permission) => ({ roleKey: key, permission })));
    }
  });
  return key;
}

export async function updateRole(actor: SessionUser, key: string, input: RoleInput): Promise<void> {
  await loadEditable(actor, key);
  const fields = parseFields(input);
  assertCanGrant(actor, fields.permissions);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.role)
      .set({ name: fields.name, description: fields.description })
      .where(eq(schema.role.key, key));
    await tx.delete(schema.rolePermission).where(eq(schema.rolePermission.roleKey, key));
    if (fields.permissions.length) {
      await tx.insert(schema.rolePermission).values(fields.permissions.map((permission) => ({ roleKey: key, permission })));
    }
  });
}

export async function deleteRole(actor: SessionUser, key: string): Promise<void> {
  const role = await loadEditable(actor, key);
  if (role.system) throw new ApiError("Los roles del sistema no se borran", 400);
  const [usage] = await db.select({ n: count() }).from(schema.user).where(eq(schema.user.role, key));
  if (usage && usage.n > 0) {
    throw new ApiError(`Hay ${usage.n} usuario(s) con este rol: cámbiales el rol antes de borrarlo`, 409);
  }
  await db.delete(schema.role).where(eq(schema.role.key, key));
}
