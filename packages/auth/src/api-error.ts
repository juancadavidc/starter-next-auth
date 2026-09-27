// Error con status HTTP para route handlers y server actions.
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Convierte cualquier error en una respuesta JSON; los desconocidos no filtran detalles.
export function handleApiError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "Error interno" }, { status: 500 });
}
