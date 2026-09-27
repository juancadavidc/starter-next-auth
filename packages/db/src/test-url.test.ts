import { describe, expect, it } from "vitest";
import { toTestDatabaseUrl } from "./test-url";

describe("toTestDatabaseUrl", () => {
  it("appends _test to the database name", () => {
    expect(toTestDatabaseUrl("postgres://u:p@localhost:5432/app")).toBe(
      "postgres://u:p@localhost:5432/app_test",
    );
  });

  it("keeps query params", () => {
    expect(toTestDatabaseUrl("postgres://u:p@h:5432/app?sslmode=disable")).toBe(
      "postgres://u:p@h:5432/app_test?sslmode=disable",
    );
  });

  it("is idempotent", () => {
    const once = toTestDatabaseUrl("postgres://u:p@h/app");
    expect(toTestDatabaseUrl(once)).toBe(once);
  });

  it("rejects a URL without database name", () => {
    expect(() => toTestDatabaseUrl("postgres://u:p@h:5432/")).toThrow(
      "DATABASE_URL no trae nombre de base de datos",
    );
  });
});
