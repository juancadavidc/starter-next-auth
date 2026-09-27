import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Sin conexión</h1>
      <p className="text-muted-foreground">Revisa tu internet y vuelve a intentarlo.</p>
    </main>
  );
}
