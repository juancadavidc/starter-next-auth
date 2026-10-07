import { afterEach, describe, expect, it } from "vitest";
import { getRole } from "@repo/auth/role-store";
import { db, eq, schema } from "@repo/db";
import { createRole, createUser, resetUsersAndRoles, sessionUserFrom } from "@/test/factories";
import { canEditRole, createRole as createRoleAs, deleteRole, listRolesWithUsage, updateRole } from "./admin-roles";

afterEach(resetUsersAndRoles);

async function admin() {
  return sessionUserFrom(await createUser({ role: "admin", profileCompleted: true }));
}

describe("admin roles", () => {
  it("lists the system roles seeded by the migration with their usage", async () => {
    await createUser();
    await createUser({ role: "admin" });
    const roles = await listRolesWithUsage();
    expect(roles.map((r) => [r.key, r.system, r.userCount])).toEqual([
      ["admin", true, 1],
      ["user", true, 1],
    ]);
    expect(roles[0]!.permissions).toEqual(["users.view", "users.manage", "roles.manage"]);
  });

  it("creates a role, normalizing its permissions", async () => {
    const actor = await admin();
    await createRoleAs(actor, "soporte", {
      name: " Soporte ",
      description: "Mesa de ayuda",
      permissions: ["users.manage", "inventado"],
    });
    expect(await getRole("soporte")).toEqual({
      key: "soporte",
      name: "Soporte",
      description: "Mesa de ayuda",
      system: false,
      permissions: ["users.view", "users.manage"],
    });
  });

  it("validates key, name and duplicates", async () => {
    const actor = await admin();
    await expect(createRoleAs(actor, "Con Espacios", { name: "X" })).rejects.toMatchObject({ status: 400 });
    await expect(createRoleAs(actor, "ok-key", { name: "x" })).rejects.toThrow("mínimo 2 letras");
    await expect(createRoleAs(actor, "user", { name: "Otro" })).rejects.toMatchObject({ status: 409 });
  });

  it("updates name, description and permissions (applied on the next request)", async () => {
    const actor = await admin();
    await createRole("soporte", ["users.view"]);
    const member = await createUser({ role: "soporte" });
    await updateRole(actor, "soporte", { name: "Soporte N2", description: "", permissions: ["roles.manage"] });
    expect(await getRole("soporte")).toMatchObject({ name: "Soporte N2", permissions: ["roles.manage"] });
    expect((await sessionUserFrom(member)).permissions).toEqual(["roles.manage"]);
  });

  it("lets the default user role gain permissions", async () => {
    const actor = await admin();
    await updateRole(actor, "user", { name: "Usuario", permissions: ["users.view"] });
    expect((await sessionUserFrom(await createUser())).permissions).toEqual(["users.view"]);
  });

  it("never edits admin, and nobody edits their own role", async () => {
    const actor = await admin();
    await expect(updateRole(actor, "admin", { name: "Admin", permissions: [] })).rejects.toThrow(
      "El rol admin no se edita",
    );
    await createRole("gestor-roles", ["roles.manage"]);
    const self = await sessionUserFrom(await createUser({ role: "gestor-roles" }));
    await expect(updateRole(self, "gestor-roles", { name: "Yo", permissions: [] })).rejects.toThrow(
      "No puedes editar ni borrar tu propio rol",
    );
  });

  it("does not let a non-admin grant or touch permissions they lack", async () => {
    await createRole("gestor-roles", ["roles.manage"]);
    const actor = await sessionUserFrom(await createUser({ role: "gestor-roles" }));
    await expect(
      createRoleAs(actor, "super", { name: "Super", permissions: ["users.manage"] }),
    ).rejects.toMatchObject({ status: 403 });
    await createRole("soporte", ["users.view"]);
    await expect(updateRole(actor, "soporte", { name: "S", permissions: [] })).rejects.toMatchObject({
      status: 403,
    });
    expect(canEditRole(actor, { key: "soporte", permissions: ["users.view"] })).toBe(false);
    expect(canEditRole(actor, { key: "user", permissions: [] })).toBe(true);
  });

  it("deletes unused custom roles only", async () => {
    const actor = await admin();
    await expect(deleteRole(actor, "user")).rejects.toThrow("Los roles del sistema no se borran");
    await createRole("soporte");
    const member = await createUser({ role: "soporte" });
    await expect(deleteRole(actor, "soporte")).rejects.toMatchObject({ status: 409 });
    await db.update(schema.user).set({ role: "user" }).where(eq(schema.user.id, member.id));
    await deleteRole(actor, "soporte");
    expect(await getRole("soporte")).toBeNull();
  });

  it("answers 404 for unknown roles", async () => {
    const actor = await admin();
    await expect(updateRole(actor, "nope", { name: "Nope" })).rejects.toMatchObject({ status: 404 });
    await expect(deleteRole(actor, "nope")).rejects.toMatchObject({ status: 404 });
  });
});
