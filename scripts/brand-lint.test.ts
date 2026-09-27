import { describe, expect, it } from "vitest";
import { findViolations } from "./brand-lint.ts";

describe("findViolations", () => {
  it("accepts token-based classes", () => {
    const code = `export const A = () => <div className="bg-primary text-muted-foreground" />;`;
    expect(findViolations("apps/web/src/a.tsx", code)).toEqual([]);
  });

  it.each([
    `<div style={{ color: "#ff0000" }} />`,
    `<div className="bg-[#123]" />`,
    `const c = "rgb(0, 0, 0)";`,
    `const c = "rgba(0,0,0,.5)";`,
    `const c = "hsl(10 20% 30%)";`,
    `const c = "oklch(0.5 0.1 20)";`,
  ])("flags raw color in %s", (line) => {
    const violations = findViolations("apps/web/src/a.tsx", `const x = 1;\n${line}`);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ file: "apps/web/src/a.tsx", line: 2 });
  });

  it("does not flag anchors that are not hex colors", () => {
    expect(findViolations("apps/web/src/a.tsx", `<a href="#main">Ir</a>`)).toEqual([]);
  });

  it("honors an exception only for its file and pattern", () => {
    const exceptions = [
      { file: "apps/web/src/app/layout.tsx", match: /themeColor/, reason: "meta estático" },
    ];
    const line = `export const viewport = { themeColor: "#ffffff" };`;
    expect(findViolations("apps/web/src/app/layout.tsx", line, exceptions)).toEqual([]);
    expect(findViolations("apps/web/src/other.tsx", line, exceptions)).toHaveLength(1);
    expect(
      findViolations("apps/web/src/app/layout.tsx", `const c = "#000000";`, exceptions),
    ).toHaveLength(1);
  });
});
