import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@repo/auth/session";
import { Button } from "@repo/ui/components/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user) redirect(user.profileCompleted ? "/app" : "/onboarding");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">starter-next-auth</h1>
      <p className="text-muted-foreground">Una idea nueva, con login de Google desde el primer día.</p>
      <Button asChild size="lg">
        <Link href="/login">Entrar</Link>
      </Button>
    </main>
  );
}
