import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Un módulo "use client" termina en el navegador: no puede importar la base de datos ni
// la parte de servidor de auth (secretos, conexiones). Este test lo hace explícito.
const ROOT = path.resolve(import.meta.dirname, "../../..");
const SCAN = ["apps/web/src", "packages/ui/src", "packages/auth/src"];
const FORBIDDEN = [/from\s+["']@repo\/db/, /from\s+["']@repo\/auth\/(server|session|guards)["']/];

function clientModules(): string[] {
  return SCAN.flatMap((dir) =>
    readdirSync(path.join(ROOT, dir), { recursive: true, encoding: "utf8" })
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.join(dir, f))
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(path.join(ROOT, f), "utf8"))),
  );
}

describe("client/server boundary", () => {
  it("finds client modules to check", () => {
    expect(clientModules().length).toBeGreaterThan(0);
  });

  it("client modules never import server-only packages", () => {
    const offenders = clientModules().filter((file) => {
      const content = readFileSync(path.join(ROOT, file), "utf8");
      return FORBIDDEN.some((pattern) => pattern.test(content));
    });
    expect(offenders).toEqual([]);
  });
});
