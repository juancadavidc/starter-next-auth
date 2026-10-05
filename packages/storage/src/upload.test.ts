import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import * as objects from "./objects";
import { assertImageFile, assertUploadRequestSize, MAX_IMAGE_BYTES, uploadImage } from "./upload";

vi.mock("./objects", () => ({
  putObject: vi.fn(),
  deleteObjects: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("assertImageFile", () => {
  it("accepts an allowed image under the size limit", () => {
    expect(() => assertImageFile(new File([new Uint8Array(10)], "a.png", { type: "image/png" }))).not.toThrow();
  });

  it("rejects non-files", () => {
    expect(() => assertImageFile("a.png")).toThrow(ApiError);
  });

  it("rejects disallowed types", () => {
    expect(() => assertImageFile(new File(["x"], "a.svg", { type: "image/svg+xml" }))).toThrow(
      "Tipo de archivo no permitido",
    );
  });

  it("rejects files over the limit", () => {
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "a.png", { type: "image/png" });
    expect(() => assertImageFile(big)).toThrow("El archivo supera 5 MB");
  });
});

// Simula un Request real sin depender de que Headers permita fijar Content-Length (la
// Fetch API lo trata como cabecera prohibida al construir un Request "de verdad").
function requestWithContentLength(value: string | null): Request {
  return { headers: { get: () => value } } as unknown as Request;
}

describe("assertUploadRequestSize", () => {
  it("rejects a missing Content-Length header", () => {
    expect(() => assertUploadRequestSize(requestWithContentLength(null))).toThrow(ApiError);
  });

  it("rejects a request over the limit", () => {
    expect(() => assertUploadRequestSize(requestWithContentLength(String(MAX_IMAGE_BYTES * 2)))).toThrow(
      "El archivo supera 5 MB",
    );
  });

  it("accepts a request within the limit", () => {
    expect(() => assertUploadRequestSize(requestWithContentLength(String(MAX_IMAGE_BYTES)))).not.toThrow();
  });
});

async function pngFile(name = "a.png"): Promise<File> {
  const buffer = await sharp({ create: { width: 300, height: 300, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .png()
    .toBuffer();
  return new File([new Uint8Array(buffer)], name, { type: "image/png" });
}

describe("uploadImage", () => {
  it("uploads the three variants and returns their keys", async () => {
    vi.mocked(objects.putObject).mockResolvedValue(undefined);
    const result = await uploadImage(await pngFile(), "Avatars");

    expect(objects.putObject).toHaveBeenCalledTimes(3);
    expect(Object.keys(result.keys)).toEqual(["sm", "md", "lg"]);
    for (const size of ["sm", "md", "lg"] as const) {
      expect(result.keys[size]).toMatch(new RegExp(`^avatars/[0-9a-f-]{36}-${size}\\.webp$`));
      expect(objects.putObject).toHaveBeenCalledWith(result.keys[size], expect.any(Buffer), "image/webp");
    }
    expect(objects.deleteObjects).not.toHaveBeenCalled();
  });

  it("cleans up the uploaded variants and rethrows when one putObject fails", async () => {
    vi.mocked(objects.putObject)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("network"));
    vi.mocked(objects.deleteObjects).mockResolvedValue(undefined);

    await expect(uploadImage(await pngFile(), "avatars")).rejects.toThrow("No se pudo guardar la imagen");

    expect(objects.deleteObjects).toHaveBeenCalledTimes(1);
    const [deletedKeys] = vi.mocked(objects.deleteObjects).mock.calls[0] as [string[]];
    expect(deletedKeys).toHaveLength(3);
  });

  it("logs the cleanup failure but still surfaces the original error", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(objects.putObject)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    vi.mocked(objects.deleteObjects).mockRejectedValue(new Error("delete failed"));

    await expect(uploadImage(await pngFile(), "avatars")).rejects.toThrow("No se pudo guardar la imagen");

    expect(consoleError).toHaveBeenCalledWith(
      "No se pudieron borrar los objetos huérfanos tras un upload fallido",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });
});
