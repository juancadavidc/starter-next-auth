import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import { db, eq, schema } from "@repo/db";
import { createRole, createUser, resetUsersAndRoles, sessionUserFrom } from "@/test/factories";
import { listUsers, setUserBanned, setUserRole } from "./admin-users";

afterEach(resetUsersAndRoles);

async function reload(id: string) {
  const [row] = await db.select().from(schema.user).where(eq(schema.user.id, id));
  return row!;
}

describe("admin users", () => {
  it("lists users newest first with their role name", async () => {
    await createUser({ email: "old@example.test", createdAt: new Date("2026-01-01") });
    await createUser({ email: "new@example.test", role: "admin", createdAt: new Date("2026-02-01") });
    expect((await listUsers()).map((u) => [u.email, u.roleName])).toEqual([
      ["new@example.test", "Administrador"],
      ["old@example.test", "Usuario"],
    ]);
  });

  it("promotes another user to admin", async () => {
    const actor = await sessionUserFrom(await createUser({ role: "admin", profileCompleted: true }));
    const target = await createUser();
    await setUserRole(actor, target.id, "admin");
    expect((await reload(target.id)).role).toBe("admin");
  });

  it("assigns a custom role", async () => {
    await createRole("soporte", ["users.view"]);
    const actor = await sessionUserFrom(await createUser({ role: "admin" }));
    const target = await createUser();
    await setUserRole(actor, target.id, "soporte");
    expect((await reload(target.id)).role).toBe("soporte");
  });

  it("demotes another admin (the actor stays admin, so there is always one left)", async () => {
    const actor = await sessionUserFrom(await createUser({ role: "admin" }));
    const other = await createUser({ role: "admin" });
    await setUserRole(actor, other.id, "user");
    expect((await reload(other.id)).role).toBe("user");
    expect((await reload(actor.id)).role).toBe("admin");
  });

  it("rejects roles that do not exist", async () => {
    const actor = await sessionUserFrom(await createUser({ role: "admin" }));
    const target = await createUser();
    await expect(setUserRole(actor, target.id, "root")).rejects.toThrow(ApiError);
    await expect(setUserRole(actor, target.id, null)).rejects.toThrow("Rol inválido");
    expect((await reload(target.id)).role).toBe("user");
  });

  it("does not let anyone change their own role", async () => {
    const row = await createUser({ role: "admin" });
    await expect(setUserRole(await sessionUserFrom(row), row.id, "user")).rejects.toThrow(
      "No puedes cambiar tu propio rol ni suspender tu cuenta",
    );
    expect((await reload(row.id)).role).toBe("admin");
  });

  it("does not let anyone ban themselves", async () => {
    const row = await createUser({ role: "admin" });
    await expect(setUserBanned(await sessionUserFrom(row), row.id, true)).rejects.toThrow(ApiError);
    expect((await reload(row.id)).banned).toBe(false);
  });

  it("banning revokes the target's sessions; unbanning restores access", async () => {
    const actor = await sessionUserFrom(await createUser({ role: "admin" }));
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
    const actor = await sessionUserFrom(await createUser({ role: "admin" }));
    await expect(setUserRole(actor, "missing", "admin")).rejects.toMatchObject({ status: 404 });
  });

  describe("anti-escalation for non-admin managers", () => {
    async function manager() {
      await createRole("gestor", ["users.view", "users.manage"]);
      return sessionUserFrom(await createUser({ role: "gestor" }));
    }

    it("lets a manager assign roles within their own permissions", async () => {
      const actor = await manager();
      await createRole("soporte", ["users.view"]);
      const target = await createUser();
      await setUserRole(actor, target.id, "soporte");
      expect((await reload(target.id)).role).toBe("soporte");
    });

    it("refuses to grant admin or a role with permissions the manager lacks", async () => {
      const actor = await manager();
      await createRole("rrhh", ["roles.manage"]);
      const target = await createUser();
      await expect(setUserRole(actor, target.id, "admin")).rejects.toMatchObject({ status: 403 });
      await expect(setUserRole(actor, target.id, "rrhh")).rejects.toMatchObject({ status: 403 });
      expect((await reload(target.id)).role).toBe("user");
    });

    it("refuses to demote or ban someone who outranks them", async () => {
      const actor = await manager();
      const boss = await createUser({ role: "admin" });
      await expect(setUserRole(actor, boss.id, "user")).rejects.toMatchObject({ status: 403 });
      await expect(setUserBanned(actor, boss.id, true)).rejects.toMatchObject({ status: 403 });
      expect(await reload(boss.id)).toMatchObject({ role: "admin", banned: false });
    });
  });
});
