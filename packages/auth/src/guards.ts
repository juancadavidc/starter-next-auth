import "server-only";
import { redirect } from "next/navigation";
import { decideAccess, type Requirement, type SessionUser } from "./access";
import { ApiError } from "./api-error";
import type { Permission } from "./permissions";
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
// Exige perfil completo y el permiso (sale del rol del usuario; admin los tiene todos).
export const requirePermission = (permission: Permission, currentPath?: string) =>
  requirePage({ permission }, currentPath);

// Guard de route handlers y server actions: lanza ApiError(401|403).
export async function requireApi(requirement: Requirement): Promise<SessionUser> {
  const user = await getSessionUser();
  const decision = decideAccess(user, requirement);
  if (!decision.ok) {
    throw new ApiError(decision.status === 401 ? "No autenticado" : "Acceso denegado", decision.status);
  }
  return user!;
}

// Mismos requisitos que sus pares de página: requireUserApi no exige perfil completo
// (lo usa la server action del onboarding); requirePermissionApi sí.
export const requireUserApi = () => requireApi("user");
export const requirePermissionApi = (permission: Permission) => requireApi({ permission });
