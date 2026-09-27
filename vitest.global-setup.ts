import { runMigrations } from "./packages/db/src/migrate.ts";
import { loadRootEnv } from "./packages/db/src/root-env.ts";
import { dropDatabase, recreateDatabase } from "./packages/db/src/test-db.ts";
import { LOCAL_DATABASE_URL, toTestDatabaseUrl } from "./packages/db/src/test-url.ts";

// Crea <base>_test desde cero y la migra una vez por corrida de Vitest.
export default async function setup() {
  loadRootEnv();
  const testUrl = toTestDatabaseUrl(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);

  await recreateDatabase(testUrl);
  await runMigrations({ databaseUrl: testUrl });

  return async () => {
    await dropDatabase(testUrl);
  };
}
