import type { Metadata } from "next";
import { requirePermission } from "@repo/auth/guards";
import { AdminNav } from "../../admin-nav";
import { createRoleAction } from "../actions";
import { RoleForm } from "../role-form";

export const metadata: Metadata = { title: "Nuevo rol" };

export default async function NewRolePage() {
  const actor = await requirePermission("roles.manage", "/admin/roles/new");
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <AdminNav user={actor} title="Nuevo rol" />
      <RoleForm action={createRoleAction} grantable={actor.permissions} />
    </main>
  );
}
