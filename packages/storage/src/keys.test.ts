import { describe, expect, it } from "vitest";
import { contentTypeForKey, isSafeKey, newObjectKey, safeExtension } from "./keys";

describe("safeExtension", () => {
  it.each([
    ["foto.JPG", ".jpg"],
    ["a.b.png", ".png"],
    ["sin-extension", ""],
    ["malo.ph/p", ""],
    ["largo.abcdefgh", ""],
  ])("%s → %s", (name, ext) => {
    expect(safeExtension(name)).toBe(ext);
  });
});

describe("newObjectKey", () => {
  it("builds prefix/uuid.ext with a sanitized prefix", () => {
    expect(newObjectKey("Avatars/../x", "a.png")).toMatch(/^avatars-x\/[0-9a-f-]{36}\.png$/);
  });
});

describe("isSafeKey", () => {
  it.each(["avatars/abc.webp", "a/b/c-lg.webp"])("accepts %s", (key) => {
    expect(isSafeKey(key)).toBe(true);
  });

  it.each(["../etc/passwd", "/abs", "a//b", "a/../b", "a/./b", "", "a b"])("rejects %s", (key) => {
    expect(isSafeKey(key)).toBe(false);
  });
});

describe("contentTypeForKey", () => {
  it.each([
    ["a/b-sm.webp", "image/webp"],
    ["a/b.JPG", "image/jpeg"],
    ["a/b.avif", "image/avif"],
    ["a/sin-extension", "application/octet-stream"],
  ])("%s → %s", (key, type) => {
    expect(contentTypeForKey(key)).toBe(type);
  });
});
