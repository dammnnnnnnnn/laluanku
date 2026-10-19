// Client for a RunPod Serverless embedding endpoint running the Infinity embedding worker
// (github.com/runpod-workers/worker-infinity-embedding), via its OpenAI-compatible route:
//   POST https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1/embeddings  { model, input: [...] }
// RUNPOD_ENDPOINT may be the endpoint ID or a full base URL (useful for a local mock).

export const DEFAULT_EMBEDDING_MODEL = "BAAI/bge-m3";
const BATCH_SIZE = 32;

export type RunpodConfig = { url: string; apiKey: string; model: string; timeoutMs: number };

export function runpodConfig(env: Record<string, string | undefined> = process.env): RunpodConfig | null {
  const endpoint = env.RUNPOD_ENDPOINT?.trim();
  const apiKey = env.RUNPOD_API_KEY?.trim();
  if (!endpoint || !apiKey) return null;
  const base = /^https?:\/\//.test(endpoint) ? endpoint.replace(/\/+$/, "") : `https://api.runpod.ai/v2/${encodeURIComponent(endpoint)}/openai/v1`;
  return {
    url: `${base}/embeddings`,
    apiKey,
    model: env.RUNPOD_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
    // Serverless cold starts can be slow; callers fall back to keyword matching on timeout.
    timeoutMs: Number(env.RUNPOD_TIMEOUT_MS) || 20_000,
  };
}

type EmbeddingItem = { embedding: number[]; index?: number };

/** Accepts the OpenAI-style body, or the same body wrapped in a /runsync { output } envelope. */
export function parseEmbeddings(body: unknown, expected: number): number[][] {
  const root = body as { data?: EmbeddingItem[]; output?: unknown; status?: string };
  let data: EmbeddingItem[] | undefined = root?.data;
  if (!data && root?.output) {
    const out = root.output as { data?: EmbeddingItem[] } | EmbeddingItem[];
    data = Array.isArray(out) ? out : out.data;
  }
  if (!Array.isArray(data) || data.length !== expected) {
    throw new Error(`expected ${expected} embeddings, got ${Array.isArray(data) ? data.length : "none"}`);
  }
  const sorted = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const dim = sorted[0]?.embedding?.length ?? 0;
  if (dim === 0) throw new Error("empty embedding");
  for (const item of sorted) {
    if (!Array.isArray(item.embedding) || item.embedding.length !== dim || item.embedding.some((x) => typeof x !== "number" || !Number.isFinite(x))) {
      throw new Error("malformed embedding vector");
    }
  }
  return sorted.map((x) => x.embedding);
}

/** Embeds texts in batches. Throws on any failure so the caller can fall back. */
export async function embedTexts(texts: string[], config: RunpodConfig, fetchImpl: typeof fetch = fetch): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetchImpl(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: config.model, input: batch }),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!res.ok) throw new Error(`RunPod returned HTTP ${res.status}`);
    out.push(...parseEmbeddings(await res.json(), batch.length));
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}
