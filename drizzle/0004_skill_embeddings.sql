CREATE TABLE "skill_embeddings" (
	"skill_id" integer NOT NULL,
	"model" text NOT NULL,
	"text_hash" text NOT NULL,
	"embedding" real[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_embeddings_skill_id_model_pk" PRIMARY KEY("skill_id","model")
);
--> statement-breakpoint
ALTER TABLE "skill_embeddings" ADD CONSTRAINT "skill_embeddings_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;