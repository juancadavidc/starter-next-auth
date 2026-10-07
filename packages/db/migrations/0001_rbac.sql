CREATE TABLE "role" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_key" text NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permission_role_key_permission_pk" PRIMARY KEY("role_key","permission")
);
--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_key_role_key_fk" FOREIGN KEY ("role_key") REFERENCES "public"."role"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Roles del sistema: deben existir antes de la FK de user.role. admin no guarda permisos
-- (los tiene todos, por código); user arranca sin permisos de administración.
INSERT INTO "role" ("key", "name", "description", "system") VALUES
	('admin', 'Administrador', 'Acceso total. No se puede editar ni borrar.', true),
	('user', 'Usuario', 'Rol por defecto de toda cuenta nueva.', true)
ON CONFLICT ("key") DO NOTHING;--> statement-breakpoint
-- Cualquier valor fuera de los roles conocidos cae al rol más restrictivo.
UPDATE "user" SET "role" = 'user' WHERE "role" NOT IN ('admin', 'user');--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_role_key_fk" FOREIGN KEY ("role") REFERENCES "public"."role"("key") ON DELETE restrict ON UPDATE no action;