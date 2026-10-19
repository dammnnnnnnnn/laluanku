import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  AI_EXPOSURE_LEVELS,
  COURSE_COSTS,
  ROLE_OUTLOOKS,
  SIGNAL_DIRECTIONS,
  SIGNAL_SOURCE_TYPES,
  courses,
  profiles,
  roleSkills,
  roles,
  scenarios,
  signals,
  skills,
} from "./schema";
import type { AnyDb } from "./types";

// Date the team last checked every curated source URL, date and figure in seed/signals.json.
const SOURCES_VERIFIED_AT = new Date("2026-10-20T00:00:00+08:00");
// Date the team last checked every course URL, cost and duration in seed/courses.json.
const COURSES_VERIFIED_AT = "2026-10-20";

const slug = z.string().regex(/^[a-z0-9-]+$/);
const sdgIds = z.array(z.number().int().min(1).max(17)).min(1, "every role and skill needs at least one SDG");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const unit = z.number().min(0).max(1);

const SkillSeed = z.object({
  slug,
  name: z.string().min(1),
  category: z.string().min(1),
  sdg_ids: sdgIds,
  sdg_reason: z.string().min(10),
});

const RoleSeed = z.object({
  slug,
  title: z.string().min(1),
  description: z.string().min(10),
  sector: z.string().min(1),
  outlook: z.enum(ROLE_OUTLOOKS),
  ai_exposure: z.enum(AI_EXPOSURE_LEVELS),
  sdg_ids: sdgIds,
  sdg_targets: z.array(z.string().regex(/^\d{1,2}\.[0-9a-z]+$/)).min(1),
  sdg_reason: z.string().min(10),
  source_name: z.string().min(1),
  source_url: z.url(),
  riasec: z.object({ R: unit, I: unit, A: unit, S: unit, E: unit, C: unit }),
  riasec_code: z.string().regex(/^[RIASEC]{1,3}$/),
  riasec_source: z.string().min(10),
  skills: z.record(slug, z.number().int().min(1).max(3)),
});

const SignalSeed = z.object({
  external_id: slug,
  title: z.string().min(1),
  source_name: z.string().min(1),
  source_type: z.enum(SIGNAL_SOURCE_TYPES),
  url: z.url(),
  published_date: isoDate,
  summary: z.string().min(20),
  direction: z.enum(SIGNAL_DIRECTIONS),
  strength: z.number().int().min(1).max(5),
  roles: z.array(slug),
  skills: z.array(slug),
});

const ScenarioSeed = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1),
  description: z.string().min(1),
  ai_adoption_multiplier: z.number().positive(),
  notes: z.string().min(1),
});

const ProfileSeed = z.object({
  sample_key: slug,
  raw_input: z.string().startsWith("SYNTHETIC SAMPLE PROFILE"),
  extracted_json: z.object({
    displayName: z.string().min(1),
    headline: z.string().min(1),
    summary: z.string().min(1),
    yearsExperience: z.number().min(0),
    education: z.array(z.string()),
    languages: z.array(z.string()),
    skills: z.array(z.object({ slug, level: z.union([z.literal(1), z.literal(2), z.literal(3)]), evidence: z.string() })).min(1),
    goals: z.array(z.string()),
    hoursPerWeek: z.number().int().positive(),
    budget: z.enum(COURSE_COSTS),
  }),
});

const seedDir = path.join(process.cwd(), "seed");

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(path.join(seedDir, file), "utf8"));
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) throw new Error(`Duplicate ${label}: ${v}`);
    seen.add(v);
  }
}

function assertKnown(refs: string[], known: Set<string>, where: string) {
  for (const ref of refs) {
    if (!known.has(ref)) throw new Error(`${where} references unknown slug "${ref}"`);
  }
}

const CourseSeed = z.object({
  slug,
  title: z.string().min(1),
  provider: z.string().min(1),
  url: z.url(),
  cost: z.enum(COURSE_COSTS),
  hours: z.number().int().positive(),
  hours_estimated: z.boolean(),
  language: z.enum(["en", "ms"]),
  skills: z.array(slug).min(1),
  requires: z.array(slug),
  notes: z.string(),
});

/** Parses and cross-checks every seed file. Throws on the first problem. */
export function loadSeedData() {
  const skillRows = z.array(SkillSeed).parse(readJson("skills.json"));
  const roleRows = z.array(RoleSeed).parse(readJson("roles.json"));
  const signalRows = z.array(SignalSeed).parse(readJson("signals.json"));
  const scenarioRows = z.array(ScenarioSeed).parse(readJson("scenarios.json"));
  const courseRows = z.array(CourseSeed).parse(readJson("courses.json"));
  const profileRows = readdirSync(path.join(seedDir, "profiles"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => ProfileSeed.parse(readJson(path.join("profiles", f))));

  assertUnique(skillRows.map((s) => s.slug), "skill slug");
  assertUnique(roleRows.map((r) => r.slug), "role slug");
  assertUnique(signalRows.map((s) => s.external_id), "signal external_id");
  assertUnique(scenarioRows.map((s) => s.key), "scenario key");
  assertUnique(profileRows.map((p) => p.sample_key), "profile sample_key");
  assertUnique(courseRows.map((c) => c.slug), "course slug");
  assertUnique(courseRows.map((c) => c.url), "course url");

  const skillSlugs = new Set(skillRows.map((s) => s.slug));
  const roleSlugs = new Set(roleRows.map((r) => r.slug));
  for (const r of roleRows) assertKnown(Object.keys(r.skills), skillSlugs, `role ${r.slug}`);
  for (const s of signalRows) {
    assertKnown(s.roles, roleSlugs, `signal ${s.external_id}`);
    assertKnown(s.skills, skillSlugs, `signal ${s.external_id}`);
  }
  for (const p of profileRows) {
    assertKnown(p.extracted_json.skills.map((s) => s.slug), skillSlugs, `profile ${p.sample_key}`);
  }
  for (const c of courseRows) assertKnown([...c.skills, ...c.requires], skillSlugs, `course ${c.slug}`);
  for (const key of ["moderate_2030", "fast_ai_2030"]) {
    if (!scenarioRows.some((s) => s.key === key)) throw new Error(`Missing required scenario ${key}`);
  }

  return { skillRows, roleRows, signalRows, scenarioRows, profileRows, courseRows };
}

const excluded = (column: string) => sql.raw(`excluded.${column}`);

/** Idempotent: upserts by slug / key, so re-running updates rows and keeps RSS-ingested signals. */
export async function runSeed(db: AnyDb) {
  const data = loadSeedData();

  return db.transaction(async (tx) => {
    await tx
      .insert(skills)
      .values(
        data.skillRows.map((s) => ({
          slug: s.slug,
          name: s.name,
          category: s.category,
          sdgIds: s.sdg_ids,
          sdgReason: s.sdg_reason,
        })),
      )
      .onConflictDoUpdate({
        target: skills.slug,
        set: {
          name: excluded("name"),
          category: excluded("category"),
          sdgIds: excluded("sdg_ids"),
          sdgReason: excluded("sdg_reason"),
        },
      });

    await tx
      .insert(roles)
      .values(
        data.roleRows.map((r) => ({
          slug: r.slug,
          title: r.title,
          description: r.description,
          sector: r.sector,
          outlook: r.outlook,
          aiExposure: r.ai_exposure,
          sdgIds: r.sdg_ids,
          sdgTargets: r.sdg_targets,
          sdgReason: r.sdg_reason,
          sourceName: r.source_name,
          sourceUrl: r.source_url,
          riasec: r.riasec,
          riasecCode: r.riasec_code,
          riasecSource: r.riasec_source,
        })),
      )
      .onConflictDoUpdate({
        target: roles.slug,
        set: {
          title: excluded("title"),
          description: excluded("description"),
          sector: excluded("sector"),
          outlook: excluded("outlook"),
          aiExposure: excluded("ai_exposure"),
          sdgIds: excluded("sdg_ids"),
          sdgTargets: excluded("sdg_targets"),
          sdgReason: excluded("sdg_reason"),
          sourceName: excluded("source_name"),
          sourceUrl: excluded("source_url"),
          riasec: excluded("riasec"),
          riasecCode: excluded("riasec_code"),
          riasecSource: excluded("riasec_source"),
        },
      });

    const skillId = new Map(
      (await tx.select({ id: skills.id, slug: skills.slug }).from(skills)).map((s) => [s.slug, s.id]),
    );
    const roleId = new Map(
      (await tx.select({ id: roles.id, slug: roles.slug }).from(roles)).map((r) => [r.slug, r.id]),
    );
    const idOf = (map: Map<string, number>, key: string) => {
      const id = map.get(key);
      if (id === undefined) throw new Error(`No id for slug ${key}`);
      return id;
    };

    const seededRoleIds = data.roleRows.map((r) => idOf(roleId, r.slug));
    await tx.delete(roleSkills).where(inArray(roleSkills.roleId, seededRoleIds));
    await tx.insert(roleSkills).values(
      data.roleRows.flatMap((r) =>
        Object.entries(r.skills).map(([skill, importance]) => ({
          roleId: idOf(roleId, r.slug),
          skillId: idOf(skillId, skill),
          importance,
        })),
      ),
    );

    await tx
      .insert(signals)
      .values(
        data.signalRows.map((s) => ({
          externalId: s.external_id,
          title: s.title,
          sourceName: s.source_name,
          sourceType: s.source_type,
          url: s.url,
          publishedDate: s.published_date,
          fetchedAt: SOURCES_VERIFIED_AT,
          summary: s.summary,
          direction: s.direction,
          strength: s.strength,
          roleIds: s.roles.map((slug) => idOf(roleId, slug)),
          skillIds: s.skills.map((slug) => idOf(skillId, slug)),
        })),
      )
      .onConflictDoUpdate({
        target: signals.externalId,
        set: {
          title: excluded("title"),
          sourceName: excluded("source_name"),
          sourceType: excluded("source_type"),
          url: excluded("url"),
          publishedDate: excluded("published_date"),
          fetchedAt: excluded("fetched_at"),
          summary: excluded("summary"),
          direction: excluded("direction"),
          strength: excluded("strength"),
          roleIds: excluded("role_ids"),
          skillIds: excluded("skill_ids"),
        },
      });

    await tx
      .insert(scenarios)
      .values(
        data.scenarioRows.map((s) => ({
          key: s.key,
          name: s.name,
          description: s.description,
          aiAdoptionMultiplier: s.ai_adoption_multiplier,
          notes: s.notes,
        })),
      )
      .onConflictDoUpdate({
        target: scenarios.key,
        set: {
          name: excluded("name"),
          description: excluded("description"),
          aiAdoptionMultiplier: excluded("ai_adoption_multiplier"),
          notes: excluded("notes"),
        },
      });

    await tx
      .insert(profiles)
      .values(
        data.profileRows.map((p) => ({
          sampleKey: p.sample_key,
          rawInput: p.raw_input,
          extractedJson: p.extracted_json,
          isSample: true,
        })),
      )
      .onConflictDoUpdate({
        target: profiles.sampleKey,
        set: { rawInput: excluded("raw_input"), extractedJson: excluded("extracted_json"), isSample: sql`true` },
      });

    await tx
      .insert(courses)
      .values(
        data.courseRows.map((c) => ({
          slug: c.slug,
          title: c.title,
          provider: c.provider,
          url: c.url,
          cost: c.cost,
          hours: c.hours,
          hoursEstimated: c.hours_estimated,
          language: c.language,
          skillIds: c.skills.map((s) => idOf(skillId, s)),
          requiresSkillIds: c.requires.map((s) => idOf(skillId, s)),
          notes: c.notes,
          verifiedAt: COURSES_VERIFIED_AT,
        })),
      )
      .onConflictDoUpdate({
        target: courses.slug,
        set: {
          title: excluded("title"),
          provider: excluded("provider"),
          url: excluded("url"),
          cost: excluded("cost"),
          hours: excluded("hours"),
          hoursEstimated: excluded("hours_estimated"),
          language: excluded("language"),
          skillIds: excluded("skill_ids"),
          requiresSkillIds: excluded("requires_skill_ids"),
          notes: excluded("notes"),
          verifiedAt: excluded("verified_at"),
        },
      });

    return {
      skills: data.skillRows.length,
      roles: data.roleRows.length,
      roleSkills: data.roleRows.reduce((n, r) => n + Object.keys(r.skills).length, 0),
      signals: data.signalRows.length,
      scenarios: data.scenarioRows.length,
      profiles: data.profileRows.length,
      courses: data.courseRows.length,
    };
  });
}
