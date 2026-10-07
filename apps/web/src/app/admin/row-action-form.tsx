"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  align?: "start" | "end";
};

// Formulario de una acción de la tabla: muestra junto al botón el error que devuelva la
// server action (sesión vencida, permiso, "no puedes cambiar tu propio rol", …).
export function RowActionForm({ action, children, align = "end" }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={`flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}>
      {children}
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
