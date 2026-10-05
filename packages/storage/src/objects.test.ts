import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { shouldUseR2 } from "./env";
import { deleteObjects, getObject, listObjects, objectStore, putObject } from "./objects";
import { r2Store } from "./r2";

async function readBody(body: ReadableStream | Uint8Array): Promise<string> {
  return new Response(body as BodyInit).text();
}

describe("shouldUseR2", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the local store in development without credentials", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldUseR2()).toBe(false);
  });

  it("uses R2 whenever there are credentials", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "cuenta");
    vi.stubEnv("NODE_ENV", "development");
    expect(shouldUseR2()).toBe(true);
    expect(objectStore()).toBe(r2Store);
  });

  it("always uses R2 in production, even without credentials", () => {
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(shouldUseR2()).toBe(true);
  });
});

describe("local store", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "storage-"));
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("STORAGE_LOCAL_DIR", dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("puts, gets, lists and deletes objects", async () => {
    await putObject("avatars/a-sm.webp", Buffer.from("hola"), "image/webp");
    await putObject("avatars/b-sm.webp", Buffer.from("chao"), "image/webp");
    await putObject("docs/c.png", Buffer.from("x"), "image/png");

    const object = await getObject("avatars/a-sm.webp");
    expect(object?.contentType).toBe("image/webp");
    expect(object?.contentLength).toBe(4);
    expect(await readBody(object!.body)).toBe("hola");

    expect(await listObjects("avatars/")).toEqual(["avatars/a-sm.webp", "avatars/b-sm.webp"]);

    await deleteObjects(["avatars/a-sm.webp"]);
    expect(await getObject("avatars/a-sm.webp")).toBeNull();
    expect(await listObjects("")).toEqual(["avatars/b-sm.webp", "docs/c.png"]);
  });

  it("returns null for a missing key and an empty list for an empty store", async () => {
    expect(await getObject("avatars/nada.webp")).toBeNull();
    expect(await listObjects("avatars/")).toEqual([]);
  });

  it("refuses keys that would escape the directory", async () => {
    await expect(putObject("../fuera.webp", Buffer.from("x"), "image/webp")).rejects.toThrow("Key de objeto inválida");
  });
});
