import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Holland RIASEC interest profile, each score 0-1.
export type Riasec = { R: number; I: number; A: number; S: number; E: number; C: number };

export const ROLE_OUTLOOKS = ["emerging", "declining"] as const;
export const AI_EXPOSURE_LEVELS = ["low", "medium", "high"] as const;
export const COURSE_COSTS = ["free", "low", "hrdc_claimable"] as const;
export const SIGNAL_SOURCE_TYPES = ["report", "news", "dataset", "research"] as const;
export const SIGNAL_DIRECTIONS = ["emerging", "declining"] as const;

const emptyIntArray = sql`'{}'::integer[]`;
const emptyTextArray = sql`'{}'::text[]`;

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sdgIds: integer("sdg_ids").array().notNull().default(emptyIntArray),
  sdgReason: text("sdg_reason").notNull(),
});

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  sector: text("sector").notNull(),
  outlook: text("outlook", { enum: ROLE_OUTLOOKS }).notNull(),
  // Coarse team classification of how much AI changes the role's tasks (informed by
  // ILO WP140 and the Anthropic Economic Index). Scenario multipliers act on this.
  aiExposure: text("ai_exposure", { enum: AI_EXPOSURE_LEVELS }).notNull(),
  sdgIds: integer("sdg_ids").array().notNull().default(emptyIntArray),
  sdgTargets: text("sdg_targets").array().notNull().default(emptyTextArray),
  sdgReason: text("sdg_reason").notNull(),
  riasec: jsonb("riasec").$type<Riasec>(),
  riasecCode: text("riasec_code"),
  riasecSource: text("riasec_source"),
  // Where the role itself comes from (e.g. WEF Future of Jobs 2025, Figure 2.2).
  sourceName: text("source_name").notNull(),
  sourceUrl: text("source_url").notNull(),
});

export const roleSkills = pgTable(
  "role_skills",
  {
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    importance: smallint("importance").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.skillId] }),
    check("role_skills_importance_range", sql`${t.importance} between 1 and 3`),
  ],
);

// Curated catalog: the ONLY place pathways may draw courses from.
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  provider: text("provider").notNull(),
  url: text("url").notNull(),
  cost: text("cost", { enum: COURSE_COSTS }).notNull(),
  hours: integer("hours").notNull(),
  language: text("language").notNull(),
  skillIds: integer("skill_ids").array().notNull().default(emptyIntArray),
  verifiedAt: date("verified_at", { mode: "string" }),
});

export const signals = pgTable(
  "signals",
  {
    id: serial("id").primaryKey(),
    // Stable key for upserts: a slug for curated seed signals, the feed GUID/URL for RSS items.
    externalId: text("external_id").notNull().unique(),
    title: text("title").notNull(),
    sourceName: text("source_name").notNull(),
    sourceType: text("source_type", { enum: SIGNAL_SOURCE_TYPES }).notNull(),
    url: text("url").notNull(),
    publishedDate: date("published_date", { mode: "string" }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    summary: text("summary").notNull(),
    direction: text("direction", { enum: SIGNAL_DIRECTIONS }).notNull(),
    strength: smallint("strength").notNull(),
    roleIds: integer("role_ids").array().notNull().default(emptyIntArray),
    skillIds: integer("skill_ids").array().notNull().default(emptyIntArray),
  },
  (t) => [
    check("signals_strength_range", sql`${t.strength} between 1 and 5`),
    index("signals_published_date_idx").on(t.publishedDate),
  ],
);

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  aiAdoptionMultiplier: real("ai_adoption_multiplier").notNull(),
  notes: text("notes").notNull(),
});

// Normalized profile produced by extraction (or a synthetic sample).
// Never contains age, gender, ethnicity, religion or location of origin.
export type ExtractedProfile = {
  displayName: string;
  headline: string;
  summary: string;
  yearsExperience: number;
  education: string[];
  languages: string[];
  skills: { slug: string; level: 1 | 2 | 3; evidence: string }[];
  goals: string[];
  hoursPerWeek: number;
  budget: "free" | "low" | "hrdc_claimable";
};

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Set only for the synthetic sample profiles, so re-seeding updates them in place.
  sampleKey: text("sample_key").unique(),
  rawInput: text("raw_input").notNull(),
  extractedJson: jsonb("extracted_json").$type<ExtractedProfile>().notNull(),
  riasec: jsonb("riasec").$type<Riasec>(),
  isSample: boolean("is_sample").notNull().default(false),
});

export const rankingSnapshots = pgTable(
  "ranking_snapshots",
  {
    id: serial("id").primaryKey(),
    profileId: integer("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    scenarioKey: text("scenario_key").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    signalsVersion: text("signals_version").notNull(),
    ranking: jsonb("ranking").notNull(),
  },
  (t) => [index("ranking_snapshots_lookup_idx").on(t.profileId, t.scenarioKey, t.computedAt)],
);
