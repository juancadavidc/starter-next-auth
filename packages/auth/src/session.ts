import "server-only";
import { headers } from "next/headers";
import { toSessionUser, type SessionUser } from "./access";
import { auth } from "./server";

// Usuario de la sesión actual, con los campos que usan los guards y la UI.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? toSessionUser(session.user) : null;
}
