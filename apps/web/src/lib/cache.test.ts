import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { CACHE_TAGS, invalidate } from "./cache";

describe("invalidate", () => {
  it("expires the tag immediately (not stale-while-revalidate)", () => {
    invalidate(CACHE_TAGS.users);
    expect(vi.mocked(revalidateTag)).toHaveBeenCalledWith("users", { expire: 0 });
  });
});
