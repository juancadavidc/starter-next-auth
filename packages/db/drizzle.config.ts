import { defineConfig } from "drizzle-kit";
import { loadRootEnv } from "./src/root-env";

loadRootEnv();

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
