"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { signIn } from "@repo/auth/client";
import { DEV_PASSWORD, DEV_USERS } from "@repo/auth/dev-login";
import { Button } from "@repo/ui/components/button";
import { BANNED_MESSAGE, isBannedError } from "@/lib/login-errors";

type Props = { next: string; googleEnabled: boolean; devLogin: boolean };

export function LoginButtons({ next, googleEnabled, devLogin }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function withGoogle() {
    setPending(true);
    // Si Google autentica pero la cuenta está baneada, Better Auth vuelve aquí con
    // ?error=BANNED_USER (y conservamos el destino).
    const { error } = await signIn.social({
      provider: "google",
      callbackURL: next,
      errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
    });
    if (error) {
      toast.error(isBannedError(error.code) ? BANNED_MESSAGE : "No se pudo iniciar sesión con Google.");
      setPending(false);
    }
  }

  // Solo se muestra en desarrollo; en producción el servidor tiene apagado email/clave.
  async function asDevUser(email: string) {
    setPending(true);
    const { error } = await signIn.email({ email, password: DEV_PASSWORD });
    if (error) {
      toast.error(
        isBannedError(error.code)
          ? BANNED_MESSAGE
          : "Usuario de desarrollo no encontrado. Corre `pnpm db:seed:dev`.",
      );
      setPending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {googleEnabled ? (
        <Button size="lg" onClick={withGoogle} disabled={pending}>
          Entrar con Google
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Google no está configurado (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
        </p>
      )}
      {devLogin && (
        <div className="mt-4 flex flex-col gap-2 border-t pt-4">
          <p className="text-xs text-muted-foreground">Solo desarrollo</p>
          {DEV_USERS.map((u) => (
            <Button key={u.email} variant="outline" onClick={() => asDevUser(u.email)} disabled={pending}>
              Entrar como {u.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
