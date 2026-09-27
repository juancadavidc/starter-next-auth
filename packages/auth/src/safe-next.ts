// Solo rutas internas de la app: nada absoluto, ni "//host", ni "/\host", ni /api, ni "..".
// Así `?next=` nunca sirve de open redirect.
const INTERNAL_PATH = /^\/(?![/\\])[\w\-./~?=&%]*$/;
// "/api", "/api/..." y "/api?..." son rutas de servidor, no páginas.
const API_PATH = /^\/api(?:[/?]|$)/;

function escapesApp(path: string): boolean {
  return path.includes("..") || API_PATH.test(path);
}

export function safeNext(next: string | null | undefined, fallback = "/app"): string {
  if (!next || !INTERNAL_PATH.test(next)) return fallback;
  // El navegador trata "%2e%2e" como "..": se revisa también la forma decodificada.
  let decoded: string;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (escapesApp(next) || escapesApp(decoded)) return fallback;
  return next;
}
