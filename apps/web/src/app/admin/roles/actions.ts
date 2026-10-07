"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermissionApi } from "@repo/auth/guards";
import { toActionState, type ActionState } from "@/lib/action-state";
import { createRole, deleteRole, updateRole, type RoleInput } from "@/lib/admin-roles";

function roleInput(formData: FormData): RoleInput {
  return {
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    permissions: formData.getAll("permissions"),
  };
}

// Mismo patrón que /admin/users: guard de API + reglas en lib/admin-roles.ts; un rechazo
// se muestra en el formulario. El redirect va fuera de toActionState (no debe atraparse).
export async function createRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    const actor = await requirePermissionApi("roles.manage");
    await createRole(actor, formData.get("key"), roleInput(formData));
    revalidatePath("/admin/roles");
  });
  if (state.error) return state;
  redirect("/admin/roles");
}

export async function updateRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const state = await toActionState(async () => {
    const actor = await requirePermissionApi("roles.manage");
    await updateRole(actor, String(formData.get("key")), roleInput(formData));
    revalidatePath("/admin/roles");
  });
  if (state.error) return state;
  redirect("/admin/roles");
}

export async function deleteRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return toActionState(async () => {
    const actor = await requirePermissionApi("roles.manage");
    await deleteRole(actor, String(formData.get("key")));
    revalidatePath("/admin/roles");
  });
}
