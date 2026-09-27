"use server";

import { redirect } from "next/navigation";
import { requireUserApi } from "@repo/auth/guards";
import { toActionState, type ActionState } from "@/lib/action-state";
import { completeProfile } from "@/lib/profile";

// Guard de API (no el de página): sin sesión o baneado, el formulario muestra el error
// en lugar de redirigir desde dentro de la action.
export async function submitOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    const user = await requireUserApi();
    const result = await completeProfile(user.id, { name: formData.get("name") });
    if (!result.ok) return { error: result.error };
  });
  if (state.error) return state;
  redirect("/app");
}
