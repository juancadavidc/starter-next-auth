import { describe, expect, it } from "vitest";
import { GET as dbHealth } from "./db/route";
import { GET as liveness } from "./route";

describe("health endpoints", () => {
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
});
