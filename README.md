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
| 1 | Skills profile intake (CV / form / RIASEC quiz) | `/intake` | ⬜ |
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

- **Signal contribution** = ±strength × 0.5^(age in days / 365). A signal counts in full when it names the role. When it names one of the role's required skills, it counts at 0.5 × importance / 3. Skill-level signals together add at most ±2 per role.
- **Role demand** = Σ contributions × scenario multiplier, where multiplier = 1 + (m − 1) × AI exposure weight (low 0, medium 0.5, high 1; m = 1.0 moderate, 1.5 fast AI). This is mapped to 0–100 with 50 + 50·tanh(raw / 5), so 50 means no net signal.
- **Skill match** = importance-weighted share of the role's required skills that the person has. A related skill with keyword overlap ≥ 0.5 also counts, and the UI shows which one.
- **Final** = 0.55 × skill match + 0.45 × demand until the RIASEC quiz exists (then 0.45 / 0.35 / 0.20). Users can change the weights with sliders.
- **Confidence** (low/medium/high, from signal count and agreement) sets a ± band on demand. Every score is labelled *Estimate, not a prediction*.
- `/results` ranks emerging roles by default. Declining roles that match the person's current skills are shown separately, and a checkbox includes them in the ranking.
- `npm test` runs the engine unit tests. `npm run results:check` prints each sample profile's ranking under both scenarios.

## Hardest risk + fallback

_TODO_

## AI disclosure

- **LLM:** Claude (Anthropic API), model set by `AI_MODEL` (default `claude-opus-5-5`). Used for signal tagging now; CV extraction, pathway sequencing and explanations come later. It only selects from and explains our database records; it never invents jobs, courses or statistics. Requests opt into Anthropic's server-side refusal fallback (`fallbacks: "default"`). Each signal shows whether it was curated, tagged by Claude or tagged by the keyword fallback.
- **Embeddings:** multilingual embedding model (e.g. `BAAI/bge-m3`) on RunPod Serverless, with a keyword-matching fallback.

## Sponsor tools

- **Replit:** live URL _TODO_
- **RunPod:** endpoint ID / GPU type / runtime _TODO_

## How to run

```bash
cp .env.example .env.local   # fill in values (DATABASE_URL at minimum)
npm install
npm run db:migrate           # apply migrations in ./drizzle
npm run db:seed              # load curated roles, skills, signals, scenarios, sample profiles
npm run dev
```

Other scripts:

- `npm run db:check`: validates the seed files and runs migrations and the seed against an in-memory Postgres (PGlite). No database needed.
- `npm run db:generate`: creates a new migration after editing `lib/db/schema.ts`.
- `npm run db:studio`: browses the database.
- `npm run signals:refresh`: runs a signal refresh against `DATABASE_URL`, the same as the admin button.
- `npm run signals:check`: dry run of a refresh against an in-memory Postgres. It pulls the live feeds and prints what would be accepted or rejected, and why.

Seed data sources and editorial choices are documented in [seed/README.md](seed/README.md).

## Data and privacy

Public, open or synthetic data only. No real CVs or personal data. Sample profiles are fictional.

## Future work

_TODO_

## License

[Apache License 2.0](LICENSE)
