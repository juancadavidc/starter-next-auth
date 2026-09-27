import { revalidateTag, unstable_cache } from "next/cache";

// Todo el cacheo de datos de la app vive aquí. Las escrituras llaman a `invalidate` con el
// tag afectado. Las páginas que leen de la base son dinámicas, así `next build` no
// necesita Postgres.
export const CACHE_TAGS = {
  users: "users",
} as const;

export function cached<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  keyParts: string[],
  tags: string[],
): (...args: Args) => Promise<Result> {
  return unstable_cache(fn, keyParts, { tags });
}

// `{ expire: 0 }` expira el tag en el acto: la siguiente lectura ya ve el cambio (p. ej. un
// admin cambia un rol o banea y la tabla se re-renderiza con el valor nuevo). Con un
// perfil como "max" sería stale-while-revalidate y se vería el valor viejo una vez.
// Sirve igual en server actions y en route handlers (`updateTag` solo en actions).
export function invalidate(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}
