import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDevLoginEnabled } from "@repo/auth/dev-login";
import { safeNext } from "@repo/auth/safe-next";
import { isGoogleConfigured } from "@repo/auth/server";
import { getSessionUser } from "@repo/auth/session";
import { LoginButtons } from "@/components/login-buttons";
import { loginErrorMessage } from "@/lib/login-errors";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  const user = await getSessionUser();
  if (user && !user.banned) redirect(target);

  // ?error=banned lo pone el guard; ?error=BANNED_USER (u otro código) lo pone Better Auth
  // al volver del callback de Google.
  const errorMessage = loginErrorMessage(error);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {errorMessage && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
      <LoginButtons next={target} googleEnabled={isGoogleConfigured()} devLogin={isDevLoginEnabled()} />
    </main>
  );
}
