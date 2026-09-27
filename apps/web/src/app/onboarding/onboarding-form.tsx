"use client";

import { useActionState } from "react";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import type { ActionState } from "@/lib/action-state";
import { submitOnboarding } from "./actions";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitOnboarding, {});
  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">¿Cómo te llamas?</Label>
        <Input id="name" name="name" defaultValue={defaultName} autoComplete="name" required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        Continuar
      </Button>
    </form>
  );
}
