import { beforeEach, describe, expect, it, vi } from "vitest";
import { toSessionUser, type SessionUser } from "./access";
import { ApiError } from "./api-error";
import {
  requireApi,
  requireCompletedProfile,
  requirePermission,
  requirePermissionApi,
  requireUser,
  requireUserApi,
} from "./guards";
import { getSessionUser } from "./session";

vi.mock("./session", () => ({ getSessionUser: vi.fn() }));

// `redirect()` de Next lanza para cortar el render; aquí lanza un error reconocible.
class RedirectError extends Error {
  constructor(readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

const sessionUser = vi.mocked(getSessionUser);

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    ...toSessionUser({ id: "u1", email: "ana@example.test", name: "Ana" }),
    profileCompleted: true,
    ...overrides,
  };
}

const banned = user({ banned: true, role: "admin", permissions: ["users.view"] });
const incomplete = user({ profileCompleted: false });
const regular = user();
const viewer = user({ role: "soporte", permissions: ["users.view"] });

const requireUsersView = (path?: string) => requirePermission("users.view", path);
const requireUsersViewApi = () => requirePermissionApi("users.view");

beforeEach(() => {
  sessionUser.mockReset();
});

describe("page guards", () => {
  it.each([
    ["requireUser", requireUser],
    ["requireCompletedProfile", requireCompletedProfile],
    ["requirePermission", requireUsersView],
  ] as const)("%s sends anonymous users to login keeping the path", async (_, guard) => {
    sessionUser.mockResolvedValue(null);
    await expect(guard("/app/x")).rejects.toMatchObject({ url: "/login?next=%2Fapp%2Fx" });
  });

  it.each([
    ["requireUser", requireUser],
    ["requireCompletedProfile", requireCompletedProfile],
    ["requirePermission", requireUsersView],
  ] as const)("%s sends banned users with a live session to /login?error=banned", async (_, guard) => {
    sessionUser.mockResolvedValue(banned);
    await expect(guard()).rejects.toMatchObject({ url: "/login?error=banned" });
  });

  it("requireUser lets an incomplete profile through", async () => {
    sessionUser.mockResolvedValue(incomplete);
    await expect(requireUser()).resolves.toEqual(incomplete);
  });

  it.each([
    ["requireCompletedProfile", requireCompletedProfile],
    ["requirePermission", requireUsersView],
  ] as const)("%s sends incomplete profiles to onboarding", async (_, guard) => {
    sessionUser.mockResolvedValue({ ...incomplete, permissions: ["users.view"] });
    await expect(guard()).rejects.toMatchObject({ url: "/onboarding" });
  });

  it("requirePermission sends users without the permission to /app", async () => {
    sessionUser.mockResolvedValue(regular);
    await expect(requireUsersView()).rejects.toMatchObject({ url: "/app" });
    sessionUser.mockResolvedValue(viewer);
    await expect(requirePermission("roles.manage")).rejects.toMatchObject({ url: "/app" });
  });

  it("returns the user on the happy paths", async () => {
    sessionUser.mockResolvedValue(regular);
    await expect(requireUser()).resolves.toEqual(regular);
    await expect(requireCompletedProfile()).resolves.toEqual(regular);
    sessionUser.mockResolvedValue(viewer);
    await expect(requireUsersView()).resolves.toEqual(viewer);
  });
});

describe("API guards", () => {
  async function apiError(promise: Promise<unknown>): Promise<ApiError> {
    const error = await promise.then(
      () => {
        throw new Error("expected the guard to reject");
      },
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }

  it.each([
    ["requireUserApi", requireUserApi],
    ["requirePermissionApi", requireUsersViewApi],
  ] as const)("%s answers 401 without a session", async (_, guard) => {
    sessionUser.mockResolvedValue(null);
    expect(await apiError(guard())).toMatchObject({ status: 401, message: "No autenticado" });
  });

  it.each([
    ["requireUserApi", requireUserApi],
    ["requirePermissionApi", requireUsersViewApi],
  ] as const)("%s answers 403 to banned users with a live session", async (_, guard) => {
    sessionUser.mockResolvedValue(banned);
    expect(await apiError(guard())).toMatchObject({ status: 403, message: "Acceso denegado" });
  });

  it("requirePermissionApi answers 403 to incomplete profiles", async () => {
    sessionUser.mockResolvedValue({ ...incomplete, permissions: ["users.view"] });
    expect(await apiError(requireUsersViewApi())).toMatchObject({ status: 403 });
  });

  it("requireApi('completed-profile') answers 403 to incomplete profiles", async () => {
    sessionUser.mockResolvedValue(incomplete);
    expect(await apiError(requireApi("completed-profile"))).toMatchObject({ status: 403 });
  });

  it("requirePermissionApi answers 403 without the permission", async () => {
    sessionUser.mockResolvedValue(regular);
    expect(await apiError(requireUsersViewApi())).toMatchObject({ status: 403 });
  });

  // El onboarding (server action) usa requireUserApi: el perfil aún está incompleto.
  it("requireUserApi accepts an incomplete profile", async () => {
    sessionUser.mockResolvedValue(incomplete);
    await expect(requireUserApi()).resolves.toEqual(incomplete);
  });

  it("returns the user on the happy paths", async () => {
    sessionUser.mockResolvedValue(regular);
    await expect(requireUserApi()).resolves.toEqual(regular);
    sessionUser.mockResolvedValue(viewer);
    await expect(requireUsersViewApi()).resolves.toEqual(viewer);
  });
});
