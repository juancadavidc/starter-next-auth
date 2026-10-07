import "server-only";
import { headers } from "next/headers";
import { toSessionUser, type SessionUser } from "./access";
import { getStoredPermissions } from "./role-store";
import { auth } from "./server";

// Usuario de la sesión actual, con los campos que usan los guards y la UI. Los permisos se
// leen en cada request (como el baneo): editar un rol se nota en el acto, sin re-login.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return toSessionUser(session.user, await getStoredPermissions(session.user.role || ""));
}
