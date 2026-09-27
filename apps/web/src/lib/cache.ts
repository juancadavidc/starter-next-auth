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

export function invalidate(tag: string): void {
  revalidateTag(tag, "max");
}
