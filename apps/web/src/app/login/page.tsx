import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDevLoginEnabled } from "@repo/auth/dev-login";
import { safeNext } from "@repo/auth/safe-next";
import { isGoogleConfigured } from "@repo/auth/server";
import { getSessionUser } from "@repo/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";
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
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Entrar</CardTitle>
          <CardDescription>Usa tu cuenta de Google para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {errorMessage && (
            <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}
          <LoginButtons next={target} googleEnabled={isGoogleConfigured()} devLogin={isDevLoginEnabled()} />
        </CardContent>
      </Card>
    </main>
  );
}
