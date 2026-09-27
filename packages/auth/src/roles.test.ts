import { describe, expect, it } from "vitest";
import { isRole, parseAdminEmails, roleForEmail } from "./roles";

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

describe("isRole", () => {
  it("accepts only known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("user")).toBe(true);
    expect(isRole("root")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
