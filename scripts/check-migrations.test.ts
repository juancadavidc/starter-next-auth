import { describe, expect, it } from "vitest";
import { checkMigrations, parseNameStatus } from "./check-migrations.ts";

const DIR = "packages/db/migrations";
const files: Record<string, string> = {
  [`${DIR}/0001_add.sql`]: `ALTER TABLE "user" ADD COLUMN "phone" text;`,
  [`${DIR}/0002_drop.sql`]: `ALTER TABLE "user" DROP COLUMN "phone";`,
  [`${DIR}/0003_drop_ok.sql`]: `-- allow-destructive: columna sin uso desde v2\nALTER TABLE "user" DROP COLUMN "phone";`,
  [`${DIR}/0004_rename.sql`]: `ALTER TABLE "user" RENAME COLUMN "a" TO "b";`,
  [`${DIR}/0005_type.sql`]: `ALTER TABLE "user" ALTER COLUMN "age" SET DATA TYPE bigint;`,
  [`${DIR}/0006_drop_table.sql`]: `DROP TABLE "old";`,
};
const read = (p: string) => files[p] ?? "";

describe("parseNameStatus", () => {
  it("parses added, modified, deleted and renamed entries", () => {
    const out = [
      `A\t${DIR}/0001_add.sql`,
      `M\t${DIR}/0000_init.sql`,
      `D\t${DIR}/0000_old.sql`,
      `R100\t${DIR}/0000_a.sql\t${DIR}/0000_b.sql`,
      "",
    ].join("\n");
    expect(parseNameStatus(out)).toEqual([
      { status: "A", path: `${DIR}/0001_add.sql` },
      { status: "M", path: `${DIR}/0000_init.sql` },
      { status: "D", path: `${DIR}/0000_old.sql` },
      { status: "R", path: `${DIR}/0000_a.sql`, newPath: `${DIR}/0000_b.sql` },
    ]);
  });
});

describe("checkMigrations", () => {
  it("accepts a new additive migration", () => {
    expect(checkMigrations([{ status: "A", path: `${DIR}/0001_add.sql` }], read)).toEqual([]);
  });

  it("ignores drizzle metadata changes", () => {
    expect(
      checkMigrations([{ status: "M", path: `${DIR}/meta/_journal.json` }], read),
    ).toEqual([]);
  });

  it.each(["M", "D"] as const)("rejects status %s on an existing migration", (status) => {
    const errors = checkMigrations([{ status, path: `${DIR}/0000_init.sql` }], read);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("0000_init.sql");
  });

  it("rejects a renamed migration", () => {
    const errors = checkMigrations(
      [{ status: "R", path: `${DIR}/0000_a.sql`, newPath: `${DIR}/0000_b.sql` }],
      read,
    );
    expect(errors).toHaveLength(1);
  });

  it.each(["0002_drop.sql", "0004_rename.sql", "0005_type.sql", "0006_drop_table.sql"])(
    "rejects destructive SQL in %s",
    (name) => {
      const errors = checkMigrations([{ status: "A", path: `${DIR}/${name}` }], read);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("allow-destructive");
    },
  );

  it("accepts destructive SQL with an explicit reason", () => {
    expect(checkMigrations([{ status: "A", path: `${DIR}/0003_drop_ok.sql` }], read)).toEqual([]);
  });

  it("ignores files outside the migrations folder", () => {
    expect(checkMigrations([{ status: "D", path: "apps/web/x.sql" }], read)).toEqual([]);
  });
});
