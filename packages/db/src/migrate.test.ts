import postgres from "postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./migrate";
import { recreateDatabase, dropDatabase } from "./test-db";

// Cada test usa una base propia y desechable, distinta de la base de test compartida.
const baseUrl = new URL(process.env.DATABASE_URL!);
const scratchName = `${baseUrl.pathname.slice(1)}_migrate`;
const scratchUrl = new URL(baseUrl);
scratchUrl.pathname = `/${scratchName}`;

async function appliedCount(): Promise<number> {
  const client = postgres(scratchUrl.toString(), { max: 1 });
  try {
    const rows = await client`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return rows[0]!.n as number;
  } finally {
    await client.end();
  }
}

beforeEach(async () => {
  await recreateDatabase(scratchUrl.toString());
});

afterEach(async () => {
  await dropDatabase(scratchUrl.toString());
});

describe("runMigrations", () => {
  it("creates the auth tables", async () => {
    await runMigrations({ databaseUrl: scratchUrl.toString() });
    const client = postgres(scratchUrl.toString(), { max: 1 });
    // `to_regclass` devuelve el nombre citado ("user") porque "user" es palabra reservada
    // en Postgres; basta con confirmar que la tabla existe (no null).
    const rows = await client`select to_regclass('public.user') as t`;
    await client.end();
    expect(rows[0]!.t).not.toBeNull();
  });

  it("is idempotent", async () => {
    await runMigrations({ databaseUrl: scratchUrl.toString() });
    const first = await appliedCount();
    await runMigrations({ databaseUrl: scratchUrl.toString() });
    expect(await appliedCount()).toBe(first);
  });

  it("is safe when two processes migrate at the same time", async () => {
    await Promise.all([
      runMigrations({ databaseUrl: scratchUrl.toString() }),
      runMigrations({ databaseUrl: scratchUrl.toString() }),
    ]);
    expect(await appliedCount()).toBeGreaterThan(0);
  });
});
