// Valor de .env.example; setup.ts lo renombra junto con el proyecto.
export const LOCAL_DATABASE_URL = "postgres://starter:starter@localhost:5432/starter_next_auth";

// Los tests corren contra <base>_test para no tocar nunca la base de desarrollo.
export function toTestDatabaseUrl(url: string): string {
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, "");
  if (!name) throw new Error("DATABASE_URL no trae nombre de base de datos");
  if (name.endsWith("_test")) return url;
  parsed.pathname = `/${name}_test`;
  return parsed.toString();
}
