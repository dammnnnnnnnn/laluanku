import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "./db/schema";
import { embeddingSkillSimilarity, getSkillSimilarity, resetEmbeddingState, syncSkillEmbeddings } from "./embeddings";
import type { RunpodConfig } from "./runpod";
import { skillMatch } from "./scoring/engine";

const config: RunpodConfig = { url: "http://mock/embeddings", apiKey: "k", model: "test-model", timeoutMs: 500 };

// Deterministic fake embeddings: one dimension per keyword.
const VOCAB = ["data", "analysis", "excel", "spreadsheets", "cash", "sql"];
const fakeEmbed = async (texts: string[]) =>
  texts.map((t) => [...VOCAB.map((w): number => (t.toLowerCase().includes(w) ? 1 : 0)), 0.01]);

describe("skill embeddings", () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  let skills: { id: number; name: string }[] = [];

  before(async () => {
    await migrate(db, { migrationsFolder: "drizzle" });
    skills = await db
      .insert(schema.skills)
      .values([
        { slug: "a", name: "Data analysis", category: "data_ai", sdgReason: "x" },
        { slug: "b", name: "Spreadsheets (Excel)", category: "data_ai", sdgReason: "x" },
        { slug: "c", name: "Cash handling", category: "admin", sdgReason: "x" },
      ])
      .returning({ id: schema.skills.id, name: schema.skills.name });
  });
  after(() => client.close());

  it("embeds once, then serves from cache, and re-embeds only renamed skills", async () => {
    let calls = 0;
    const counting = async (texts: string[]) => {
      calls += texts.length;
      return fakeEmbed(texts);
    };
    const first = await syncSkillEmbeddings(db, skills, config, counting);
    assert.equal(first.embedded, 3);
    const second = await syncSkillEmbeddings(db, skills, config, counting);
    assert.equal(second.embedded, 0);
    const renamed = skills.map((s, i) => (i === 2 ? { ...s, name: "Cash and payments" } : s));
    const third = await syncSkillEmbeddings(db, renamed, config, counting);
    assert.equal(third.embedded, 1);
    assert.equal(calls, 4);
  });

  it("lets a semantically close skill cover a requirement above the threshold", async () => {
    const { vectors } = await syncSkillEmbeddings(db, skills, config, fakeEmbed);
    const sim = embeddingSkillSimilarity(vectors, config.model, 0.3);
    const [analysis, sheets] = skills;
    const roleSkills = [{ roleId: 1, skillId: analysis.id, importance: 3 }];
    const m = skillMatch(1, roleSkills, [{ skillId: sheets.id, level: 2 }], { ...sim, between: () => 0.5 });
    assert.equal(m.score, 1);
    assert.equal(m.covered[0].viaSkillId, sheets.id);
    const strict = skillMatch(1, roleSkills, [{ skillId: sheets.id, level: 2 }], { ...sim, threshold: 0.9, between: () => 0.5 });
    assert.equal(strict.score, 0);
  });

  it("falls back to keyword matching when the endpoint is unreachable", async () => {
    resetEmbeddingState();
    process.env.RUNPOD_ENDPOINT = "http://127.0.0.1:9/v1";
    process.env.RUNPOD_API_KEY = "test";
    process.env.RUNPOD_EMBEDDING_MODEL = "unreachable-model";
    process.env.RUNPOD_TIMEOUT_MS = "500";
    try {
      const sim = await getSkillSimilarity(skills, db);
      assert.equal(sim.method, "keyword");
      const again = await getSkillSimilarity(skills, db); // cooling down: no second network attempt
      assert.equal(again.method, "keyword");
    } finally {
      delete process.env.RUNPOD_ENDPOINT;
      delete process.env.RUNPOD_API_KEY;
      delete process.env.RUNPOD_EMBEDDING_MODEL;
      delete process.env.RUNPOD_TIMEOUT_MS;
      resetEmbeddingState();
    }
  });

  it("uses keyword matching when RunPod isn't configured", async () => {
    assert.equal((await getSkillSimilarity(skills, db)).method, "keyword");
  });
});
