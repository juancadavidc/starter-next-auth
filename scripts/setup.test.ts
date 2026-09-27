import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  existsSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  envWarnings,
  lockKeyFor,
  normalizeDomain,
  readLockKey,
  removeMarkedBlocks,
  replaceIdentity,
  runSetup,
  setLockKey,
  TEMPLATE_LOCK_KEY,
  TEMPLATE_NAME,
  validateName,
  withSecret,
} from "./setup.ts";

describe("validateName", () => {
  it.each(["mi-idea", "abc", "app2", "a1-b2-c3"])("accepts %s", (name) => {
    expect(validateName(name)).toBeNull();
  });

  it.each(["", "ab", "Mi-Idea", "mi_idea", "-mi", "mi-", "mi--idea", "1app", "a".repeat(41)])(
    "rejects %j",
    (name) => {
      expect(validateName(name)).toEqual(expect.any(String));
    },
  );
});

describe("lockKeyFor", () => {
  it("is deterministic, positive and fits in 31 bits", () => {
    const key = lockKeyFor("mi-idea");
    expect(lockKeyFor("mi-idea")).toBe(key);
    expect(key).toBeGreaterThan(0);
    expect(key).toBeLessThanOrEqual(0x7fffffff);
  });

  it("differs between projects", () => {
    expect(lockKeyFor("mi-idea")).not.toBe(lockKeyFor("otra-idea"));
  });
});

describe("replaceIdentity", () => {
  it("replaces kebab and snake forms and is idempotent", () => {
    const input = "name: starter-next-auth\ndb: starter_next_auth_test";
    const once = replaceIdentity(input, "mi-idea");
    expect(once).toBe("name: mi-idea\ndb: mi_idea_test");
    expect(replaceIdentity(once, "mi-idea")).toBe(once);
  });

  it("does not duplicate when the new name contains the template name", () => {
    const input = "name: starter-next-auth\ndb: starter_next_auth";
    const once = replaceIdentity(input, "my-starter-next-auth-v2");
    expect(once).toBe("name: my-starter-next-auth-v2\ndb: my_starter_next_auth_v2");
    expect(replaceIdentity(once, "my-starter-next-auth-v2")).toBe(once);
  });

  it("ignores <keep:template> mentioned in prose", () => {
    const input = "Usa `<keep:template>` para proteger líneas.\n# starter-next-auth";
    expect(replaceIdentity(input, "mi-idea")).toBe("Usa `<keep:template>` para proteger líneas.\n# mi-idea");
  });

  it("still renames when the new name is a substring of the template name", () => {
    expect(replaceIdentity("starter-next-auth starter_next_auth", "starter")).toBe("starter starter");
  });

  it("leaves <keep:template> regions untouched", () => {
    const input = [
      "# starter-next-auth",
      "<!-- <keep:template> -->",
      "gh repo create x --template juancadavidc/starter-next-auth",
      "<!-- </keep:template> -->",
      "db: starter_next_auth",
    ].join("\n");
    expect(replaceIdentity(input, "mi-idea")).toBe(
      [
        "# mi-idea",
        "<!-- <keep:template> -->",
        "gh repo create x --template juancadavidc/starter-next-auth",
        "<!-- </keep:template> -->",
        "db: mi_idea",
      ].join("\n"),
    );
  });
});

describe("setLockKey", () => {
  it("rewrites the constant", () => {
    expect(setLockKey("export const MIGRATION_LOCK_KEY = 1_918_273_645;", 42)).toBe(
      "export const MIGRATION_LOCK_KEY = 42;",
    );
  });
});

describe("removeMarkedBlocks", () => {
  it("removes // # and JSX blocks of one module only", () => {
    const input = [
      "a",
      "// <optional:pwa>",
      "pwa-ts",
      "// </optional:pwa>",
      "# <optional:pwa>",
      "pwa-yaml",
      "# </optional:pwa>",
      "{/* <optional:pwa> */}",
      "<SwRegister />",
      "{/* </optional:pwa> */}",
      "// <optional:storage>",
      "storage",
      "// </optional:storage>",
      "b",
    ].join("\n");
    expect(removeMarkedBlocks(input, "pwa")).toBe(
      ["a", "// <optional:storage>", "storage", "// </optional:storage>", "b"].join("\n"),
    );
  });

  it("removes indented blocks inside JSONC arrays and JSX trees", () => {
    const tsconfig = ['  "exclude": [', '    "node_modules",', "    // <optional:pwa>", '    "src/sw.ts",', "    // </optional:pwa>", "  ]"];
    expect(removeMarkedBlocks(tsconfig.join("\n"), "pwa")).toBe(['  "exclude": [', '    "node_modules",', "  ]"].join("\n"));

    const jsx = ["      <body>", "        {/* <optional:analytics> */}", "        <Analytics />", "        {/* </optional:analytics> */}", "      </body>"];
    expect(removeMarkedBlocks(jsx.join("\n"), "analytics")).toBe(["      <body>", "      </body>"].join("\n"));
  });

  it("does not leave a double blank line where a block was", () => {
    const env = ["A=", "", "# <optional:storage>", "R2=", "# </optional:storage>", "", "# <optional:analytics>", "GA=", "# </optional:analytics>", ""];
    const out = (["storage", "analytics"] as const).reduce((text, mod) => removeMarkedBlocks(text, mod), env.join("\n"));
    expect(out).toBe("A=\n");
    expect(removeMarkedBlocks(["A=", "", "# <optional:storage>", "R2=", "# </optional:storage>", "", "B="].join("\n"), "storage")).toBe(
      "A=\n\nB=",
    );
  });

  it("leaves content without markers untouched", () => {
    expect(removeMarkedBlocks("x\ny", "pwa")).toBe("x\ny");
  });

  it("removes <!-- --> blocks and ignores markers mentioned in prose", () => {
    const md = [
      "Los bloques `<optional:storage>` … `</optional:storage>` se quitan con el módulo.",
      "<!-- <optional:storage> -->",
      "Sección R2",
      "<!-- </optional:storage> -->",
      "fin",
    ].join("\n");
    expect(removeMarkedBlocks(md, "storage")).toBe(
      ["Los bloques `<optional:storage>` … `</optional:storage>` se quitan con el módulo.", "fin"].join("\n"),
    );
    // Solo la mención en prosa, sin bloque: no hay error ni se borra nada.
    const prose = 'const doc = "usa // <optional:pwa> para marcar";\nx';
    expect(removeMarkedBlocks(prose, "pwa")).toBe(prose);
  });

  it("refuses an unclosed block instead of truncating the file", () => {
    expect(() => removeMarkedBlocks("a\n// <optional:pwa>\nb\nc", "pwa")).toThrow(/optional:pwa/);
  });
});

describe("withSecret", () => {
  it("appends the line when .env.example has none", () => {
    expect(withSecret("A=1\n", "s")).toBe("A=1\nBETTER_AUTH_SECRET=s\n");
    expect(withSecret("A=1", "s")).toBe("A=1\nBETTER_AUTH_SECRET=s\n");
  });

  it("fills an empty BETTER_AUTH_SECRET line", () => {
    expect(withSecret("A=1\nBETTER_AUTH_SECRET=\nB=2", "s3cr3t")).toBe("A=1\nBETTER_AUTH_SECRET=s3cr3t\nB=2");
  });

  it("inserts the secret literally (no $-pattern expansion)", () => {
    expect(withSecret("BETTER_AUTH_SECRET=", "a$&b$1")).toBe("BETTER_AUTH_SECRET=a$&b$1");
  });
});

describe("envWarnings", () => {
  it("flags template names and an empty or missing secret", () => {
    expect(envWarnings("DATABASE_URL=postgres://x/starter_next_auth\nBETTER_AUTH_SECRET=\n")).toHaveLength(2);
    expect(envWarnings("A=1\n")).toEqual([expect.stringContaining("BETTER_AUTH_SECRET")]);
    expect(envWarnings("DATABASE_URL=postgres://x/mi_idea\nBETTER_AUTH_SECRET=abc\n")).toEqual([]);
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["app.ejemplo.com", "app.ejemplo.com"],
    [" https://app.ejemplo.com/ ", "app.ejemplo.com"],
    ["http://app.ejemplo.com//", "app.ejemplo.com"],
    ["", undefined],
    [undefined, undefined],
  ])("%j → %j", (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe("the real template", () => {
  // En la plantilla la clave es TEMPLATE_LOCK_KEY; en un proyecto generado, la de su nombre.
  it("pins packages/db/src/lock-key.ts to the key setup.ts expects", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const name = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { name: string }).name;
    const key = readLockKey(readFileSync(path.join(root, "packages/db/src/lock-key.ts"), "utf8"));
    expect(key).toBe(name === TEMPLATE_NAME ? TEMPLATE_LOCK_KEY : lockKeyFor(name));
  });
});

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "setup-"));
  const write = (rel: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), content);
  };
  write("package.json", JSON.stringify({ name: "starter-next-auth" }, null, 2) + "\n");
  write(
    "apps/web/package.json",
    JSON.stringify(
      {
        name: "web",
        scripts: {
          "build:sw": "esbuild ...",
          dev: "pnpm build:sw && next dev",
          build: "pnpm build:sw && next build",
          typecheck: "tsc --noEmit && tsc -p tsconfig.sw.json --noEmit",
        },
        dependencies: { "@repo/storage": "workspace:*", next: "^16" },
        devDependencies: { esbuild: "^0.25.0" },
      },
      null,
      2,
    ) + "\n",
  );
  write("packages/db/src/lock-key.ts", "export const MIGRATION_LOCK_KEY = 1_918_273_645;\n");
  write(
    ".env.example",
    [
      "DATABASE_URL=postgres://s:s@localhost:5432/starter_next_auth",
      "BETTER_AUTH_SECRET=",
      "# <optional:storage>",
      "R2_BUCKET_NAME=",
      "# </optional:storage>",
      "# <optional:analytics>",
      "NEXT_PUBLIC_GA_ID=",
      "# </optional:analytics>",
      "",
    ].join("\n"),
  );
  write("apps/web/next.config.ts", "a\n// <optional:storage>\n\"@repo/storage\",\n// </optional:storage>\nb\n");
  write(
    "apps/web/tsconfig.json",
    '{\n  "exclude": [\n    "node_modules",\n    // <optional:pwa>\n    "src/sw.ts",\n    // </optional:pwa>\n  ]\n}\n',
  );
  write(
    "apps/web/src/app/layout.tsx",
    [
      "// <optional:analytics>",
      'import { Analytics } from "@/components/analytics";',
      "// </optional:analytics>",
      'export const metadata = { title: "starter-next-auth" };',
      "        {/* <optional:analytics> */}",
      "        <Analytics />",
      "        {/* </optional:analytics> */}",
      "",
    ].join("\n"),
  );
  write(".gitignore", "node_modules/\n# <optional:landing>\napps/landing/.astro/\n# </optional:landing>\n");
  write(
    "README.md",
    "# starter-next-auth\n<!-- <keep:template> -->\ngh repo create x --template juancadavidc/starter-next-auth\n<!-- </keep:template> -->\n",
  );
  write("packages/storage/src/r2.ts", "starter-next-auth");
  write("apps/web/src/app/api/files/[...key]/route.ts", "import '@repo/storage/r2';");
  write("apps/web/src/sw.ts", "sw");
  write("apps/web/src/components/analytics.tsx", "ga");
  write("apps/web/src/lib/ga.ts", "ga");
  write("apps/landing/package.json", "{}");
  write("docs/superpowers/specs/x.md", "starter-next-auth");
  write("tools/skill/SKILL.md", "juancadavidc/starter-next-auth");
  write("node_modules/foo/index.ts", "starter-next-auth");
  return root;
}

const read = (root: string, rel: string) => readFileSync(path.join(root, rel), "utf8");

// Foto de todo el árbol (ruta → contenido) para comparar corridas.
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (rel: string) => {
    for (const entry of readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(child);
      else out[child] = read(root, child);
    }
  };
  walk("");
  return out;
}

describe("runSetup", () => {
  it("renames, sets the lock key, creates .env and removes modules", () => {
    const root = fixture();
    const result = runSetup(root, { name: "mi-idea", remove: ["storage", "pwa"], secret: "abc" });

    expect(JSON.parse(read(root, "package.json")).name).toBe("mi-idea");
    expect(read(root, "packages/db/src/lock-key.ts")).toContain(`= ${lockKeyFor("mi-idea")};`);
    expect(read(root, ".env")).toContain("BETTER_AUTH_SECRET=abc");
    expect(read(root, ".env")).toContain("/mi_idea");
    expect(read(root, ".env")).not.toContain("R2_BUCKET_NAME");
    expect(read(root, ".env")).toContain("NEXT_PUBLIC_GA_ID=");
    expect(result.envCreated).toBe(true);
    expect(result.env).toBe("created");
    expect(result.envWarnings).toEqual([]);
    expect(result.removed).toEqual(["storage", "pwa"]);

    expect(existsSync(path.join(root, "packages/storage"))).toBe(false);
    expect(existsSync(path.join(root, "apps/web/src/app/api/files"))).toBe(false);
    expect(existsSync(path.join(root, "apps/web/src/sw.ts"))).toBe(false);
    expect(existsSync(path.join(root, "apps/landing"))).toBe(true);
    expect(read(root, "apps/web/next.config.ts")).toBe("a\nb\n");
    expect(read(root, "apps/web/tsconfig.json")).toBe('{\n  "exclude": [\n    "node_modules",\n  ]\n}\n');

    const web = JSON.parse(read(root, "apps/web/package.json"));
    expect(web.dependencies).toEqual({ next: "^16" });
    expect(web.scripts).toEqual({ dev: "next dev", build: "next build", typecheck: "tsc --noEmit" });
    expect(web.devDependencies.esbuild).toBeUndefined();
    expect(read(root, "apps/web/package.json").endsWith("}\n")).toBe(true);
    expect(result.changedFiles).toContain("apps/web/package.json");

    // Lo que no es del proyecto nuevo no se toca: la skill apunta a la plantilla.
    expect(read(root, "tools/skill/SKILL.md")).toContain("juancadavidc/starter-next-auth");
    expect(read(root, "node_modules/foo/index.ts")).toBe("starter-next-auth");
    // El README renombra el título pero conserva la línea de --template.
    expect(read(root, "README.md")).toBe(
      "# mi-idea\n<!-- <keep:template> -->\ngh repo create x --template juancadavidc/starter-next-auth\n<!-- </keep:template> -->\n",
    );
    // La spec y el plan de la plantilla no viajan al proyecto nuevo.
    expect(existsSync(path.join(root, "docs/superpowers"))).toBe(false);
  });

  it("removes analytics and landing wiring", () => {
    const root = fixture();
    runSetup(root, { name: "mi-idea", remove: ["analytics", "landing"], secret: "abc" });

    expect(existsSync(path.join(root, "apps/landing"))).toBe(false);
    expect(existsSync(path.join(root, "apps/web/src/components/analytics.tsx"))).toBe(false);
    expect(existsSync(path.join(root, "apps/web/src/lib/ga.ts"))).toBe(false);
    expect(read(root, "apps/web/src/app/layout.tsx")).toBe('export const metadata = { title: "mi-idea" };\n');
    expect(read(root, ".gitignore")).toBe("node_modules/\n");
    expect(read(root, ".env")).not.toContain("NEXT_PUBLIC_GA_ID");
    // Lo que no se quitó queda intacto.
    expect(existsSync(path.join(root, "packages/storage"))).toBe(true);
    expect(JSON.parse(read(root, "apps/web/package.json")).dependencies["@repo/storage"]).toBe("workspace:*");
  });

  it("is idempotent and never overwrites an existing .env", () => {
    const root = fixture();
    runSetup(root, { name: "mi-idea", remove: ["storage", "pwa"], secret: "first" });
    writeFileSync(path.join(root, ".env"), "BETTER_AUTH_SECRET=mine\n");
    const before = snapshot(root);
    const again = runSetup(root, { name: "mi-idea", remove: ["storage", "pwa"], secret: "second" });

    expect(again.changedFiles).toEqual([]);
    expect(again.envCreated).toBe(false);
    expect(read(root, ".env")).toBe("BETTER_AUTH_SECRET=mine\n");
    expect(snapshot(root)).toEqual(before);
  });

  it("keeps the .env created by the first run on a second run", () => {
    const root = fixture();
    runSetup(root, { name: "mi-idea", remove: [] });
    const env = read(root, ".env");
    expect(env).toMatch(/^BETTER_AUTH_SECRET=\S{20,}$/m);
    runSetup(root, { name: "mi-idea", remove: [] });
    expect(read(root, ".env")).toBe(env);
  });

  it("does not duplicate replacements when the name contains the template name", () => {
    const root = fixture();
    runSetup(root, { name: "starter-next-auth-v2", remove: [], secret: "x" });
    const before = snapshot(root);
    const again = runSetup(root, { name: "starter-next-auth-v2", remove: [], secret: "x" });

    expect(JSON.parse(read(root, "package.json")).name).toBe("starter-next-auth-v2");
    expect(again.changedFiles).toEqual([]);
    expect(snapshot(root)).toEqual(before);
  });

  it("never changes the lock key once the project has one", () => {
    const root = fixture();
    runSetup(root, { name: "mi-idea", remove: [], secret: "x" });
    runSetup(root, { name: "otra-idea", remove: [], secret: "x" });
    expect(read(root, "packages/db/src/lock-key.ts")).toContain(`= ${lockKeyFor("mi-idea")};`);
  });

  it("writes nothing when a marker is unclosed", () => {
    const root = fixture();
    writeFileSync(path.join(root, "apps/web/next.config.ts"), "a\n// <optional:storage>\nb\n");
    const before = snapshot(root);
    expect(() => runSetup(root, { name: "mi-idea", remove: ["storage"], secret: "x" })).toThrow(
      /apps\/web\/next\.config\.ts/,
    );
    expect(snapshot(root)).toEqual(before);
  });

  it("rejects an invalid name before touching anything", () => {
    const root = fixture();
    const before = snapshot(root);
    expect(() => runSetup(root, { name: "Mi Idea", remove: ["storage"] })).toThrow();
    expect(snapshot(root)).toEqual(before);
  });

  it("refuses a folder that is not the template root and touches nothing", () => {
    const root = fixture();
    rmSync(path.join(root, "packages/db/src/lock-key.ts"));
    const before = snapshot(root);
    expect(() => runSetup(root, { name: "mi-idea", remove: ["storage", "landing"], secret: "x" })).toThrow(
      /lock-key\.ts/,
    );
    expect(snapshot(root)).toEqual(before);

    const parent = mkdtempSync(path.join(tmpdir(), "setup-parent-"));
    writeFileSync(path.join(parent, "notes.md"), "starter-next-auth");
    expect(() => runSetup(parent, { name: "mi-idea", remove: [] })).toThrow(/package\.json/);
    expect(snapshot(parent)).toEqual({ "notes.md": "starter-next-auth" });
  });

  it("never follows or rewrites symlinks", () => {
    const root = fixture();
    const outside = mkdtempSync(path.join(tmpdir(), "setup-outside-"));
    writeFileSync(path.join(outside, "shared.md"), "starter-next-auth");
    mkdirSync(path.join(outside, "dir"));
    writeFileSync(path.join(outside, "dir/x.ts"), "starter-next-auth");
    symlinkSync(path.join(outside, "shared.md"), path.join(root, "linked.md"));
    symlinkSync(path.join(outside, "dir"), path.join(root, "linked-dir"));

    const result = runSetup(root, { name: "mi-idea", remove: [], secret: "x" });
    expect(readFileSync(path.join(outside, "shared.md"), "utf8")).toBe("starter-next-auth");
    expect(readFileSync(path.join(outside, "dir/x.ts"), "utf8")).toBe("starter-next-auth");
    expect(result.changedFiles).not.toContain("linked.md");
  });

  it("reports the .env status and warns about a half-done existing .env", () => {
    const root = fixture();
    writeFileSync(path.join(root, ".env"), "DATABASE_URL=postgres://x/starter_next_auth\nBETTER_AUTH_SECRET=\n");
    const result = runSetup(root, { name: "mi-idea", remove: [] });
    expect(result.env).toBe("exists");
    expect(result.envWarnings).toHaveLength(2);
    expect(read(root, ".env")).toBe("DATABASE_URL=postgres://x/starter_next_auth\nBETTER_AUTH_SECRET=\n");

    const bare = fixture();
    rmSync(path.join(bare, ".env.example"));
    const none = runSetup(bare, { name: "mi-idea", remove: [] });
    expect(none).toMatchObject({ env: "no-example", envCreated: false });
    expect(existsSync(path.join(bare, ".env"))).toBe(false);
  });

  it("keeps the template docs and lock key when run on the template itself", () => {
    const root = fixture();
    runSetup(root, { name: "starter-next-auth", remove: [], secret: "x" });
    expect(existsSync(path.join(root, "docs/superpowers/specs/x.md"))).toBe(true);
    expect(read(root, "packages/db/src/lock-key.ts")).toContain(`= 1_918_273_645;`);
    expect(TEMPLATE_LOCK_KEY).toBe(1_918_273_645);
  });
});
