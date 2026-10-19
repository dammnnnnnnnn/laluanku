CREATE TABLE "courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"provider" text NOT NULL,
	"url" text NOT NULL,
	"cost" text NOT NULL,
	"hours" integer NOT NULL,
	"language" text NOT NULL,
	"skill_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"verified_at" date
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sample_key" text,
	"raw_input" text NOT NULL,
	"extracted_json" jsonb NOT NULL,
	"riasec" jsonb,
	"is_sample" boolean DEFAULT false NOT NULL,
	CONSTRAINT "profiles_sample_key_unique" UNIQUE("sample_key")
);
--> statement-breakpoint
CREATE TABLE "ranking_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"scenario_key" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"signals_version" text NOT NULL,
	"ranking" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_skills" (
	"role_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	"importance" smallint NOT NULL,
	CONSTRAINT "role_skills_role_id_skill_id_pk" PRIMARY KEY("role_id","skill_id"),
	CONSTRAINT "role_skills_importance_range" CHECK ("role_skills"."importance" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"sector" text NOT NULL,
	"outlook" text NOT NULL,
	"ai_exposure" text NOT NULL,
	"sdg_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"sdg_targets" text[] DEFAULT '{}'::text[] NOT NULL,
	"sdg_reason" text NOT NULL,
	"riasec" jsonb,
	"riasec_code" text,
	"riasec_source" text,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	CONSTRAINT "roles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"ai_adoption_multiplier" real NOT NULL,
	"notes" text NOT NULL,
	CONSTRAINT "scenarios_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"source_name" text NOT NULL,
	"source_type" text NOT NULL,
	"url" text NOT NULL,
	"published_date" date NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text NOT NULL,
	"direction" text NOT NULL,
	"strength" smallint NOT NULL,
	"role_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"skill_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	CONSTRAINT "signals_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "signals_strength_range" CHECK ("signals"."strength" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"sdg_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"sdg_reason" text NOT NULL,
	CONSTRAINT "skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "ranking_snapshots" ADD CONSTRAINT "ranking_snapshots_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_skills" ADD CONSTRAINT "role_skills_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_skills" ADD CONSTRAINT "role_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ranking_snapshots_lookup_idx" ON "ranking_snapshots" USING btree ("profile_id","scenario_key","computed_at");--> statement-breakpoint
CREATE INDEX "signals_published_date_idx" ON "signals" USING btree ("published_date");