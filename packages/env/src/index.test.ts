import { afterEach, describe, expect, it, vi } from "vitest";
import { env, optional, required } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("required", () => {
  it("returns the value when present", () => {
    vi.stubEnv("SOME_VAR", "value");
    expect(required("SOME_VAR")).toBe("value");
  });

  it("throws in Spanish when missing", () => {
    vi.stubEnv("SOME_VAR", "");
    expect(() => required("SOME_VAR")).toThrow("Falta la variable de entorno SOME_VAR");
  });

  it("returns empty string when SKIP_ENV_VALIDATION=1", () => {
    vi.stubEnv("SOME_VAR", "");
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    expect(required("SOME_VAR")).toBe("");
  });
});

describe("optional", () => {
  it("returns undefined for empty values", () => {
    vi.stubEnv("SOME_VAR", "");
    expect(optional("SOME_VAR")).toBeUndefined();
  });
});

describe("env", () => {
  it("reads lazily on each access", () => {
    vi.stubEnv("DATABASE_URL", "postgres://a");
    expect(env.databaseUrl).toBe("postgres://a");
    vi.stubEnv("DATABASE_URL", "postgres://b");
    expect(env.databaseUrl).toBe("postgres://b");
  });

  it("defaults BETTER_AUTH_URL to localhost", () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(env.betterAuthUrl).toBe("http://localhost:3000");
  });

  it("allows empty ADMIN_EMAILS", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(env.adminEmails).toBe("");
  });
});
