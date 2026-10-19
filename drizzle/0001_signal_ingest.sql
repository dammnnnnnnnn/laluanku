CREATE TABLE "feed_items" (
	"external_id" text PRIMARY KEY NOT NULL,
	"feed_key" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"published_date" date,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"signal_id" integer,
	"run_id" integer
);
--> statement-breakpoint
CREATE TABLE "signal_refresh_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"tagger" text,
	"model" text,
	"feeds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked" integer DEFAULT 0 NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "tagged_by" text DEFAULT 'curated' NOT NULL;--> statement-breakpoint
ALTER TABLE "signals" ADD COLUMN "feed_key" text;--> statement-breakpoint
ALTER TABLE "feed_items" ADD CONSTRAINT "feed_items_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feed_items_seen_at_idx" ON "feed_items" USING btree ("seen_at");