ALTER TABLE "profiles" ADD COLUMN "public_id" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_public_id_unique" UNIQUE("public_id");