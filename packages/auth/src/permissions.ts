import { ADMIN_ROLE } from "./roles";

// Catálogo de permisos. Vive en código y no en la base: un permiso solo significa algo si
// un guard lo revisa (requirePermission / requirePermissionApi / hasPermission). Los
// roles, en cambio, son datos: se crean y editan en /admin/roles.
//
// Para agregar uno: una entrada aquí + el guard que lo exige. `implies` arrastra otros
// permisos al guardar un rol (gestionar usuarios sin poder verlos no tiene sentido).
export const PERMISSIONS = {
  "users.view": {
    label: "Ver usuarios",
    description: "Entrar a la lista de usuarios.",
    implies: [],
  },
  "users.manage": {
    label: "Gestionar usuarios",
    description: "Cambiar el rol de otros usuarios y suspender o reactivar cuentas.",
    implies: ["users.view"],
  },
  "roles.manage": {
    label: "Gestionar roles",
    description: "Crear, editar y borrar roles y decidir qué permisos tiene cada uno.",
    implies: [],
  },
} as const satisfies Record<string, { label: string; description: string; implies: readonly string[] }>;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && Object.hasOwn(PERMISSIONS, value);
}

// Normaliza una lista: descarta lo desconocido, agrega lo implícito y respeta el orden
// del catálogo (así comparar o mostrar dos listas es estable).
export function normalizePermissions(values: readonly unknown[]): Permission[] {
  const set = new Set<Permission>();
  const add = (p: Permission) => {
    if (set.has(p)) return;
    set.add(p);
    PERMISSIONS[p].implies.forEach(add);
  };
  values.filter(isPermission).forEach(add);
  return ALL_PERMISSIONS.filter((p) => set.has(p));
}

// Permisos efectivos de un rol. admin los tiene todos por código, no por filas en la base:
// así nadie lo deja sin permisos y un permiso nuevo le llega sin migrar datos.
export function resolvePermissions(roleKey: string, stored: readonly string[]): Permission[] {
  return roleKey === ADMIN_ROLE ? [...ALL_PERMISSIONS] : normalizePermissions(stored);
}

export function hasPermission(
  user: { permissions: readonly Permission[] } | null | undefined,
  permission: Permission,
): boolean {
  return !!user?.permissions.includes(permission);
}

// Regla anti-escalada: solo se otorga (o se toca a quien tiene) lo que uno mismo tiene.
export function includesAll(granted: readonly Permission[], required: readonly Permission[]): boolean {
  return required.every((p) => granted.includes(p));
}
