import "./load-env";
import { env } from "@repo/env";
import { runMigrations } from "../migrate";

await runMigrations({ databaseUrl: env.databaseUrl });
console.log("Migraciones aplicadas.");
