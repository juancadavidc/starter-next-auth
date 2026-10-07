import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  hasPermission,
  includesAll,
  isPermission,
  normalizePermissions,
  PERMISSIONS,
  resolvePermissions,
} from "./permissions";

describe("PERMISSIONS", () => {
  it("only implies permissions that exist", () => {
    for (const { implies } of Object.values(PERMISSIONS)) {
      expect(implies.every(isPermission)).toBe(true);
    }
  });
});

describe("normalizePermissions", () => {
  it("drops unknown values, dedupes and keeps catalog order", () => {
    expect(normalizePermissions(["roles.manage", "nope", 3, "users.view", "users.view"])).toEqual([
      "users.view",
      "roles.manage",
    ]);
  });

  it("adds implied permissions", () => {
    expect(normalizePermissions(["users.manage"])).toEqual(["users.view", "users.manage"]);
  });
});

describe("resolvePermissions", () => {
  it("gives admin every permission regardless of stored rows", () => {
    expect(resolvePermissions("admin", [])).toEqual(ALL_PERMISSIONS);
  });

  it("uses the stored rows for any other role", () => {
    expect(resolvePermissions("soporte", ["users.view"])).toEqual(["users.view"]);
    expect(resolvePermissions("user", [])).toEqual([]);
  });
});

describe("hasPermission / includesAll", () => {
  it("checks a single permission", () => {
    expect(hasPermission({ permissions: ["users.view"] }, "users.view")).toBe(true);
    expect(hasPermission({ permissions: ["users.view"] }, "roles.manage")).toBe(false);
    expect(hasPermission(null, "users.view")).toBe(false);
  });

  it("checks that one set covers another", () => {
    expect(includesAll(["users.view", "roles.manage"], ["users.view"])).toBe(true);
    expect(includesAll(["users.view"], ["users.view", "users.manage"])).toBe(false);
    expect(includesAll([], [])).toBe(true);
  });
});
