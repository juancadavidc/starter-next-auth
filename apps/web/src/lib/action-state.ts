import { ApiError } from "@repo/auth/api-error";

// Estado que devuelven las server actions a los formularios (useActionState).
export type ActionState = { error?: string };

// Las server actions usan los guards de API (requireUserApi/requireAdminApi) y las reglas
// de negocio lanzan ApiError. Aquí ese error se vuelve un mensaje visible en el formulario
// en lugar de reventar la página. Cualquier otro error se relanza: incluye la señal de
// redirect() de Next, que no debe atraparse, y los errores inesperados (van al log).
export async function toActionState(action: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await action()) ?? {};
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}
