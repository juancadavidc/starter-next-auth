// Piso duro de marca: los colores solo viven como tokens en
// packages/ui/src/styles/globals.css. Este script falla si un .ts/.tsx trae colores
// crudos (hex, rgb/hsl/oklch…). Las excepciones fijan archivo Y patrón de línea, así que
// no sirven de escape general.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type Violation = { file: string; line: number; text: string };
export type Exception = { file: string; match: RegExp; reason: string };

const COLOR_PATTERNS = [
  /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/,
  /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\s*\(/,
];

const SCAN_DIRS = ["apps/web/src", "packages/ui/src"];

export const EXCEPTIONS: Exception[] = [
  {
    file: "apps/web/src/app/layout.tsx",
    match: /themeColor/,
    reason: "Viewport.themeColor se emite como <meta> literal: no puede usar var(--token).",
  },
  // <optional:pwa>
  {
    file: "apps/web/src/app/manifest.ts",
    match: /(background_color|theme_color)/,
    reason: "El manifest es JSON estático para el sistema operativo: no resuelve var(--token).",
  },
  {
    file: "apps/web/src/app/icon.tsx",
    match: /(background|color):/,
    reason: "ImageResponse rasteriza fuera del navegador: no hay CSS de la app.",
  },
  // </optional:pwa>
];

export function findViolations(
  file: string,
  content: string,
  exceptions: Exception[] = EXCEPTIONS,
): Violation[] {
  const violations: Violation[] = [];
  content.split("\n").forEach((text, index) => {
    if (!COLOR_PATTERNS.some((pattern) => pattern.test(text))) return;
    const excused = exceptions.some((e) => e.file === file && e.match.test(text));
    if (!excused) violations.push({ file, line: index + 1, text: text.trim() });
  });
  return violations;
}

function listSourceFiles(root: string): string[] {
  return SCAN_DIRS.flatMap((dir) => {
    const abs = path.join(root, dir);
    let entries: string[];
    try {
      entries = readdirSync(abs, { recursive: true, encoding: "utf8" });
    } catch {
      return [];
    }
    return entries
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .map((f) => path.posix.join(dir, f.split(path.sep).join("/")));
  });
}

if (import.meta.main) {
  const root = process.cwd();
  const violations = listSourceFiles(root).flatMap((file) =>
    findViolations(file, readFileSync(path.join(root, file), "utf8")),
  );
  if (violations.length === 0) {
    console.log("brand-lint OK: sin colores crudos.");
  } else {
    for (const v of violations) console.error(`${v.file}:${v.line}  ${v.text}`);
    console.error(`\n${violations.length} color(es) crudo(s). Usa tokens de @repo/ui/styles.css.`);
    process.exit(1);
  }
}
