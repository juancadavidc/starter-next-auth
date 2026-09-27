import { vi } from "vitest";

// `server-only` lanza fuera de un bundle de servidor de Next; en tests no aplica.
vi.mock("server-only", () => ({}));

// Fuera de un request de Next, `revalidateTag` lanza y `unstable_cache` no tiene almacén.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn(<T>(fn: T) => fn),
}));
