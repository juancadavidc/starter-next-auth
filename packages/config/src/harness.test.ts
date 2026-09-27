import { describe, expect, it } from "vitest";

// Prueba mínima de que Vitest corre desde la raíz del monorepo.
describe("test harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
