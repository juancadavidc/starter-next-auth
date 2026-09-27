import "server-only";
import { z } from "zod";
import { db, eq, schema } from "@repo/db";

// Onboarding mínimo: solo el nombre. Cada idea agrega aquí sus campos obligatorios.
export const profileSchema = z.object({
  name: z
    .string({ error: "Escribe tu nombre" })
    .trim()
    .min(2, "Escribe tu nombre (mínimo 2 letras)")
    .max(80, "El nombre admite máximo 80 caracteres"),
});

export async function completeProfile(
  userId: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  await db
    .update(schema.user)
    .set({ name: parsed.data.name, profileCompleted: true })
    .where(eq(schema.user.id, userId));
  return { ok: true };
}
