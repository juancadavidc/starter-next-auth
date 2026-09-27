import { afterEach, describe, expect, it, vi } from "vitest";
import { db, eq, schema } from "@repo/db";
import { auth } from "./server";

const password = "a-long-test-password";

async function userByEmail(email: string) {
  const [row] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  return row;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await db.delete(schema.user);
});

describe("auth user creation", () => {
  it("creates admins from ADMIN_EMAILS regardless of case and spaces", async () => {
    vi.stubEnv("ADMIN_EMAILS", " Boss@Example.test , other@example.test");
    await auth.api.signUpEmail({
      body: { email: "boss@example.test", password, name: "Boss" },
    });
    expect((await userByEmail("boss@example.test"))?.role).toBe("admin");
  });

  it("creates regular users with an incomplete profile", async () => {
    vi.stubEnv("ADMIN_EMAILS", "boss@example.test");
    await auth.api.signUpEmail({
      body: { email: "someone@example.test", password, name: "Someone" },
    });
    const row = await userByEmail("someone@example.test");
    expect(row?.role).toBe("user");
    expect(row?.profileCompleted).toBe(false);
  });

  // Campos que el cliente no debe poder fijar: se fuerzan con un cast a propósito.
  function sneakyBody(extra: Record<string, unknown>) {
    return { email: "sneaky@example.test", password, name: "Sneaky", ...extra } as {
      email: string;
      password: string;
      name: string;
    };
  }

  it("does not let sign-up set the role or profileCompleted", async () => {
    expect.hasAssertions();
    vi.stubEnv("ADMIN_EMAILS", "");
    // Better Auth rechaza `role` (input: false en el plugin admin) y no crea la cuenta.
    await expect(
      auth.api.signUpEmail({ body: sneakyBody({ role: "admin", profileCompleted: true }) }),
    ).rejects.toMatchObject({ statusCode: 400, body: { code: "FIELD_NOT_ALLOWED" } });
    expect(await userByEmail("sneaky@example.test")).toBeUndefined();
  });

  it("ignores profileCompleted sent alone at sign-up", async () => {
    expect.hasAssertions();
    vi.stubEnv("ADMIN_EMAILS", "");
    // Con input: false y defaultValue, Better Auth descarta el valor y usa el default.
    await auth.api.signUpEmail({ body: sneakyBody({ profileCompleted: true }) });
    const row = await userByEmail("sneaky@example.test");
    expect(row?.role).toBe("user");
    expect(row?.profileCompleted).toBe(false);
  });
});
