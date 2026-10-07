import { resolvePermissions, type Permission } from "./permissions";
import { DEFAULT_ROLE } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: string;
  permissions: Permission[];
  banned: boolean;
  profileCompleted: boolean;
};

// Forma mínima del usuario de Better Auth (núcleo + plugin admin + profileCompleted).
export type AuthUserLike = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  profileCompleted?: boolean | null;
};

// Único punto que traduce el usuario de Better Auth a SessionUser. `storedPermissions` son
// las filas de role_permission de su rol (las lee session.ts). Ante valores ausentes o
// desconocidos elige lo más restrictivo: rol por defecto, sin permisos, perfil incompleto.
export function toSessionUser(u: AuthUserLike, storedPermissions: readonly string[] = []): SessionUser {
  const role = u.role || DEFAULT_ROLE;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role,
    permissions: resolvePermissions(role, storedPermissions),
    banned: Boolean(u.banned),
    profileCompleted: Boolean(u.profileCompleted),
  };
}

export type Requirement = "user" | "completed-profile" | { permission: Permission };

export type AccessDecision = { ok: true } | { ok: false; status: 401 | 403; redirectTo: string };

// Decisión pura de acceso: la usan tanto los guards de página (redirect) como los de API
// (ApiError). El orden importa: sesión → baneo → perfil → permiso.
export function decideAccess(
  user: SessionUser | null,
  requirement: Requirement,
  currentPath?: string,
): AccessDecision {
  if (!user) {
    const redirectTo = currentPath ? `/login?next=${encodeURIComponent(currentPath)}` : "/login";
    return { ok: false, status: 401, redirectTo };
  }
  if (user.banned) return { ok: false, status: 403, redirectTo: "/login?error=banned" };
  if (requirement === "user") return { ok: true };
  if (!user.profileCompleted) return { ok: false, status: 403, redirectTo: "/onboarding" };
  if (typeof requirement === "object" && !user.permissions.includes(requirement.permission)) {
    return { ok: false, status: 403, redirectTo: "/app" };
  }
  return { ok: true };
}
