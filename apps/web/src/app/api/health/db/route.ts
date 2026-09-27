import { db, sql } from "@repo/db";

// Readiness: la base responde y las migraciones corrieron (existe la tabla "user").
// Lo usa el smoke test de la imagen en CI.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1 from "user" limit 1`);
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error(error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
