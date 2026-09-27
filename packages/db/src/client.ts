import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@repo/env";
import * as schema from "./schema";

// En desarrollo, el hot reload de Next reevalúa módulos: se reutiliza el pool para no
// agotar conexiones. postgres.js no abre sockets hasta la primera consulta.
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };
const client = globalForDb.pgClient ?? postgres(env.databaseUrl, { max: 10 });
if (env.nodeEnv !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
export { and, asc, desc, eq, or, sql } from "drizzle-orm";
