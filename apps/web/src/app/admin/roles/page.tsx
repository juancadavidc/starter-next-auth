import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@repo/auth/guards";
import { PERMISSIONS } from "@repo/auth/permissions";
import { ADMIN_ROLE } from "@repo/auth/roles";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { canEditRole, listRolesWithUsage } from "@/lib/admin-roles";
import { AdminNav } from "../admin-nav";
import { RowActionForm } from "../row-action-form";
import { deleteRoleAction } from "./actions";

export const metadata: Metadata = { title: "Roles" };

export default async function AdminRolesPage() {
  const actor = await requirePermission("roles.manage", "/admin/roles");
  const roles = await listRolesWithUsage();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <AdminNav user={actor} title="Roles y permisos" />
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Cada usuario tiene un rol; el rol define qué puede hacer. Los cambios aplican en el acto.
        </p>
        <Button asChild>
          <Link href="/admin/roles/new">Nuevo rol</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rol</TableHead>
            <TableHead>Permisos</TableHead>
            <TableHead className="text-right">Usuarios</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((r) => {
            // Solo esconde botones: la regla que manda está en lib/admin-roles.ts.
            const editable = canEditRole(actor, r);
            return (
              <TableRow key={r.key}>
                <TableCell className="whitespace-normal">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.key}
                    {r.system && " · sistema"}
                    {r.description && ` · ${r.description}`}
                  </div>
                </TableCell>
                <TableCell className="whitespace-normal text-sm">
                  {r.key === ADMIN_ROLE
                    ? "Todos"
                    : r.permissions.map((p) => PERMISSIONS[p].label).join(", ") || "Ninguno"}
                </TableCell>
                <TableCell className="text-right">{r.userCount}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {editable && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/roles/${r.key}`}>Editar</Link>
                      </Button>
                    )}
                    {editable && !r.system && (
                      <RowActionForm action={deleteRoleAction}>
                        <input type="hidden" name="key" value={r.key} />
                        <Button size="sm" variant="destructive" disabled={r.userCount > 0}>
                          Borrar
                        </Button>
                      </RowActionForm>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </main>
  );
}
