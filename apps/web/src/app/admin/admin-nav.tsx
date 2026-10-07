import Link from "next/link";
import type { SessionUser } from "@repo/auth/access";
import { hasPermission } from "@repo/auth/permissions";
import { Button } from "@repo/ui/components/button";

// Navegación del panel: cada enlace aparece solo con su permiso. Es comodidad visual; la
// barrera real es el guard de cada página.
export function AdminNav({ user, title }: { user: SessionUser; title: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <nav className="flex items-center gap-2">
        {hasPermission(user, "users.view") && (
          <Button asChild variant="ghost">
            <Link href="/admin/users">Usuarios</Link>
          </Button>
        )}
        {hasPermission(user, "roles.manage") && (
          <Button asChild variant="ghost">
            <Link href="/admin/roles">Roles</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/app">Volver</Link>
        </Button>
      </nav>
    </header>
  );
}
