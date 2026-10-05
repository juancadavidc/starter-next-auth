import { env, optional, required } from "@repo/env";

// Credenciales de Cloudflare R2 (API compatible con S3). Solo las exige este módulo.
export const storageEnv = {
  get accountId() {
    return required("R2_ACCOUNT_ID");
  },
  get accessKeyId() {
    return required("R2_ACCESS_KEY_ID");
  },
  get secretAccessKey() {
    return required("R2_SECRET_ACCESS_KEY");
  },
  get bucket() {
    return required("R2_BUCKET_NAME");
  },
  // Raíz del almacén local de desarrollo (relativa al cwd del proceso). Gitignoreada.
  get localDir() {
    return optional("STORAGE_LOCAL_DIR") ?? ".storage";
  },
};

// R2 si hay credenciales, y siempre en producción: ahí una variable faltante revienta al
// primer uso en vez de escribir en el disco desechable del contenedor. En desarrollo y
// tests, sin credenciales, los objetos van a un directorio local.
export function shouldUseR2(): boolean {
  return Boolean(optional("R2_ACCOUNT_ID")) || env.nodeEnv === "production";
}
