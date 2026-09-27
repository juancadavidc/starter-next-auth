import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Redirección optimista: si no hay cookie de sesión, ni siquiera se renderiza la página.
// NO es la barrera de seguridad (la cookie podría ser vieja o falsa): cada página llama
// a su guard de @repo/auth/guards.
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

// /onboarding no va aquí: lo protege el guard de su página (spec §3).
export const config = {
  matcher: ["/app/:path*", "/admin/:path*"],
};
