// Fairness: protected attributes must never change a ranking.
// Three synthetic CVs differ only in name, gender, age, ethnicity, religion, marital status and
// contact details. Each goes through the real pipeline (CV keyword extraction → sanitising →
// scoring) and must produce exactly the same ranking, under every scenario.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./db/schema";
import { runSeed } from "./db/seed";
import { keywordSkills } from "./intake/extract-cv";
import { isSensitive, sanitizeDraft } from "./intake/sanitize";
import { DEFAULT_DRAFT, type ProfileDraft } from "./intake/schema";
import { DEFAULT_WEIGHTS } from "./scoring/config";
import { loadScoringContext, profileSkillsFor, scoreProfile, type ScoringContext } from "./scoring/context";
import { finalScore } from "./scoring/engine";

const WORK_HISTORY = [
  "Administrative Assistant, Contoh Logistik Sdn Bhd, 2016-2022.",
  "Handled customer service calls and kept filing and records up to date.",
  "Built weekly reports in Excel with pivot tables and managed the team calendar and appointments.",
  "Used ChatGPT to draft letters and made posters in Canva.",
].join("\n");

const PERSONAL_VARIANTS = {
  a: { name: "Siti Aminah", header: "Female, 32 years old. Malay, Muslim, married. Email: siti@example.com, phone 012-345 6789." },
  b: { name: "Ravi Kumar", header: "Male, 45 years old. Indian, Hindu, single father. Email: ravi@example.com, phone 019-876 5432." },
  c: { name: "Tan Mei Ling", header: "Gender: female. Born in 1990. Chinese, Buddhist, divorced. IC 900101-14-5678." },
};

function draftFromCv(name: string, header: string, catalog: { id: number; slug: string; name: string; category: string }[]): ProfileDraft {
  const cvText = `${name}\n${header}\n${WORK_HISTORY}`;
  return sanitizeDraft({
    ...DEFAULT_DRAFT,
    displayName: name,
    headline: header,
    summary: cvText,
    skills: keywordSkills(cvText, catalog),
  });
}

function ranking(ctx: ScoringContext, draft: ProfileDraft) {
  const roles = scoreProfile(ctx, profileSkillsFor(ctx, draft), null);
  const weights = DEFAULT_WEIGHTS.withoutInterest;
  return Object.fromEntries(
    ctx.scenarios.map((sc) => [
      sc.key,
      roles
        .map((r) => ({ roleId: r.id, score: finalScore({ skill: r.skill.score, demand: r.demand[sc.key].normalized, interest: null }, weights) }))
        .sort((x, y) => y.score - x.score || x.roleId - y.roleId),
    ]),
  );
}

describe("fairness", () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  let ctx: ScoringContext;
  let catalog: { id: number; slug: string; name: string; category: string }[];

  before(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    await runSeed(db);
    ctx = await loadScoringContext(db, new Date("2026-10-20T00:00:00Z"));
    catalog = await db.select({ id: schema.skills.id, slug: schema.skills.slug, name: schema.skills.name, category: schema.skills.category }).from(schema.skills);
  });
  after(() => client.close());

  it("extracts the same skills whatever the name, gender, ethnicity or religion", () => {
    const [a, b, c] = Object.values(PERSONAL_VARIANTS).map((v) => draftFromCv(v.name, v.header, catalog));
    const slugs = (d: ProfileDraft) => d.skills.map((s) => s.slug).sort();
    assert.ok(a.skills.length >= 5, "the work history should yield several skills");
    assert.deepEqual(slugs(a), slugs(b));
    assert.deepEqual(slugs(a), slugs(c));
  });

  it("strips every protected attribute from the text that would be stored", () => {
    for (const v of Object.values(PERSONAL_VARIANTS)) {
      const d = draftFromCv(v.name, v.header, catalog);
      for (const text of [d.headline, d.summary, ...d.education, ...d.goals, ...d.skills.map((s) => s.evidence)]) {
        assert.equal(isSensitive(text), false, `still sensitive: ${text}`);
      }
      assert.ok(!/female|male|muslim|hindu|buddhist|malay\b|indian|chinese|years old|married|divorced|@|\d{6}-\d{2}-\d{4}/i.test(d.summary));
    }
  });

  it("gives identical rankings and scores under every scenario", () => {
    const [a, b, c] = Object.values(PERSONAL_VARIANTS).map((v) => ranking(ctx, draftFromCv(v.name, v.header, catalog)));
    assert.deepEqual(a, b);
    assert.deepEqual(a, c);
  });

  it("ignores the display name and headline of a saved profile", async () => {
    const [siti] = await db.select().from(schema.profiles).limit(1);
    const original = ranking(ctx, siti.extractedJson);
    const swapped = ranking(ctx, { ...siti.extractedJson, displayName: "Ahmad (sample)", headline: "Male administrative assistant, 45" });
    assert.deepEqual(original, swapped);
  });
});
