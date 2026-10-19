import { asc, eq } from "drizzle-orm";
import { profiles, skills } from "../db/schema";
import type { AnyDb } from "../db/types";
import type { CatalogSkill, ProfileDraft } from "./schema";

export async function getSkillCatalog(db: AnyDb): Promise<CatalogSkill[]> {
  return db
    .select({ id: skills.id, slug: skills.slug, name: skills.name, category: skills.category })
    .from(skills)
    .orderBy(asc(skills.category), asc(skills.name));
}

export async function getSampleDrafts(db: AnyDb): Promise<{ key: string; draft: ProfileDraft }[]> {
  const rows = await db
    .select({ key: profiles.sampleKey, json: profiles.extractedJson })
    .from(profiles)
    .where(eq(profiles.isSample, true))
    .orderBy(asc(profiles.id));
  return rows.flatMap((r) => (r.key ? [{ key: r.key, draft: r.json }] : []));
}
