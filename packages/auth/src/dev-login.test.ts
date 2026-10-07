import { describe, expect, it } from "vitest";
import { DEV_ROLES, DEV_USERS, isDevLoginEnabled } from "./dev-login";
import { isPermission } from "./permissions";
import { isRoleKey, SYSTEM_ROLES } from "./roles";

describe("isDevLoginEnabled", () => {
  it("is off in production", () => {
    expect(isDevLoginEnabled("production")).toBe(false);
  });

  it.each(["development", "test"])("is on in %s", (nodeEnv) => {
    expect(isDevLoginEnabled(nodeEnv)).toBe(true);
  });
});

describe("DEV_USERS", () => {
  it("covers both system roles plus every seeded role, on a non-routable domain", () => {
    expect(DEV_USERS.map((u) => u.role).sort()).toEqual(
      [...SYSTEM_ROLES, ...DEV_ROLES.map((r) => r.key)].sort(),
    );
    expect(DEV_USERS.every((u) => u.email.endsWith("@local.test"))).toBe(true);
  });
});

describe("DEV_ROLES", () => {
  it("uses valid, non-system keys and known permissions", () => {
    for (const role of DEV_ROLES) {
      expect(isRoleKey(role.key)).toBe(true);
      expect(SYSTEM_ROLES).not.toContain(role.key);
      expect(role.permissions.every(isPermission)).toBe(true);
    }
  });
});
