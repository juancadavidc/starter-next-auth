"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PERMISSIONS, type Permission } from "@repo/auth/permissions";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  // Sin `role` es un alta: la clave se elige aquí y después no cambia.
  role?: { key: string; name: string; description: string; permissions: Permission[] };
  // Permisos que quien edita puede otorgar; el resto se muestra deshabilitado.
  grantable: Permission[];
};

export function RoleForm({ action, role, grantable }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="key">Clave</Label>
        {role ? (
          <>
            <input type="hidden" name="key" value={role.key} />
            <Input id="key" value={role.key} disabled />
          </>
        ) : (
          <Input id="key" name="key" placeholder="soporte" pattern="[a-z][a-z0-9\-]{1,31}" required />
        )}
        <p className="text-xs text-muted-foreground">
          Minúsculas, números y guiones. Es lo que se guarda en cada usuario: no se puede cambiar.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" defaultValue={role?.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción</Label>
        <Input id="description" name="description" defaultValue={role?.description} />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">Permisos</legend>
        {(Object.keys(PERMISSIONS) as Permission[]).map((p) => (
          <label key={p} className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="permissions"
              value={p}
              defaultChecked={role?.permissions.includes(p)}
              disabled={!grantable.includes(p)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span className="flex flex-col">
              <span className="font-medium">{PERMISSIONS[p].label}</span>
              <span className="text-muted-foreground">{PERMISSIONS[p].description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {role ? "Guardar cambios" : "Crear rol"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/roles">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
