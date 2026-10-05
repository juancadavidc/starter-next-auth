import { afterEach, describe, expect, it, vi } from "vitest";

// Doble de getObject: estos tests cubren las cabeceras y el filtro de keys, no el almacén.
const getObject = vi.fn();
vi.mock("@repo/storage/objects", () => ({ getObject: (key: string) => getObject(key) }));

const { GET } = await import("./route");

const call = (key: string[]) => GET(new Request("http://localhost/api/files"), { params: Promise.resolve({ key }) });

describe("GET /api/files/[...key]", () => {
  afterEach(() => {
    getObject.mockReset();
  });

  it("serves the object with nosniff and a sandbox CSP", async () => {
    getObject.mockResolvedValueOnce({
      body: new Blob(["<svg><script>alert(1)</script></svg>"]).stream(),
      contentType: "image/svg+xml",
      contentLength: 36,
    });
    const res = await call(["uploads", "a.svg"]);
    expect(res.status).toBe(200);
    expect(getObject).toHaveBeenCalledWith("uploads/a.svg");
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toBe("sandbox");
    expect(res.headers.get("content-length")).toBe("36");
  });

  it("answers 404 for unsafe keys without reaching the store", async () => {
    const res = await call(["..", "secret"]);
    expect(res.status).toBe(404);
    expect(getObject).not.toHaveBeenCalled();
  });

  it("answers 404 when the object does not exist", async () => {
    getObject.mockResolvedValueOnce(null);
    const res = await call(["uploads", "missing.webp"]);
    expect(res.status).toBe(404);
  });
});
