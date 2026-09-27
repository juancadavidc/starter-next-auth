import "server-only";
import { redirect } from "next/navigation";
import { decideAccess, type Requirement, type SessionUser } from "./access";
import { ApiError } from "./api-error";
import { getSessionUser } from "./session";

// Guards de página: cada page.tsx protegida llama al suyo. Los layouts no protegen nada.
async function requirePage(requirement: Requirement, currentPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  const decision = decideAccess(user, requirement, currentPath);
  if (!decision.ok) redirect(decision.redirectTo);
  return user!;
}

export const requireUser = (currentPath?: string) => requirePage("user", currentPath);
export const requireCompletedProfile = (currentPath?: string) =>
  requirePage("completed-profile", currentPath);
export const requireAdmin = (currentPath?: string) => requirePage("admin", currentPath);

// Guard de route handlers y server actions: lanza ApiError(401|403).
export async function requireApi(requirement: Requirement): Promise<SessionUser> {
  const user = await getSessionUser();
  const decision = decideAccess(user, requirement);
  if (!decision.ok) {
    throw new ApiError(decision.status === 401 ? "No autenticado" : "Acceso denegado", decision.status);
  }
  return user!;
}

// Mismos requisitos que requireUser/requireAdmin: requireUserApi no exige perfil completo
// (lo usa la server action del onboarding); requireAdminApi sí.
export const requireUserApi = () => requireApi("user");
export const requireAdminApi = () => requireApi("admin");
