import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@repo/auth/guards";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { listUsers } from "@/lib/admin-users";
import { changeBan, changeRole } from "./actions";
import { RowActionForm } from "./row-action-form";

export const metadata: Metadata = { title: "Usuarios" };

export default async function AdminUsersPage() {
  const actor = await requireAdmin("/admin/users");
  const users = await listUsers();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <Button asChild variant="ghost">
          <Link href="/app">Volver</Link>
        </Button>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            // La fila propia se deshabilita en la UI; la regla real está en assertCanManage.
            const self = u.id === actor.id;
            return (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>{u.banned ? "Suspendido" : "Activo"}</TableCell>
                <TableCell className="flex justify-end gap-2">
                  <RowActionForm action={changeRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="role" value={u.role === "admin" ? "user" : "admin"} />
                    <Button size="sm" variant="outline" disabled={self}>
                      {u.role === "admin" ? "Quitar admin" : "Hacer admin"}
                    </Button>
                  </RowActionForm>
                  <RowActionForm action={changeBan}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="banned" value={u.banned ? "false" : "true"} />
                    <Button size="sm" variant={u.banned ? "outline" : "destructive"} disabled={self}>
                      {u.banned ? "Reactivar" : "Suspender"}
                    </Button>
                  </RowActionForm>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}
