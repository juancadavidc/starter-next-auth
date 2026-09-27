import { isRole, type Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
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

// Único punto que traduce el usuario de Better Auth a SessionUser. Ante valores
// ausentes o desconocidos elige lo más restrictivo: rol "user", perfil incompleto.
export function toSessionUser(u: AuthUserLike): SessionUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role: isRole(u.role) ? u.role : "user",
    banned: Boolean(u.banned),
    profileCompleted: Boolean(u.profileCompleted),
  };
}

export type Requirement = "user" | "completed-profile" | "admin";

export type AccessDecision = { ok: true } | { ok: false; status: 401 | 403; redirectTo: string };

// Decisión pura de acceso: la usan tanto los guards de página (redirect) como los de API
// (ApiError). El orden importa: sesión → baneo → perfil → rol.
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
  if (requirement === "admin" && user.role !== "admin") {
    return { ok: false, status: 403, redirectTo: "/app" };
  }
  return { ok: true };
}
