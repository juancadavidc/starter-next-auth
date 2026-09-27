import { ApiError } from "@repo/auth/api-error";
import { makeImageVariants, type VariantSize } from "./image-variants";
import { newObjectKey } from "./keys";
import { deleteObjects, putObject } from "./r2";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Margen para el overhead del multipart (boundary + encabezados de cada parte): generoso
// para no rechazar un archivo válido por unos bytes de más.
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

// En un Route Handler, `request.formData()` bufferiza todo el body en memoria SIN límite
// por defecto: hay que llamar esto antes de `formData()`, no después. Content-Length
// ausente o inválido se trata como "demasiado grande" (no hay forma de confiar en el
// tamaño real sin leer el body).
export function assertUploadRequestSize(request: Request, maxBytes = MAX_IMAGE_BYTES): void {
  const contentLength = request.headers.get("content-length");
  const size = contentLength ? Number(contentLength) : NaN;
  if (!Number.isFinite(size) || size > maxBytes + MULTIPART_OVERHEAD_BYTES) {
    throw new ApiError("El archivo supera 5 MB", 413);
  }
}

// Valida lo que llega por multipart antes de gastar CPU en sharp.
export function assertImageFile(value: unknown): asserts value is File {
  if (!(value instanceof File)) throw new ApiError("No se envió ningún archivo", 400);
  if (!ALLOWED_IMAGE_TYPES.includes(value.type)) throw new ApiError("Tipo de archivo no permitido", 400);
  if (value.size > MAX_IMAGE_BYTES) throw new ApiError("El archivo supera 5 MB", 400);
}

// Sube las tres variantes como <prefijo>/<uuid>-<talla>.webp. Si alguna falla, borra las
// que alcanzaron a subir para no dejar huérfanos.
export async function uploadImage(
  file: File,
  prefix: string,
): Promise<{ baseKey: string; keys: Record<VariantSize, string> }> {
  assertImageFile(file);
  const variants = await makeImageVariants(Buffer.from(await file.arrayBuffer())).catch(() => {
    throw new ApiError("La imagen no se pudo procesar", 400);
  });
  const baseKey = newObjectKey(prefix, "x").replace(/\.[^.]+$/, "");
  const keys = Object.fromEntries(variants.map((v) => [v.size, `${baseKey}-${v.size}.webp`])) as Record<
    VariantSize,
    string
  >;
  const results = await Promise.allSettled(variants.map((v) => putObject(keys[v.size], v.buffer, v.contentType)));
  if (results.some((r) => r.status === "rejected")) {
    // No tapamos el error original: si el borrado de huérfanos también falla, lo dejamos
    // en el log para que alguien lo limpie a mano, pero el 502 sigue siendo el correcto.
    await deleteObjects(Object.values(keys)).catch((cleanupError: unknown) => {
      console.error("No se pudieron borrar los objetos huérfanos tras un upload fallido", cleanupError);
    });
    throw new ApiError("No se pudo guardar la imagen", 502);
  }
  return { baseKey, keys };
}
