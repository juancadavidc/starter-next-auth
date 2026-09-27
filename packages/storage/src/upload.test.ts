import { describe, expect, it } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import { assertImageFile, MAX_IMAGE_BYTES } from "./upload";

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
