import { db } from "@repo/db";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as dbHealth } from "./db/route";
import { GET as liveness } from "./route";

describe("health endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("liveness answers without touching the database", async () => {
    const res = liveness();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("db health confirms the migrated schema", async () => {
    const res = await dbHealth();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("db health answers 503 when the database query fails", async () => {
    vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("connection refused"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await dbHealth();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "error" });
  });
});
