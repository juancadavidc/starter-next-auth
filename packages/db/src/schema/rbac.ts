// Roles dinámicos: se crean y editan desde /admin/roles. El catálogo de permisos vive en
// código (packages/auth/src/permissions.ts) porque cada permiso solo existe si algún
// guard lo revisa; aquí solo se guarda qué rol tiene cuál.
import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const role = pgTable("role", {
  // Clave estable ("admin", "soporte"): es lo que guarda user.role. No se renombra.
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  // Roles del sistema (admin, user): no se borran. admin además no se edita.
  system: boolean("system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rolePermission = pgTable(
  "role_permission",
  {
    roleKey: text("role_key")
      .notNull()
      .references(() => role.key, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (table) => [primaryKey({ columns: [table.roleKey, table.permission] })],
);
