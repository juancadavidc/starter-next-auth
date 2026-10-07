import { describe, expect, it } from "vitest";
import { isRoleKey, parseAdminEmails, roleForEmail } from "./roles";

describe("parseAdminEmails", () => {
  it("normalizes case, spaces and empty entries", () => {
    expect(parseAdminEmails(" Ana@Example.com, ,bob@example.com ,")).toEqual([
      "ana@example.com",
      "bob@example.com",
    ]);
  });

  it("returns an empty list for an empty string", () => {
    expect(parseAdminEmails("")).toEqual([]);
  });
});

describe("roleForEmail", () => {
  const admins = parseAdminEmails("ana@example.com");

  it("matches ignoring case and surrounding spaces", () => {
    expect(roleForEmail("  ANA@example.com ", admins)).toBe("admin");
  });

  it("defaults to user", () => {
    expect(roleForEmail("otro@example.com", admins)).toBe("user");
  });

  it("makes nobody admin when the list is empty", () => {
    expect(roleForEmail("ana@example.com", [])).toBe("user");
  });
});

describe("isRoleKey", () => {
  it("accepts lowercase slugs that start with a letter", () => {
    expect(isRoleKey("admin")).toBe(true);
    expect(isRoleKey("soporte-n2")).toBe(true);
  });

  it.each(["", "a", "Soporte", "2fa", "con espacio", "x".repeat(33), undefined])("rejects %j", (value) => {
    expect(isRoleKey(value)).toBe(false);
  });
});
