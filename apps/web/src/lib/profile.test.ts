import { afterEach, describe, expect, it } from "vitest";
import { db, eq, schema } from "@repo/db";
import { createUser } from "@/test/factories";
import { completeProfile } from "./profile";

afterEach(async () => {
  await db.delete(schema.user);
});

describe("completeProfile", () => {
  it("saves the trimmed name and marks the profile complete", async () => {
    const user = await createUser({ name: "x" });
    expect(await completeProfile(user.id, { name: "  Ana María  " })).toEqual({ ok: true });
    const [row] = await db.select().from(schema.user).where(eq(schema.user.id, user.id));
    expect(row?.name).toBe("Ana María");
    expect(row?.profileCompleted).toBe(true);
  });

  it.each([{ name: "" }, { name: " a " }, { name: "x".repeat(81) }, {}, null])(
    "rejects invalid input %j without touching the user",
    async (input) => {
      const user = await createUser();
      const result = await completeProfile(user.id, input);
      expect(result.ok).toBe(false);
      const [row] = await db.select().from(schema.user).where(eq(schema.user.id, user.id));
      expect(row?.profileCompleted).toBe(false);
    },
  );
});
