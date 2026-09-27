import { config } from "dotenv";
import { vi } from "vitest";
import { LOCAL_DATABASE_URL, toTestDatabaseUrl } from "./packages/db/src/test-url.ts";

// Cada worker apunta a la base de test (creada en vitest.global-setup.ts) antes de que
// cualquier test importe @repo/db.
config({ quiet: true });
process.env.DATABASE_URL = toTestDatabaseUrl(process.env.DATABASE_URL ?? LOCAL_DATABASE_URL);
process.env.BETTER_AUTH_SECRET ||= "test-secret-test-secret-test-secret-00";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
process.env.GOOGLE_CLIENT_ID ||= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ||= "test-google-client-secret";

// `server-only` lanza fuera de un bundle de servidor de Next; en tests no aplica.
vi.mock("server-only", () => ({}));

// Fuera de un request de Next, `revalidateTag` lanza y `unstable_cache` no tiene almacén.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn(<T>(fn: T) => fn),
}));
