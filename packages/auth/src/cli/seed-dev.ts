import { loadRootEnv } from "@repo/db/root-env";

import { DEV_PASSWORD, DEV_USERS, isDevLoginEnabled } from "../dev-login";

// El .env se carga antes de importar @repo/db y el servidor de auth (leen env al cargar).
loadRootEnv();

// Crea los usuarios de desarrollo (idempotente). Nunca en producción: se comprueba antes
// de cargar el servidor de auth, que en producción exige las credenciales de Google.
if (!isDevLoginEnabled()) {
  console.error("db:seed:dev no corre con NODE_ENV=production.");
  process.exit(1);
}

const { db, eq, schema } = await import("@repo/db");
const { auth } = await import("../server");

for (const devUser of DEV_USERS) {
  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, devUser.email));
  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: devUser.email, password: DEV_PASSWORD, name: devUser.name },
    });
  }
  await db
    .update(schema.user)
    .set({ role: devUser.role, profileCompleted: true, emailVerified: true })
    .where(eq(schema.user.email, devUser.email));
  console.log(`✓ ${devUser.email} (${devUser.role}) — clave: ${DEV_PASSWORD}`);
}
process.exit(0);
