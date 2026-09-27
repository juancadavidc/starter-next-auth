import { describe, expect, it } from "vitest";
import { ApiError } from "@repo/auth/api-error";
import { toActionState } from "./action-state";

describe("toActionState", () => {
  it("returns an empty state when the action succeeds", async () => {
    expect(await toActionState(async () => {})).toEqual({});
  });

  it("passes through the state the action returns", async () => {
    expect(await toActionState(async () => ({ error: "Nombre inválido" }))).toEqual({
      error: "Nombre inválido",
    });
  });

  it("turns an ApiError (guard or business rule) into a visible error", async () => {
    const state = await toActionState(async () => {
      throw new ApiError("No puedes cambiar tu propio rol ni suspender tu cuenta", 400);
    });
    expect(state).toEqual({ error: "No puedes cambiar tu propio rol ni suspender tu cuenta" });
  });

  it("rethrows anything else (unknown errors, and Next's redirect signal)", async () => {
    const boom = new Error("db down");
    await expect(
      toActionState(async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
  });
});
