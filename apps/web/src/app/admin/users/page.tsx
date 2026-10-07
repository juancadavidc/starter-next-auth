import type { Metadata } from "next";
import { requirePermission } from "@repo/auth/guards";
import { hasPermission } from "@repo/auth/permissions";
import { listRoles } from "@repo/auth/role-store";
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
import { AdminNav } from "../admin-nav";
import { changeBan, changeRole } from "./actions";
import { RowActionForm } from "../row-action-form";

export const metadata: Metadata = { title: "Usuarios" };

export default async function AdminUsersPage() {
  const actor = await requirePermission("users.view", "/admin/users");
  const canManage = hasPermission(actor, "users.manage");
  const [users, roles] = await Promise.all([listUsers(), canManage ? listRoles() : []]);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <AdminNav user={actor} title="Usuarios" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Estado</TableHead>
            {canManage && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => {
            // La fila propia se deshabilita en la UI; las reglas reales (incluida la
            // anti-escalada) están en lib/admin-users.ts.
            const self = u.id === actor.id;
            return (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {canManage && !self ? (
                    <RowActionForm action={changeRole} align="start">
                      <input type="hidden" name="userId" value={u.id} />
                      <div className="flex items-center gap-2">
                        {/* key: React resetea el form tras la action; con el rol como key el
                            select se remonta con el valor guardado y no con el anterior. */}
                        <select
                          key={u.role}
                          name="role"
                          defaultValue={u.role}
                          aria-label={`Rol de ${u.name}`}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {roles.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant="outline">
                          Guardar
                        </Button>
                      </div>
                    </RowActionForm>
                  ) : (
                    u.roleName
                  )}
                </TableCell>
                <TableCell>{u.banned ? "Suspendido" : "Activo"}</TableCell>
                {canManage && (
                  <TableCell>
                    {/* display:flex va en un div: sobre el <td> rompe el layout de la tabla. */}
                    <div className="flex justify-end">
                      <RowActionForm action={changeBan}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="banned" value={u.banned ? "false" : "true"} />
                        <Button size="sm" variant={u.banned ? "outline" : "destructive"} disabled={self}>
                          {u.banned ? "Reactivar" : "Suspender"}
                        </Button>
                      </RowActionForm>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}
