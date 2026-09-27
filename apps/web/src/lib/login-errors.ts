// Copy de los errores de login, compartido por la página (?error=...) y los botones
// (error devuelto por Better Auth). Sin imports de servidor: lo usa un módulo cliente.
export const BANNED_MESSAGE = "Tu cuenta está suspendida. Escríbenos si crees que es un error.";

// "banned": lo pone el guard de página. "BANNED_USER": el código del plugin admin de
// Better Auth, tanto en el login por correo como en el callback de Google (?error=).
const BANNED_CODES = new Set(["banned", "BANNED_USER"]);

export function isBannedError(code: string | undefined): boolean {
  return code !== undefined && BANNED_CODES.has(code);
}

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  if (isBannedError(code)) return BANNED_MESSAGE;
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}
