import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@repo/auth/server";

export const { GET, POST } = toNextJsHandler(auth.handler);
