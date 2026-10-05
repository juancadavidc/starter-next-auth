import { handleApiError, ApiError } from "@repo/auth/api-error";
import { isSafeKey } from "@repo/storage/keys";
import { getObject } from "@repo/storage/objects";

// Sirve objetos del almacén (R2 en producción) a través de la app. Las keys llevan UUID: el contenido de una key
// nunca cambia, por eso la caché es inmutable. El Content-Type viene de quien subió el
// archivo: nosniff evita que el navegador adivine otro tipo y `sandbox` impide que un
// HTML o SVG subido corra scripts con el origen de la app.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const key = (await params).key.join("/");
    if (!isSafeKey(key)) throw new ApiError("No encontrado", 404);
    const object = await getObject(key);
    if (!object) throw new ApiError("No encontrado", 404);
    const headers: Record<string, string> = {
      "Content-Type": object.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    };
    if (object.contentLength !== null) headers["Content-Length"] = String(object.contentLength);
    return new Response(object.body as BodyInit, { headers });
  } catch (error) {
    return handleApiError(error);
  }
}
