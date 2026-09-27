export type Strategy = "network-with-offline-fallback" | "cache-first" | "bypass";

// Qué hace el service worker con cada request. A propósito NO cachea páginas HTML: son
// por usuario y en un dispositivo compartido filtrarían datos. Sin red, se muestra /offline.
export function strategyFor(url: URL, request: { method: string; mode: string }, origin: string): Strategy {
  if (request.method !== "GET" || url.origin !== origin) return "bypass";
  if (url.pathname.startsWith("/api/")) return "bypass";
  if (url.pathname.startsWith("/_next/static/")) return "cache-first";
  if (request.mode === "navigate") return "network-with-offline-fallback";
  return "bypass";
}
