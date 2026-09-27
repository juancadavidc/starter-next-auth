import { describe, expect, it } from "vitest";
import { strategyFor } from "./sw-strategy";

const origin = "https://app.example.com";
const req = (method = "GET", mode = "cors") => ({ method, mode });

describe("strategyFor", () => {
  it("serves hashed static assets cache-first", () => {
    expect(strategyFor(new URL(`${origin}/_next/static/chunks/a.js`), req(), origin)).toBe("cache-first");
  });

  it("uses network with offline fallback for navigations", () => {
    expect(strategyFor(new URL(`${origin}/app`), req("GET", "navigate"), origin)).toBe(
      "network-with-offline-fallback",
    );
  });

  it.each([
    ["non-GET", new URL(`${origin}/app`), req("POST", "navigate")],
    ["API", new URL(`${origin}/api/auth/get-session`), req()],
    ["cross-origin", new URL("https://accounts.google.com/x"), req("GET", "navigate")],
    ["other same-origin", new URL(`${origin}/icon`), req()],
  ])("bypasses %s requests", (_label, url, request) => {
    expect(strategyFor(url, request, origin)).toBe("bypass");
  });
});
