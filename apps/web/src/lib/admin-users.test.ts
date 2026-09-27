import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import { db, eq, schema } from "@repo/db";
import { createUser, sessionUserFrom } from "@/test/factories";
import { listUsers, setUserBanned, setUserRole } from "./admin-users";

afterEach(async () => {
  await db.delete(schema.user);
});

async function reload(id: string) {
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  return row!;
}

describe("admin users", () => {
  it("lists users newest first", async () => {
    await createUser({ email: "old@example.test", createdAt: new Date("2026-01-01") });
    await createUser({ email: "new@example.test", createdAt: new Date("2026-02-01") });
    expect((await listUsers()).map((u) => u.email)).toEqual(["new@example.test", "old@example.test"]);
  });

  it("promotes another user to admin", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin", profileCompleted: true }));
    const target = await createUser();
    await setUserRole(actor, target.id, "admin");
    expect((await reload(target.id)).role).toBe("admin");
  });

  it("demotes another admin (the actor stays admin, so there is always one left)", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    const other = await createUser({ role: "admin" });
    await setUserRole(actor, other.id, "user");
    expect((await reload(other.id)).role).toBe("user");
    expect((await reload(actor.id)).role).toBe("admin");
  });

  it("rejects unknown roles", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    const target = await createUser();
    await expect(setUserRole(actor, target.id, "root")).rejects.toThrow(ApiError);
    expect((await reload(target.id)).role).toBe("user");
  });

  it("does not let an admin change their own role", async () => {
    const row = await createUser({ role: "admin" });
    await expect(setUserRole(sessionUserFrom(row), row.id, "user")).rejects.toThrow(
      "No puedes cambiar tu propio rol ni suspender tu cuenta",
    );
    expect((await reload(row.id)).role).toBe("admin");
  });

  it("does not let an admin ban themselves", async () => {
    const row = await createUser({ role: "admin" });
    await expect(setUserBanned(sessionUserFrom(row), row.id, true)).rejects.toThrow(ApiError);
    expect((await reload(row.id)).banned).toBe(false);
  });

  it("banning revokes the target's sessions; unbanning restores access", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    const target = await createUser();
    await db.insert(schema.session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: target.id,
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });

    await setUserBanned(actor, target.id, true);
    expect((await reload(target.id)).banned).toBe(true);
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, target.id))).toEqual([]);

    await setUserBanned(actor, target.id, false);
    expect((await reload(target.id)).banned).toBe(false);
  });

  it("fails with 404 for a user that does not exist", async () => {
    const actor = sessionUserFrom(await createUser({ role: "admin" }));
    await expect(setUserRole(actor, "missing", "admin")).rejects.toMatchObject({ status: 404 });
  });
});
