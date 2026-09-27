import { required } from "@repo/env";

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
};
