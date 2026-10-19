// Skill-to-skill similarity used for matching. For now this is normalized keyword overlap;
// step 7 adds a RunPod embedding endpoint (BAAI/bge-m3) and keeps this as the fallback,
// so matching never breaks when the endpoint is unset or down.

export type SimilarityMethod = "keyword" | "embedding";

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

export type SkillSimilarity = {
  method: SimilarityMethod;
  /** Similarity between two skill ids, 1 for the same skill. */
  between(a: number, b: number): number;
};

export async function getSkillSimilarity(skills: { id: number; name: string }[]): Promise<SkillSimilarity> {
  const names = new Map(skills.map((s) => [s.id, s.name]));
  const cache = new Map<string, number>();
  return {
    method: "keyword",
    between(a, b) {
      if (a === b) return 1;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      let v = cache.get(key);
      if (v === undefined) {
        v = keywordSimilarity(names.get(a) ?? "", names.get(b) ?? "");
        cache.set(key, v);
      }
      return v;
    },
  };
}
