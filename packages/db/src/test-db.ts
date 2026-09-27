// Crea y destruye bases de datos "scratch" para pruebas, conectando a la base admin
// `postgres` del mismo servidor. Compartido por vitest.global-setup.ts (la base de test
// del monorepo) y migrate.test.ts (bases desechables por test) para no duplicar el
// drop/create de bases (Ruling #14).
import postgres from "postgres";

function databaseNameFromUrl(url: string): string {
  return new URL(url).pathname.slice(1);
}

function adminUrlFor(url: string): URL {
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  return adminUrl;
}

async function adminQuery(url: string, query: string): Promise<void> {
  const admin = postgres(adminUrlFor(url).toString(), { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(query);
  } finally {
    await admin.end();
  }
}

export async function dropDatabase(url: string): Promise<void> {
  const name = databaseNameFromUrl(url);
  await adminQuery(url, `drop database if exists "${name}" with (force)`);
}

export async function createDatabase(url: string): Promise<void> {
  const name = databaseNameFromUrl(url);
  await adminQuery(url, `create database "${name}"`);
}

// Borra (si existe) y vuelve a crear la base apuntada por `url`.
export async function recreateDatabase(url: string): Promise<void> {
  await dropDatabase(url);
  await createDatabase(url);
}
