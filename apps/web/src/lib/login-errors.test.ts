import { describe, expect, it } from "vitest";
import { BANNED_MESSAGE, isBannedError, loginErrorMessage } from "./login-errors";

describe("loginErrorMessage", () => {
  it("returns nothing when there is no error", () => {
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage("")).toBeNull();
  });

  it("maps the guard's ?error=banned to the suspended-account copy", () => {
    expect(loginErrorMessage("banned")).toBe(BANNED_MESSAGE);
  });

  it("maps Better Auth's BANNED_USER code (email sign-in and Google callback)", () => {
    expect(loginErrorMessage("BANNED_USER")).toBe(BANNED_MESSAGE);
    expect(BANNED_MESSAGE).toMatch(/^Tu cuenta está suspendida/);
  });

  it("recognizes banned codes only", () => {
    expect(isBannedError("BANNED_USER")).toBe(true);
    expect(isBannedError("banned")).toBe(true);
    expect(isBannedError("INVALID_EMAIL_OR_PASSWORD")).toBe(false);
    expect(isBannedError(undefined)).toBe(false);
  });

  it("falls back to a generic message for any other error code", () => {
    expect(loginErrorMessage("invalid_code")).toBe("No se pudo iniciar sesión. Intenta de nuevo.");
  });
});
