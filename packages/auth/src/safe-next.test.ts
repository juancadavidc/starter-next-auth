import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/app", "/app/settings", "/admin/users?page=2", "/onboarding"])(
    "keeps internal path %s",
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "/api/auth/sign-out",
    "/app/../api/x",
    "/api?x=1",
    "/app/%2e%2e/api/x",
    "javascript:alert(1)",
    "/app\n/x",
  ])("falls back for unsafe value %s", (value) => {
    expect(safeNext(value)).toBe("/app");
  });

  it("uses a custom fallback", () => {
    expect(safeNext("//evil.com", "/")).toBe("/");
  });
});
