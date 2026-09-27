"use server";

import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@repo/auth/guards";
import { toActionState, type ActionState } from "@/lib/action-state";
import { setUserBanned, setUserRole } from "@/lib/admin-users";

// Guard de API: si la sesión expiró o ya no es admin, o si la regla de negocio rechaza
// el cambio (p. ej. un admin sobre sí mismo), la fila muestra el mensaje en lugar de romper.
export async function changeRole(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return toActionState(async () => {
    const actor = await requireAdminApi();
    await setUserRole(actor, String(formData.get("userId")), formData.get("role"));
    revalidatePath("/admin/users");
  });
}

export async function changeBan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return toActionState(async () => {
    const actor = await requireAdminApi();
    await setUserBanned(actor, String(formData.get("userId")), formData.get("banned") === "true");
    revalidatePath("/admin/users");
  });
}
