import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { storageEnv } from "./env";
import type { ObjectStore } from "./types";

// DeleteObjects acepta hasta 1000 keys por llamada.
const DELETE_BATCH = 1000;

let client: S3Client | undefined;

function r2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${storageEnv.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: storageEnv.accessKeyId, secretAccessKey: storageEnv.secretAccessKey },
  });
  return client;
}

export const r2Store: ObjectStore = {
  async put(key, body, contentType) {
    await r2().send(new PutObjectCommand({ Bucket: storageEnv.bucket, Key: key, Body: body, ContentType: contentType }));
  },

  async get(key) {
    try {
      const res = await r2().send(new GetObjectCommand({ Bucket: storageEnv.bucket, Key: key }));
      if (!res.Body) return null;
      return {
        body: res.Body.transformToWebStream(),
        contentType: res.ContentType ?? "application/octet-stream",
        contentLength: res.ContentLength ?? null,
      };
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  },

  async delete(keys) {
    for (let i = 0; i < keys.length; i += DELETE_BATCH) {
      const batch = keys.slice(i, i + DELETE_BATCH);
      await r2().send(
        new DeleteObjectsCommand({
          Bucket: storageEnv.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
    }
  },

  async list(prefix) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await r2().send(
        new ListObjectsV2Command({ Bucket: storageEnv.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      for (const object of res.Contents ?? []) if (object.Key) keys.push(object.Key);
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return keys;
  },
};
