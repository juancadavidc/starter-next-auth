import { randomUUID } from "node:crypto";

// La extensión viene de un nombre de archivo del usuario y termina en la key: solo se
// acepta una extensión corta alfanumérica.
export function safeExtension(filename: string): string {
  const match = filename.match(/\.([^./\\]+)$/);
  const ext = match?.[1]?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? `.${ext}` : "";
}

export function newObjectKey(prefix: string, filename: string): string {
  const cleanPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${cleanPrefix}/${randomUUID()}${safeExtension(filename)}`;
}

// Segmentos [a-z0-9._-], sin vacíos ni "..": una key así no escapa del bucket en la ruta
// pública /api/files/<key>.
export function isSafeKey(key: string): boolean {
  if (!key) return false;
  return key.split("/").every((segment) => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== "..");
}
