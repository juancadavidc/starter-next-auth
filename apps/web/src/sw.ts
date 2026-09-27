/// <reference lib="webworker" />
// Service worker mínimo: assets estáticos cache-first y página /offline sin red.
// Se compila con esbuild a public/sw.js (ver scripts de apps/web/package.json).
import { strategyFor } from "./sw-strategy";

const sw = self as unknown as ServiceWorkerGlobalScope;
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const OFFLINE_CACHE = `offline-${VERSION}`;
const OFFLINE_URL = "/offline";

sw.addEventListener("install", (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)));
  void sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![STATIC_CACHE, OFFLINE_CACHE].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const strategy = strategyFor(url, event.request, sw.location.origin);
  if (strategy === "cache-first") {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) void cache.put(event.request, res.clone());
        return res;
      }),
    );
  } else if (strategy === "network-with-offline-fallback") {
    event.respondWith(
      fetch(event.request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error()),
    );
  }
});
