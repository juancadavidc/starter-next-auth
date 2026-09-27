// Tablas propias de la idea. Ejemplo:
//
// import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
// import { user } from "./auth";
//
// export const note = pgTable("note", {
//   id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
//   userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
//   body: text("body").notNull(),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
// });
//
// Después: `pnpm db:generate` y commit del SQL generado.
export {};
