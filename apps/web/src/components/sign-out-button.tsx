"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Salir
    </Button>
  );
}
