import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { storageEnv } from "./env";
import { contentTypeForKey, isSafeKey } from "./keys";
import type { ObjectStore } from "./types";

// Almacén de desarrollo y tests: la misma interfaz que R2 sobre un directorio. Nunca se
// usa en producción (ver `shouldUseR2`).
function pathFor(key: string): string {
  if (!isSafeKey(key)) throw new Error(`Key de objeto inválida: ${key}`);
  return path.join(path.resolve(storageEnv.localDir), ...key.split("/"));
}

async function walk(dir: string, base: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const keys: string[] = [];
  for (const entry of entries) {
    const key = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) keys.push(...(await walk(path.join(dir, entry.name), key)));
    else keys.push(key);
  }
  return keys;
}

export const localStore: ObjectStore = {
  async put(key, body) {
    const target = pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  },

  async get(key) {
    const target = pathFor(key);
    const data = await readFile(target).catch(() => null);
    if (!data) return null;
    // El directorio no guarda el Content-Type: se deduce de la extensión.
    return { body: new Uint8Array(data), contentType: contentTypeForKey(key), contentLength: data.length };
  },

  async delete(keys) {
    for (const key of keys) await rm(pathFor(key), { force: true });
  },

  async list(prefix) {
    const keys = await walk(path.resolve(storageEnv.localDir), "");
    return keys.filter((key) => key.startsWith(prefix)).sort();
  },
};
