import { shouldUseR2 } from "./env";
import { localStore } from "./local";
import { r2Store } from "./r2";
import type { ObjectStore, StoredObject } from "./types";

export type { ObjectStore, StoredObject } from "./types";

// El almacén activo. Se decide en cada llamada para que los tests puedan cambiar el
// entorno.
export function objectStore(): ObjectStore {
  return shouldUseR2() ? r2Store : localStore;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await objectStore().put(key, body, contentType);
}

export async function getObject(key: string): Promise<StoredObject | null> {
  return objectStore().get(key);
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await objectStore().delete(keys);
}

export async function listObjects(prefix: string): Promise<string[]> {
  return objectStore().list(prefix);
}
