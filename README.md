# LaluanKu: Future-Ready Career Navigator

> SDC Hackathon 2026 · Domain 1 (Aiversecity Future-Ready Workforce) · Team KitaHack

LaluanKu tracks AI-trend signals, forecasts which roles and skills are rising or declining, matches a person's skills and interests to future roles, and builds a personalised, low-cost reskilling pathway. Every role and skill is linked to the UN SDGs.

**Status:** early build. The trend signal layer (`/signals` + refresh) is live; matching comes next.

---

## Problem

- 56% of Malaysian professionals use AI at work, but only 26% have had formal training (Hays Asia Salary Guide 2025).
- MOSTI says 600,000+ workers will need reskilling within 3–5 years.

SDG targets: **4.3**, **4.4**, **8.2**, **8.5**.

## User

The mid-career admin or clerical worker in Malaysia whose role is flagged as declining, at the moment of a restructuring notice or when returning to work.
Demo persona (synthetic): *Siti, 32, admin assistant returning to work*.

## Solution

_TODO: signals → skill forecasts → scenario-weighted rankings → pathway, with every number traceable to a dated source._

## Must-have checklist

| # | Feature | Where it lives | Status |
|---|---|---|---|
| 1 | Skills profile intake (CV / form / RIASEC quiz) | `/intake`, `lib/intake/`, `lib/riasec.ts` | ✅ |
| 2 | AI-trend signal layer (updatable, source + date) | `/signals`, `POST /api/signals/refresh`, `lib/signals/` | ✅ |
| 3 | Future-role matching (ranked, explainable, skills gap) | `/results`, `lib/scoring/` | ✅ (keyword matching) |
| 4 | Personalised pathway (ordered, estimated time, free/low-cost) | `/pathway/[roleId]` | ⬜ |
| 5 | SDG mapping (every role + skill, path contribution) | `/results`, `/pathway` | ⬜ |
| 6 | Handling uncertainty (moderate vs fast AI scenarios, labelled estimates) | `/results` scenario toggle, confidence bands | ✅ |

## Architecture

_TODO: diagram._ Next.js (App Router) + TypeScript + Tailwind · Postgres + Drizzle ORM · Claude API · RunPod embeddings · deployed on Replit.

### Trend signal layer

- **Baseline:** 36 curated signals from dated reports (WEF, ILO, Anthropic Economic Index, MOSTI, DOSM and others). See [seed/README.md](seed/README.md).
- **Updatable feeds** (`lib/signals/feeds.ts`): Google News RSS searches on AI and jobs, green jobs, the care workforce and talent policy in Malaysia; arXiv research on generative AI and labour markets; and new release folders in the [Anthropic Economic Index dataset](https://huggingface.co/datasets/Anthropic/EconomicIndex) on Hugging Face.
- **Refresh** (admin button on `/signals`, `POST /api/signals/refresh` with `Authorization: Bearer $ADMIN_TOKEN`, or `npm run signals:refresh`): fetch feeds, drop items already seen or near-duplicates, then tag each item.
- **Tagging:** Claude decides relevance and direction, links the item **only to role and skill IDs from our catalog**, and writes a summary limited to facts in the item. The output is a JSON schema, validated with zod and retried once if invalid. Without API credentials, a deterministic keyword tagger takes over.
- **Guardrails** (`lib/signals/guardrails.ts`): unknown IDs are dropped; items with no valid links are rejected; a summary containing a number not in the source is replaced by the headline; feed items are capped at strength 3.
- **Audit trail:** every item checked is stored in `feed_items` with its status and reason, and every run is logged in `signal_refresh_runs` (per-feed status). If feeds fail, existing signals stay and the page shows the last good fetch.

### Scoring (deterministic; constants in `lib/scoring/config.ts`)

- **Signal contribution** = ±strength × 0.5^(age in days / 365). A signal counts in full when it names the role. When it names one of the role's required skills, it counts at 0.5 × importance / 3. Skill-level signals together add at most ±2 per role, and feed-ingested signals that name a role add at most ±3, so a burst of similar news can't outweigh the curated reports.
- **Role demand** = Σ contributions × scenario multiplier, where multiplier = 1 + (m − 1) × AI exposure weight (low 0, medium 0.5, high 1; m = 1.0 moderate, 1.5 fast AI). This is mapped to 0–100 with 50 + 50·tanh(raw / 5), so 50 means no net signal.
- **Skill match** = importance-weighted share of the role's required skills that the person has. A related skill with keyword overlap ≥ 0.5 also counts, and the UI shows which one.
- **Final** = 0.55 × skill match + 0.45 × demand until the RIASEC quiz exists (then 0.45 / 0.35 / 0.20). Users can change the weights with sliders.
- **Confidence** (low/medium/high, from signal count and agreement) sets a ± band on demand. Every score is labelled *Estimate, not a prediction*.
- `/results` ranks emerging roles by default. Declining roles that match the person's current skills are shown separately, and a checkbox includes them in the ranking.
- `npm test` runs the engine unit tests. `npm run results:check` prints each sample profile's ranking under both scenarios.

### Living forecast: "What changed"

- The **signals version** is a hash of every signal's id, direction, strength, date and links, so it changes whenever a signal is added or re-tagged.
- A **ranking snapshot** (`ranking_snapshots`) stores a profile's ranking for one scenario and one signals version, using default weights. One is recorded on a profile's first visit to `/results`. The refresh pipeline (`lib/refresh-pipeline.ts`) snapshots every sample profile and every profile created in the last 30 days before it pulls feeds (the baseline), and again after it accepts new signals.
- `/results` diffs the current ranking against the latest snapshot taken on a different signals version. It shows a headline (for example: "Your #2 role, Vocational & Digital Skills Trainer, moved up from #6 because of 13 new signals since 20 Oct 2026"), each role's rank move and score change, and source chips for the new signals behind it.
- **To demo:** open `/results` for a sample, click *Refresh signals* on `/signals` (admin token), then reload `/results`.

### Profile intake (`/intake`)

- **Three ways in:** upload a CV (PDF only, up to 5 MB, checked by size, MIME type and `%PDF-` signature), fill a short form, or start from a synthetic sample.
- **CV extraction:** the PDF is held in memory, sent to Claude as a document block and then discarded. It is never written to disk or the database, and never logged. Claude returns JSON-schema output whose skill slugs are limited to an enum of our catalog. The output is zod-validated and retried once, and any slug not in the database is dropped. Without credentials, or if the call fails, a keyword matcher over the PDF text (`unpdf`) takes over and says so.
- **Fairness and privacy:** the prompt forbids name, age, gender, ethnicity, religion, marital status, contact details and IDs. `lib/intake/sanitize.ts` also strips any sentence mentioning them from every text field before review and again before saving. Stored profiles keep only the confirmed skills and a note on how they were made, never the CV text.
- **Human in the loop:** the user edits the skill list (add, remove, set level), and must tick a confirmation before continuing.
- **RIASEC quiz (optional):** 18 questions in EN/BM (`lib/riasec.ts`), Likert 1–5. Interest fit = cosine similarity of the mean-centred 6-dimension profiles, shown with a hexagon and a plain-language reason. Roles' profiles come from O*NET (see below). The quiz is skippable and never hides roles.
- Saved profiles get an unguessable link (`/results?profile=<random id>`). Uploads and saves are rate-limited per IP.

### Data attribution

Role interest profiles include information from the [O*NET 31.0 Database](https://www.onetcenter.org/database.html) by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. We mapped each LaluanKu role to its closest O*NET occupation and rescaled the 1–7 interest scores to 0–1; the mapping is in `seed/roles.json` (`riasec_source`). O*NET® is a trademark of USDOL/ETA.

## Hardest risk + fallback

| Risk | What we built |
|---|---|
| Unreliable or noisy trend data | 36 curated, dated, source-checked signals as the baseline. Feeds are capped (strength ≤ 3, ±3 per role), duplicates are dropped, and every checked item is logged with a reason. If every feed fails, existing signals stay and `/signals` shows the last good fetch. |
| AI inventing jobs, courses or statistics | Roles, skills and courses come only from database tables. Claude's JSON output is schema-constrained and zod-validated, and unknown IDs are dropped. Summaries containing numbers that aren't in the source are replaced by the headline. |
| Claude unavailable (no key, outage, refusal) | Keyword taggers for signals and CVs keep the app working, and the UI labels which method was used. Requests opt into server-side refusal fallback. |
| Matching quality | The user confirms every extracted skill. Related-skill matching is keyword-based now, with RunPod embeddings planned (step 7) and keyword matching kept as the fallback. |
| Demo database | `npm run db:local` runs Postgres in-process (PGlite), so the app works without installing Postgres. |

## AI disclosure

- **LLM:** Claude (Anthropic API), model set by `AI_MODEL` (default `claude-opus-5-5`). Used for signal tagging and CV skill extraction; pathway sequencing and explanations come later. It only selects from and explains our database records; it never invents jobs, courses or statistics. Requests opt into Anthropic's server-side refusal fallback (`fallbacks: "default"`). Each signal shows whether it was curated, tagged by Claude or tagged by the keyword fallback.
- **Embeddings:** multilingual embedding model (e.g. `BAAI/bge-m3`) on RunPod Serverless, with a keyword-matching fallback.

## Sponsor tools

- **Replit:** live URL _TODO_
- **RunPod:** endpoint ID / GPU type / runtime _TODO_

## How to run

### Locally, without installing Postgres

```bash
npm install
npm run db:local   # terminal 1: local Postgres (PGlite) in .pglite/, migrated + seeded; creates .env.local if missing
npm run dev        # terminal 2
```

Add `ANTHROPIC_API_KEY` to `.env.local` to use Claude; without it, the keyword fallbacks are used. The local server handles one connection reliably, so keep `DATABASE_POOL_MAX=1` in `.env.local` while using it.

### With your own Postgres

```bash
cp .env.example .env.local   # set DATABASE_URL, ADMIN_TOKEN, ANTHROPIC_API_KEY
npm install
npm run db:migrate           # apply migrations in ./drizzle
npm run db:seed              # load curated roles, skills, signals, scenarios, sample profiles
npm run dev
```

### Deploy on Replit

1. Import this GitHub repository into Replit from your own account.
2. Create the built-in **PostgreSQL** database (Tools → Database). This sets `DATABASE_URL`.
3. Add **Secrets**: `ANTHROPIC_API_KEY`, `AI_MODEL` (`claude-opus-5-5`) and `ADMIN_TOKEN` (a long random string).
4. In the Shell run `npm ci`, then `npm run db:deploy` to migrate and seed. Press **Run** to try the dev server.
5. Click **Deploy** and choose Autoscale. `.replit` already sets the build command (`npm ci && npm run build`) and the run command (`npm run db:deploy && npm run start:replit`), which migrates, re-seeds idempotently and serves on `0.0.0.0:$PORT`.
6. Open `/api/health` on the live URL. It should report `"ok": true` with 30 roles. Then refresh signals once from `/signals`.

`.replit` uses the `nodejs-22` and `postgresql-16` modules. If your Replit workspace offers different module names, pick the closest ones; what matters is the build and run commands.

Other scripts:

- `npm run db:check`: validates the seed files and runs migrations and the seed against an in-memory Postgres (PGlite). No database needed.
- `npm run db:generate`: creates a new migration after editing `lib/db/schema.ts`.
- `npm run db:studio`: browses the database.
- `npm run signals:refresh`: runs a signal refresh against `DATABASE_URL`, the same as the admin button.
- `npm run signals:check`: dry run of a refresh against an in-memory Postgres. It pulls the live feeds, prints what would be accepted or rejected and why, and shows how Siti's ranking would change.
- `npm run db:deploy`: production migrate (`scripts/migrate.mjs`, no drizzle-kit needed) followed by the idempotent seed.

Seed data sources and editorial choices are documented in [seed/README.md](seed/README.md).

## Data and privacy

Public, open or synthetic data only. No real CVs or personal data. Sample profiles are fictional.

## Future work

_TODO_

## License

[Apache License 2.0](LICENSE)
