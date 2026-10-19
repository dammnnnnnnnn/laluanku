// A local stand-in for the RunPod embedding endpoint (same OpenAI-compatible route), so the
// RunPod code path can be tested without a GPU or credits. Vectors are hashed word and
// character-trigram counts: deterministic, not semantic. Never use it for real results.
// Usage: npm run embeddings:mock  then set RUNPOD_ENDPOINT=http://127.0.0.1:8089/v1 RUNPOD_API_KEY=local
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_EMBEDDINGS_PORT) || 8089;
const DIM = 256;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function embed(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  for (const w of t.split(/\s+/).filter(Boolean)) v[hash(`w:${w}`) % DIM] += 2;
  for (let i = 0; i + 3 <= t.length; i++) v[hash(`c:${t.slice(i, i + 3)}`) % DIM] += 1;
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.endsWith("/embeddings")) {
    res.writeHead(404).end();
    return;
  }
  if (!req.headers.authorization?.startsWith("Bearer ")) {
    res.writeHead(401).end();
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    try {
      const { model, input } = JSON.parse(body) as { model: string; input: string | string[] };
      const texts = Array.isArray(input) ? input : [input];
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ object: "list", model, data: texts.map((t, index) => ({ object: "embedding", index, embedding: embed(t) })) }));
    } catch {
      res.writeHead(400).end();
    }
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Mock embedding endpoint on http://127.0.0.1:${PORT}/v1/embeddings (not semantic; for testing only).`);
});
