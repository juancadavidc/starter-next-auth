import "server-only";
import type { SessionUser } from "@repo/auth/access";
import { ApiError } from "@repo/auth/api-error";
import { isRole } from "@repo/auth/roles";
import { db, desc, eq, schema } from "@repo/db";

// Gestión de usuarios del panel /admin/users. Se escribe directo en la base (y no con la
// API HTTP del plugin admin) para poder probar las reglas sin sesión HTTP; el efecto es
// el mismo: rol, baneo y revocación de sesiones.

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
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
      banned: schema.user.banned,
      createdAt: schema.user.createdAt,
    })
    .from(schema.user)
    .orderBy(desc(schema.user.createdAt))
    .limit(500);
  return rows.map((r) => ({ ...r, banned: Boolean(r.banned) }));
}

// Un admin no puede degradarse ni suspenderse: así la app nunca queda sin admins por
// un clic equivocado (quien actúa sigue siendo admin después de cualquier cambio).
export function assertCanManage(actor: SessionUser, targetId: string): void {
  if (actor.id === targetId) {
    throw new ApiError("No puedes cambiar tu propio rol ni suspender tu cuenta", 400);
  }
}

async function assertExists(targetId: string): Promise<void> {
  const [row] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.id, targetId));
  if (!row) throw new ApiError("Usuario no encontrado", 404);
}

export async function setUserRole(actor: SessionUser, targetId: string, role: unknown): Promise<void> {
  assertCanManage(actor, targetId);
  if (!isRole(role)) throw new ApiError("Rol inválido", 400);
  await assertExists(targetId);
  await db.update(schema.user).set({ role }).where(eq(schema.user.id, targetId));
}

export async function setUserBanned(actor: SessionUser, targetId: string, banned: boolean): Promise<void> {
  assertCanManage(actor, targetId);
  await assertExists(targetId);
  await db.transaction(async (tx) => {
    await tx
      .update(schema.user)
      .set({ banned, banReason: null, banExpires: null })
      .where(eq(schema.user.id, targetId));
    // Al suspender, se cierran sus sesiones abiertas en el acto.
    if (banned) await tx.delete(schema.session).where(eq(schema.session.userId, targetId));
  });
}
