import type { Metadata } from "next";
import Link from "next/link";
import { requireCompletedProfile } from "@repo/auth/guards";
import { Button } from "@repo/ui/components/button";
import { ThemeToggle } from "@repo/ui/components/theme-toggle";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = { title: "Inicio" };

export default async function AppHomePage() {
  const user = await requireCompletedProfile("/app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Hola, {user.name.split(/\s+/)[0]}</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>
      <p className="text-muted-foreground">Aquí empieza tu idea.</p>
      {user.role === "admin" && (
        <Button asChild variant="secondary" className="self-start">
          <Link href="/admin/users">Administrar usuarios</Link>
        </Button>
      )}
    </main>
  );
}
