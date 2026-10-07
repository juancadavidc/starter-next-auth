import { describe, expect, it } from "vitest";
import { decideAccess, toSessionUser, type SessionUser } from "./access";

const base: SessionUser = {
  id: "u1",
  email: "a@example.com",
  name: "Ana",
  image: null,
  role: "user",
  permissions: [],
  banned: false,
  profileCompleted: true,
};

describe("decideAccess", () => {
  it("sends anonymous users to login keeping the path", () => {
    expect(decideAccess(null, "user", "/app/x")).toEqual({
      ok: false,
      status: 401,
      redirectTo: "/login?next=%2Fapp%2Fx",
    });
  });

  it("sends anonymous users to plain login without a path", () => {
    expect(decideAccess(null, "user")).toEqual({ ok: false, status: 401, redirectTo: "/login" });
  });

  it("blocks banned users on every requirement", () => {
    for (const req of ["user", "completed-profile", { permission: "users.view" }] as const) {
      expect(decideAccess({ ...base, banned: true, role: "admin" }, req)).toEqual({
        ok: false,
        status: 403,
        redirectTo: "/login?error=banned",
      });
    }
  });

  it("lets a user with incomplete profile through the 'user' requirement", () => {
    expect(decideAccess({ ...base, profileCompleted: false }, "user")).toEqual({ ok: true });
  });

  it("sends incomplete profiles to onboarding", () => {
    expect(decideAccess({ ...base, profileCompleted: false }, "completed-profile")).toEqual({
      ok: false,
      status: 403,
      redirectTo: "/onboarding",
    });
  });

  it("requires a completed profile before checking permissions", () => {
    expect(
      decideAccess({ ...base, permissions: ["users.view"], profileCompleted: false }, { permission: "users.view" }),
    ).toMatchObject({ ok: false, redirectTo: "/onboarding" });
  });

  it("rejects users without the permission", () => {
    expect(decideAccess({ ...base, permissions: ["users.view"] }, { permission: "roles.manage" })).toEqual({
      ok: false,
      status: 403,
      redirectTo: "/app",
    });
  });

  it("allows users whose role grants the permission, whatever the role is called", () => {
    expect(
      decideAccess({ ...base, role: "soporte", permissions: ["users.view"] }, { permission: "users.view" }),
    ).toEqual({ ok: true });
  });
});

describe("toSessionUser", () => {
  it("keeps the fields the guards and UI use and drops the rest", () => {
    // Un usuario de Better Auth trae más campos (emailVerified, fechas...).
    const authUser = {
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      image: "https://img.test/a.png",
      role: "admin",
      banned: true,
      profileCompleted: true,
      emailVerified: true,
    };
    expect(toSessionUser(authUser)).toEqual({
      id: "u1",
      email: "a@example.com",
      name: "Ana",
      image: "https://img.test/a.png",
      role: "admin",
      permissions: ["users.view", "users.manage", "roles.manage"],
      banned: true,
      profileCompleted: true,
    });
  });

  it("resolves a custom role's stored permissions, ignoring unknown ones", () => {
    const u = toSessionUser({ id: "u1", email: "a@example.com", name: "Ana", role: "soporte" }, [
      "users.view",
      "legacy.permission",
    ]);
    expect(u).toMatchObject({ role: "soporte", permissions: ["users.view"] });
  });

  it("falls back to the safest values when fields are missing", () => {
    expect(toSessionUser({ id: "u1", email: "a@example.com", name: "Ana", role: null, banned: null })).toEqual({
      ...base,
      profileCompleted: false,
    });
  });
});
