import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@repo/auth/guards";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  if (user.profileCompleted) redirect("/app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Antes de empezar</h1>
      <OnboardingForm defaultName={user.name} />
    </main>
  );
}
