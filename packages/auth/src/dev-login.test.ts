import { describe, expect, it } from "vitest";
import { DEV_USERS, isDevLoginEnabled } from "./dev-login";

describe("isDevLoginEnabled", () => {
  it("is off in production", () => {
    expect(isDevLoginEnabled("production")).toBe(false);
  });

  it.each(["development", "test"])("is on in %s", (nodeEnv) => {
    expect(isDevLoginEnabled(nodeEnv)).toBe(true);
  });
});

describe("DEV_USERS", () => {
  it("has one admin and one user on a non-routable domain", () => {
    expect(DEV_USERS.map((u) => u.role).sort()).toEqual(["admin", "user"]);
    expect(DEV_USERS.every((u) => u.email.endsWith("@local.test"))).toBe(true);
  });
});
