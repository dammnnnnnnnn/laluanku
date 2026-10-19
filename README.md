# LaluanKu: Future-Ready Career Navigator

> SDC Hackathon 2026 · Domain 1 (Aiversecity Future-Ready Workforce) · Team KitaHack

LaluanKu tracks AI-trend signals, forecasts which roles and skills are rising or declining, matches a person's skills and interests to future roles, and builds a personalised, low-cost reskilling pathway. Every role and skill is linked to the UN SDGs.

**Status:** early build (step 0: repo setup).

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
| 2 | AI-trend signal layer (updatable, source + date) | `/signals` | ⬜ |
| 3 | Future-role matching (ranked, explainable, skills gap) | `/results` | ⬜ |
| 4 | Personalised pathway (ordered, estimated time, free/low-cost) | `/pathway/[roleId]` | ⬜ |
| 5 | SDG mapping (every role + skill, path contribution) | `/results`, `/pathway` | ⬜ |
| 6 | Handling uncertainty (moderate vs fast AI scenarios, labelled estimates) | `/results` | ⬜ |

## Architecture

_TODO: diagram._ Next.js (App Router) + TypeScript + Tailwind · Postgres + Drizzle ORM · Claude API · RunPod embeddings · deployed on Replit.

## Hardest risk + fallback

_TODO_

## AI disclosure

- **LLM:** Claude (Anthropic API), model set by `AI_MODEL`. Used for CV extraction, signal tagging, pathway sequencing and explanations. It only selects from and explains our database records; it never invents jobs, courses or statistics.
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

Seed data sources and editorial choices are documented in [seed/README.md](seed/README.md).

## Data and privacy

Public, open or synthetic data only. No real CVs or personal data. Sample profiles are fictional.

## Future work

_TODO_

## License

[Apache License 2.0](LICENSE)
