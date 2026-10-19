# RunPod embedding endpoint

LaluanKu uses a multilingual embedding model on a **RunPod Serverless** endpoint to judge whether a skill a person has is close enough to a skill a role needs (for example, "Spreadsheets (Excel / Google Sheets)" covering part of "Data analysis"). `BAAI/bge-m3` is the default because it handles Bahasa Melayu, English and Chinese.

When RunPod is not configured, unreachable or slow, matching falls back to keyword overlap automatically and the UI says which method was used, so the demo never depends on the GPU.

## 1. Create the endpoint

1. In the RunPod console, open **Serverless → New Endpoint** and choose the **Infinity embedding worker** ([runpod-workers/worker-infinity-embedding](https://github.com/runpod-workers/worker-infinity-embedding)) from the Hub or as a custom image.
2. Set the environment variable `MODEL_NAMES=BAAI/bge-m3`. RunPod's docs don't list bge-m3 explicitly; `MODEL_NAMES` accepts any Hugging Face model ID, so confirm it loads in step 3. If it doesn't, use another multilingual model and set `RUNPOD_EMBEDDING_MODEL` to match.
3. Pick a small GPU. The model is under 1B parameters. Set **min workers = 0** to scale to zero between demos; this means a cold start on the first call, which the app tolerates by falling back. Before demo day you can set 1 active worker to avoid the cold start. Check the per-second price in the console against the US$25 budget.
4. Create an API key under **Settings → API Keys**, restricted to this endpoint if possible.

## 2. Connect the app

Set these in Replit Secrets (or `.env.local` when developing):

```
RUNPOD_ENDPOINT=<endpoint id>        # or a full base URL ending in /v1
RUNPOD_API_KEY=<api key>
RUNPOD_EMBEDDING_MODEL=BAAI/bge-m3   # must match MODEL_NAMES
```

The app calls `POST https://api.runpod.ai/v2/<endpoint id>/openai/v1/embeddings` with `{"model": ..., "input": [...]}`.

## 3. Embed the skills and tune the threshold

```bash
npm run embeddings:check
```

This embeds all 89 skill names once, stores the vectors in `skill_embeddings` (re-embedding only renamed skills later), then prints the similarity distribution and the closest skill pairs. A pair at or above `EMBEDDING_SIMILARITY_THRESHOLD` (default 0.8) lets one skill count toward the other. Raise the threshold if the closest pairs list unrelated skills; lower it if obvious matches are missing. Because the vectors are cached, normal page views don't call RunPod at all.

## 4. Proof for the submission

Keep a screenshot of the endpoint page showing the **endpoint ID, GPU type and runtime/requests**, plus the `npm run embeddings:check` output, and add them to the README's *Sponsor tools* section. `/api/health` also reports `runpod.configured`, the model and how many skill embeddings are cached.

## Testing without a GPU

`npm run embeddings:mock` starts a local stand-in on `http://127.0.0.1:8089/v1` with the same API. Its vectors are hashed keywords, not semantic, so use it only to test the code path:

```
RUNPOD_ENDPOINT=http://127.0.0.1:8089/v1
RUNPOD_API_KEY=local
RUNPOD_EMBEDDING_MODEL=mock
```
