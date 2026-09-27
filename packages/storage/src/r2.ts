import {
  DeleteObjectsCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { storageEnv } from "./env";

let client: S3Client | undefined;

function r2(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${storageEnv.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: storageEnv.accessKeyId, secretAccessKey: storageEnv.secretAccessKey },
  });
  return client;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2().send(new PutObjectCommand({ Bucket: storageEnv.bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await r2().send(new GetObjectCommand({ Bucket: storageEnv.bucket, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream(),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (error instanceof NoSuchKey) return null;
    throw error;
  }
}

export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await r2().send(
    new DeleteObjectsCommand({
      Bucket: storageEnv.bucket,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
