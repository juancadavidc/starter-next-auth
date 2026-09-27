"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
};

// Formulario de una acción de la tabla: muestra junto al botón el error que devuelva la
// server action (sesión vencida, permiso, "no puedes cambiar tu propio rol", …).
export function RowActionForm({ action, children }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      {children}
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
