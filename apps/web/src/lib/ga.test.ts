import { describe, expect, it } from "vitest";
import { isValidGaId } from "./ga";

describe("isValidGaId", () => {
  it("accepts GA4 measurement ids", () => {
    expect(isValidGaId("G-ABC123XYZ9")).toBe(true);
  });

  it.each([undefined, "", "UA-123-1", "G-abc", "G-1');alert(1);//"])("rejects %s", (id) => {
    expect(isValidGaId(id)).toBe(false);
  });
});
