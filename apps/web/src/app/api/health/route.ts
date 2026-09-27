// Liveness para Coolify. A propósito NO toca la base: si Postgres se cae, el contenedor
// sigue sano y el orquestador no debe reiniciarlo en falso.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
