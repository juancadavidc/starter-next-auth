import { randomUUID } from "node:crypto";
import { toSessionUser, type SessionUser } from "@repo/auth/access";
import { db, schema } from "@repo/db";

// Inserta un usuario directo en la base de test (sin pasar por Better Auth).
export async function createUser(overrides: Partial<typeof schema.user.$inferInsert> = {}) {
  const id = randomUUID();
  const [row] = await db
    .insert(schema.user)
    .values({ id, name: "Test", email: `${id}@example.test`, ...overrides })
    .returning();
  return row!;
}

// Reusa el único mapeo fila → SessionUser de @repo/auth (nada de reescribirlo aquí).
export function sessionUserFrom(row: typeof schema.user.$inferSelect): SessionUser {
  return toSessionUser(row);
}
