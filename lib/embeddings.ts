// Skill-to-skill similarity used for matching.
// - With RUNPOD_ENDPOINT + RUNPOD_API_KEY: cosine similarity of multilingual embeddings
//   (BAAI/bge-m3 by default) from a RunPod Serverless endpoint, cached in skill_embeddings.
// - Otherwise, or if RunPod fails or times out: normalized keyword overlap, so matching never breaks.
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { skillEmbeddings } from "./db/schema";
import type { AnyDb } from "./db/types";
import { cosine, embedTexts, runpodConfig, type RunpodConfig } from "./runpod";
import { DEFAULT_EMBEDDING_SIMILARITY_THRESHOLD, KEYWORD_SIMILARITY_THRESHOLD } from "./scoring/config";

export type SimilarityMethod = "keyword" | "embedding";

export type SkillSimilarity = {
  method: SimilarityMethod;
  model: string | null;
  /** Similarity at or above this counts a related skill as covering a requirement. */
  threshold: number;
  /** Similarity between two skill ids, 1 for the same skill. */
  between(a: number, b: number): number;
};

type SkillText = { id: number; name: string };

const STOPWORDS = new Set(["and", "or", "the", "of", "for", "at", "to", "with", "using", "work", "tools", "skills"]);

export function keywordTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of the two names' keyword sets, 0..1. */
export function keywordSimilarity(a: string, b: string): number {
  const ta = keywordTokens(a);
  const tb = keywordTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const w of ta) if (tb.has(w)) shared++;
  return shared / (ta.size + tb.size - shared);
}

function memoized(compute: (a: number, b: number) => number) {
  const cache = new Map<string, number>();
  return (a: number, b: number) => {
    if (a === b) return 1;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    let v = cache.get(key);
    if (v === undefined) {
      v = compute(a, b);
      cache.set(key, v);
    }
    return v;
  };
}

export function keywordSkillSimilarity(skills: SkillText[]): SkillSimilarity {
  const names = new Map(skills.map((s) => [s.id, s.name]));
  return {
    method: "keyword",
    model: null,
    threshold: KEYWORD_SIMILARITY_THRESHOLD,
    between: memoized((a, b) => keywordSimilarity(names.get(a) ?? "", names.get(b) ?? "")),
  };
}

export function embeddingSkillSimilarity(vectors: Map<number, number[]>, model: string, threshold: number): SkillSimilarity {
  return {
    method: "embedding",
    model,
    threshold,
    between: memoized((a, b) => {
      const va = vectors.get(a);
      const vb = vectors.get(b);
      return va && vb ? cosine(va, vb) : 0;
    }),
  };
}

const textHash = (name: string) => createHash("sha1").update(name).digest("hex").slice(0, 16);

/** Loads cached vectors, embeds any missing or renamed skills via RunPod, stores them. */
export async function syncSkillEmbeddings(db: AnyDb, skills: SkillText[], config: RunpodConfig, embed = embedTexts): Promise<{ vectors: Map<number, number[]>; embedded: number }> {
  const cached = await db
    .select({ skillId: skillEmbeddings.skillId, textHash: skillEmbeddings.textHash, embedding: skillEmbeddings.embedding })
    .from(skillEmbeddings)
    .where(eq(skillEmbeddings.model, config.model));
  const byId = new Map(cached.map((c) => [c.skillId, c]));
  const vectors = new Map<number, number[]>();
  const missing: SkillText[] = [];
  for (const s of skills) {
    const hit = byId.get(s.id);
    if (hit && hit.textHash === textHash(s.name)) vectors.set(s.id, hit.embedding);
    else missing.push(s);
  }
  if (missing.length > 0) {
    const fresh = await embed(missing.map((s) => s.name), config);
    for (let i = 0; i < missing.length; i++) {
      const s = missing[i];
      vectors.set(s.id, fresh[i]);
      await db
        .insert(skillEmbeddings)
        .values({ skillId: s.id, model: config.model, textHash: textHash(s.name), embedding: fresh[i] })
        .onConflictDoUpdate({
          target: [skillEmbeddings.skillId, skillEmbeddings.model],
          set: { textHash: textHash(s.name), embedding: fresh[i], createdAt: new Date() },
        });
    }
  }
  return { vectors, embedded: missing.length };
}

// After a RunPod failure, skip it for a while instead of making every request wait for a timeout.
const RETRY_AFTER_MS = 5 * 60_000;
let lastFailureAt = 0;
let inFlight: Promise<Map<number, number[]>> | null = null;

export function embeddingThreshold(env: Record<string, string | undefined> = process.env): number {
  const v = Number(env.EMBEDDING_SIMILARITY_THRESHOLD);
  return v > 0 && v <= 1 ? v : DEFAULT_EMBEDDING_SIMILARITY_THRESHOLD;
}

/**
 * Embedding similarity when RunPod is configured and reachable (or vectors are cached),
 * keyword overlap otherwise. Never throws.
 */
export async function getSkillSimilarity(skills: SkillText[], db?: AnyDb): Promise<SkillSimilarity> {
  const config = runpodConfig();
  if (!config || !db) return keywordSkillSimilarity(skills);

  // Even while RunPod is cooling down, fully cached vectors can still be used.
  if (Date.now() - lastFailureAt < RETRY_AFTER_MS) {
    const cached = await db
      .select({ skillId: skillEmbeddings.skillId, embedding: skillEmbeddings.embedding, textHash: skillEmbeddings.textHash })
      .from(skillEmbeddings)
      .where(eq(skillEmbeddings.model, config.model));
    const ok = new Map(cached.map((c) => [c.skillId, c]));
    if (skills.every((s) => ok.get(s.id)?.textHash === textHash(s.name))) {
      return embeddingSkillSimilarity(new Map(cached.map((c) => [c.skillId, c.embedding])), config.model, embeddingThreshold());
    }
    return keywordSkillSimilarity(skills);
  }

  try {
    inFlight ??= syncSkillEmbeddings(db, skills, config).then((r) => r.vectors);
    const vectors = await inFlight;
    return embeddingSkillSimilarity(vectors, config.model, embeddingThreshold());
  } catch (err) {
    lastFailureAt = Date.now();
    console.warn("RunPod embeddings unavailable, using keyword matching:", err instanceof Error ? err.message : String(err));
    return keywordSkillSimilarity(skills);
  } finally {
    inFlight = null;
  }
}

/** For tests: forget a previous RunPod failure. */
export function resetEmbeddingState() {
  lastFailureAt = 0;
  inFlight = null;
}
