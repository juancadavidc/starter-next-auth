import "server-only";
import type { SessionUser } from "@repo/auth/access";
import { ApiError } from "@repo/auth/api-error";
import { includesAll } from "@repo/auth/permissions";
import { getRole, getRolePermissions } from "@repo/auth/role-store";
import { ADMIN_ROLE } from "@repo/auth/roles";
import { db, desc, eq, schema } from "@repo/db";

// Gestión de usuarios del panel /admin/users. Se escribe directo en la base (y no con la
// API HTTP del plugin admin) para poder probar las reglas sin sesión HTTP; el efecto es
// el mismo: rol, baneo y revocación de sesiones. El permiso (users.manage) lo exige la
// server action; aquí van las reglas que dependen de quién actúa sobre quién.

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  banned: boolean;
  createdAt: Date;
};

export async function listUsers(): Promise<UserRow[]> {
  const rows = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      role: schema.user.role,
      roleName: schema.role.name,
      banned: schema.user.banned,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .leftJoin(schema.role, eq(schema.user.role, schema.role.key))
    .orderBy(desc(schema.user.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, roleName: r.roleName ?? r.role, banned: Boolean(r.banned) }));
}

// Nadie puede cambiar su propio rol ni suspenderse: así la app nunca queda sin admins por
// un clic equivocado (quien actúa conserva su rol después de cualquier cambio).
export function assertCanManage(actor: SessionUser, targetId: string): void {
  if (actor.id === targetId) {
    throw new ApiError("No puedes cambiar tu propio rol ni suspender tu cuenta", 400);
  }
}

// Anti-escalada: solo se gestiona a quien no tiene permisos que el actor no tenga, y el
// rol admin solo lo da o lo quita otro admin.
async function loadManageableTarget(actor: SessionUser, targetId: string): Promise<{ role: string }> {
  const [target] = await db
    .select({ role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, targetId));
  if (!target) throw new ApiError("Usuario no encontrado", 404);
  const outranked =
    (target.role === ADMIN_ROLE && actor.role !== ADMIN_ROLE) ||
    !includesAll(actor.permissions, await getRolePermissions(target.role));
  if (outranked) throw new ApiError("No puedes gestionar a alguien con permisos que tú no tienes", 403);
  return target;
}

export async function setUserRole(actor: SessionUser, targetId: string, roleKey: unknown): Promise<void> {
  assertCanManage(actor, targetId);
  const role = typeof roleKey === "string" ? await getRole(roleKey) : null;
  if (!role) throw new ApiError("Rol inválido", 400);
  await loadManageableTarget(actor, targetId);
  if ((role.key === ADMIN_ROLE && actor.role !== ADMIN_ROLE) || !includesAll(actor.permissions, role.permissions)) {
    throw new ApiError("No puedes asignar un rol con permisos que tú no tienes", 403);
  }
  await db.update(schema.user).set({ role: role.key }).where(eq(schema.user.id, targetId));
}

export async function setUserBanned(actor: SessionUser, targetId: string, banned: boolean): Promise<void> {
  assertCanManage(actor, targetId);
  await loadManageableTarget(actor, targetId);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set({ banned, banReason: null, banExpires: null })
      .where(eq(schema.user.id, targetId));
    // Al suspender, se cierran sus sesiones abiertas en el acto.
    if (banned) await tx.delete(schema.session).where(eq(schema.session.userId, targetId));
  });
}
