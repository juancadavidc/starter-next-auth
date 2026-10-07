import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePermission } from "@repo/auth/guards";
import { getRole } from "@repo/auth/role-store";
import { canEditRole } from "@/lib/admin-roles";
import { AdminNav } from "../../admin-nav";
import { updateRoleAction } from "../actions";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "Editar rol" };

type Props = { params: Promise<{ key: string }> };

export default async function EditRolePage({ params }: Props) {
  const { key } = await params;
  const actor = await requirePermission("roles.manage", `/admin/roles/${key}`);
  const role = await getRole(key);
  if (!role) notFound();
  // Sin formulario para lo que la regla rechazaría igual (ver lib/admin-roles.ts).
  if (!canEditRole(actor, role)) redirect("/admin/roles");

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <AdminNav user={actor} title={`Editar rol: ${role.name}`} />
      <RoleForm action={updateRoleAction} role={role} grantable={actor.permissions} />
    </main>
  );
}
