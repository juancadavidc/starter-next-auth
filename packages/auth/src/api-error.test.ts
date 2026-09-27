import { describe, expect, it, vi } from "vitest";
import { ApiError, handleApiError } from "./api-error";

describe("handleApiError", () => {
  it("maps ApiError to its status and message", async () => {
    const res = handleApiError(new ApiError("Acceso denegado", 403));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Acceso denegado" });
  });

  it("hides unknown errors behind a 500", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = handleApiError(new Error("detalle interno"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
