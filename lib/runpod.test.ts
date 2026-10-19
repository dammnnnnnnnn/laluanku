import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cosine, embedTexts, parseEmbeddings, runpodConfig } from "./runpod";

describe("runpodConfig", () => {
  it("is null without both endpoint and key", () => {
    assert.equal(runpodConfig({ RUNPOD_ENDPOINT: "abc" }), null);
    assert.equal(runpodConfig({ RUNPOD_API_KEY: "k" }), null);
  });
  it("builds the OpenAI-compatible URL from an endpoint id, or uses a full URL as given", () => {
    assert.equal(runpodConfig({ RUNPOD_ENDPOINT: "abc123", RUNPOD_API_KEY: "k" })?.url, "https://api.runpod.ai/v2/abc123/openai/v1/embeddings");
    assert.equal(runpodConfig({ RUNPOD_ENDPOINT: "http://127.0.0.1:9000/v1/", RUNPOD_API_KEY: "k" })?.url, "http://127.0.0.1:9000/v1/embeddings");
    assert.equal(runpodConfig({ RUNPOD_ENDPOINT: "abc", RUNPOD_API_KEY: "k" })?.model, "BAAI/bge-m3");
  });
});

describe("parseEmbeddings", () => {
  it("reads the OpenAI shape in index order, and the /runsync envelope", () => {
    const body = { data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] };
    assert.deepEqual(parseEmbeddings(body, 2), [[1, 0], [0, 1]]);
    assert.deepEqual(parseEmbeddings({ status: "COMPLETED", output: body }, 2), [[1, 0], [0, 1]]);
  });
  it("rejects wrong counts and malformed vectors", () => {
    assert.throws(() => parseEmbeddings({ data: [{ embedding: [1] }] }, 2));
    assert.throws(() => parseEmbeddings({ data: [{ embedding: [1, 2] }, { embedding: [1] }] }, 2));
    assert.throws(() => parseEmbeddings({ data: [{ embedding: [Number.NaN] }] }, 1));
  });
});

describe("embedTexts", () => {
  const config = { url: "http://mock/embeddings", apiKey: "k", model: "m", timeoutMs: 1000 };
  it("batches requests and sends the bearer key and model", async () => {
    const calls: { auth: string | null; input: string[]; model: string }[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      calls.push({ auth: new Headers(init.headers).get("authorization"), input: body.input, model: body.model });
      return Response.json({ data: body.input.map((_: string, i: number) => ({ index: i, embedding: [i, 1] })) });
    }) as typeof fetch;
    const texts = Array.from({ length: 40 }, (_, i) => `skill ${i}`);
    const out = await embedTexts(texts, config, fake);
    assert.equal(out.length, 40);
    assert.deepEqual(calls.map((c) => c.input.length), [32, 8]);
    assert.equal(calls[0].auth, "Bearer k");
    assert.equal(calls[0].model, "m");
  });
  it("throws on HTTP errors so callers can fall back", async () => {
    const fake = (async () => new Response("down", { status: 503 })) as typeof fetch;
    await assert.rejects(() => embedTexts(["a"], config, fake), /503/);
  });
});

describe("cosine", () => {
  it("is 1 for parallel, 0 for orthogonal vectors", () => {
    assert.equal(cosine([1, 2], [2, 4]), 1);
    assert.equal(cosine([1, 0], [0, 1]), 0);
  });
});
