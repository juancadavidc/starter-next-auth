import { handleApiError, ApiError } from "@repo/auth/api-error";
import { isSafeKey } from "@repo/storage/keys";
import { getObject } from "@repo/storage/r2";

// Sirve objetos de R2 a través de la app. Las keys llevan UUID: el contenido de una key
// nunca cambia, por eso la caché es inmutable.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  try {
    const key = (await params).key.join("/");
    if (!isSafeKey(key)) throw new ApiError("No encontrado", 404);
    const object = await getObject(key);
    if (!object) throw new ApiError("No encontrado", 404);
    return new Response(object.body, {
      headers: {
        "Content-Type": object.contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
