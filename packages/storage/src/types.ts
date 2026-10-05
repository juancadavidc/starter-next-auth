export type StoredObject = {
  body: ReadableStream | Uint8Array;
  contentType: string;
  contentLength: number | null;
};

// Lo mínimo que la app necesita de un almacén de objetos: R2 en producción, un
// directorio en desarrollo y tests.
export type ObjectStore = {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  // null si la key no existe.
  get(key: string): Promise<StoredObject | null>;
  delete(keys: string[]): Promise<void>;
  list(prefix: string): Promise<string[]>;
};
