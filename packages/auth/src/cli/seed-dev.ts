import { loadRootEnv } from "@repo/db/root-env";

import { DEV_PASSWORD, DEV_ROLES, DEV_USERS, isDevLoginEnabled } from "../dev-login";

// El .env se carga antes de importar @repo/db y el servidor de auth (leen env al cargar).
loadRootEnv();

// Crea los roles y usuarios de desarrollo (idempotente). Nunca en producción: se comprueba antes
// de cargar el servidor de auth, que en producción exige las credenciales de Google.
if (!isDevLoginEnabled()) {
  console.error("db:seed:dev no corre con NODE_ENV=production.");
  process.exit(1);
}

const { db, eq, schema } = await import("@repo/db");
const { auth } = await import("../server");

for (const devRole of DEV_ROLES) {
  const { permissions, ...fields } = devRole;
  await db.insert(schema.role).values(fields).onConflictDoUpdate({ target: schema.role.key, set: fields });
  await db.delete(schema.rolePermission).where(eq(schema.rolePermission.roleKey, devRole.key));
  await db.insert(schema.rolePermission).values(permissions.map((permission) => ({ roleKey: devRole.key, permission })));
  console.log(`✓ rol ${devRole.key}: ${permissions.join(", ")}`);
}

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
