# LaluanKu: Future-Ready Career Navigator

SDC Hackathon 2026, Domain 1 (Aiversecity Future-Ready Workforce, difficulty: Intermediate). Team KitaHack.
Online preliminary 19–25 Oct 2026. Source of truth for the brief: the official Domain 1 PDF.

## Problem statement
How might we build an AI-powered solution that continuously tracks AI advancement to predict which skills
and jobs will emerge or decline, matches today's workforce and tomorrow's talent to the right future roles,
and generates personalised reskilling pathways, while showing how each role and skill connects to the 17 UN SDGs?

- Main SDG targets: **4.3** (lifelong technical/vocational learning), **4.4** (relevant skills for decent jobs), **8.2** (productivity through innovation), **8.5** (full and productive employment)
- Background stats from the brief (cite these):
  - 56% of Malaysian professionals use AI at work, but only 26% have had formal training (Hays Asia Salary Guide 2025)
  - MOSTI says 600,000+ workers will need reskilling within 3–5 years

### Must-haves (final product needs ALL; the preliminary demo needs the most important one WORKING)
| # | Feature | Organiser's expectation |
|---|---|---|
| 1 | Skills profile intake | CV upload, form or questionnaire capturing current skills **and potential** |
| 2 | AI-trend signal layer | At least one **updatable** source (job postings, news/research feeds, open datasets). Show source + date. **Hard-coded lists alone do not count.** |
| 3 | Future-role matching | Ranked roles, an **explainable** match score, and a clear skills gap |
| 4 | Personalised pathway | An ordered plan with **estimated time**, using free or low-cost resources (online courses, HRD Corp-claimable programmes) |
| 5 | SDG mapping | Every role and skill tagged to at least one SDG, **and** showing how the chosen path contributes |
| 6 | Handling uncertainty | 2+ scenarios (moderate vs fast AI disruption), clearly labelled as **estimates** |

### Success criteria from Aiversecity
- Profile → ranked roles → actionable pathway **in minutes**
- Every recommendation is transparent about its source
- **Output visibly changes when trend data changes** (this must be demoable)
- The SDG link is meaningful, not decorative

### Preliminary rubric (optimise for this)
- Innovation & Creativity: **30%**. A sharp user slice; more than "upload CV + chatbot". Originality in signals → forecasts, scenario modelling, or SDG-influenced choices.
- Problem-Solution Fit: **25%**. Covers the whole chain and all 6 must-haves; humans stay in charge.
- Feasibility of Build: **25%**. A live, working **trend signal layer → role matching**, backed by the GitHub repo. Name the hardest risk and its fallback.
- Clarity of Proposal: **20%**. Problem → approach → expected outcome; follow the submission format and length limits.

## Organiser rules (hard constraints)
- **Data:** public, open or synthetic only. **No real CVs or personal data.** Demo with synthetic sample profiles (`seed/profiles/`).
- **AI disclosure:** name the LLM(s) used (on an `/about` page and in the README).
- **Guardrails:** every recommendation cites a source. The system must **never invent jobs, courses or statistics**. Roles and courses come only from our DB tables; the LLM may only select and explain.
- **Human-centred:** AI supports career decisions; it never makes them or hiring decisions. The user can edit their profile, override weights and dismiss suggestions.
- **Out of scope:** full course content, payments, real recruitment integrations.

## Competition rules (sponsor tools + GitHub)
- **Replit is compulsory.** Deploy on Replit from a team member's own account; the live URL goes in the declaration.
- **RunPod** for any GPU work (model hosting, fine-tuning, inference). Keep a screenshot of the Pod or endpoint ID, GPU type and runtime. Budget: US$25.
- **GitHub:** private while building, public before submission, Apache License 2.0 `LICENSE`, committee accounts added as collaborators.
- **Genuine commit history.** Commit after every meaningful step with clear messages. Never make one giant final commit.
- **Never expose API keys.** Use Replit Secrets or `.env.local` (gitignored). Commit `.env.example` only.

## Pitch
- **Sharp user slice:** the mid-career admin or clerical worker in Malaysia whose role is flagged as declining. Moment of need: after a restructuring notice, or when returning to work. Demo persona: synthetic "Siti, 32, admin assistant returning to work".
- **Other users (later):** fresh grads and career switchers, HR/L&D managers, TVET and university career centres.
- **SDGs:** 8 (primary), 4, 9, 10, 5.
- **Differentiator:** a living forecast. Signals → skill forecasts → scenario-weighted rankings, with every number traceable to a dated source and a visible formula. When new signals arrive, the user's plan **re-ranks and the change is shown** ("Your #2 role moved up because of 3 new signals since 18 Oct").

## Stack
- **Next.js (App Router) + TypeScript + Tailwind**, deployed on **Replit** (Replit Deployments)
- **Postgres** (Replit's built-in database, `DATABASE_URL`) using **Drizzle ORM**
- **LLM:** Claude API (`@anthropic-ai/sdk`) for CV extraction, signal tagging, pathway sequencing and explanations. Server routes only. Model from env `AI_MODEL`, and disclosed in the UI.
- **Embeddings (RunPod):** a multilingual embedding model (e.g. `BAAI/bge-m3`, which handles BM, EN and ZH) on a RunPod Serverless endpoint for skill ↔ role semantic matching.
  - `lib/embeddings.ts` falls back to normalized keyword overlap if `RUNPOD_ENDPOINT` is unset or fails, so the demo never breaks.
- **Env:** `ANTHROPIC_API_KEY`, `AI_MODEL`, `DATABASE_URL`, `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT`, `ADMIN_TOKEN`

## Data model (Drizzle)
- `skills(id, name, category, sdg_ids int[], sdg_reason text)`
- `roles(id, title, description, sector, sdg_ids int[], sdg_targets text[], sdg_reason text, riasec jsonb {R,I,A,S,E,C: 0-1}, riasec_code text, riasec_source text)`
- `role_skills(role_id, skill_id, importance 1-3)`
- `courses(id, title, provider, url, cost 'free'|'low'|'hrdc_claimable', hours int, language, skill_ids int[], verified_at)`: a curated catalog, the ONLY place pathways may draw courses from
- `signals(id, title, source_name, source_type 'report'|'news'|'dataset'|'research', url, published_date, fetched_at, summary, direction 'emerging'|'declining', strength 1-5, role_ids int[], skill_ids int[])`
- `scenarios(id, key, name, description, ai_adoption_multiplier, notes)`: at least `moderate_2030` and `fast_ai_2030`
- `profiles(id, created_at, raw_input, extracted_json, riasec jsonb nullable, is_sample bool)`
- `ranking_snapshots(id, profile_id, scenario_key, computed_at, signals_version, ranking jsonb)`: used to show "what changed since last time"

## Personality / interest fit (RIASEC)
- Use the **Holland RIASEC** interest model (Realistic, Investigative, Artistic, Social, Enterprising, Conventional), which is the standard model in career guidance. Do NOT use MBTI. This covers "skills **and potential**" in must-have 1.
- Use a short quiz (18 questions, 3 per type, Likert 1–5), bilingual EN/BM, written in our own words, stored in `lib/riasec.ts`.
- Each role has a RIASEC profile (6 scores from 0–1) plus a 3-letter code such as "ICR".
  - Seed these from O*NET occupation interest data where a matching occupation exists, and record it in `riasec_source`. Check O*NET's license and attribution requirements first.
- `interest_fit(user, role)` = cosine similarity of the two 6-dim vectors
- The UI shows the user's RIASEC hexagon next to each role's, plus a plain-language reason.
- Personality is **guidance, never a gate**: it never hides roles. The quiz is skippable.

## Fairness (good-to-have, cheap to do)
- Never use age, gender, ethnicity, religion or location of origin as scoring inputs; strip them during CV extraction.
- `/about` explains this. A test checks that swapping gendered names in a sample CV gives an identical ranking.

## Scoring (deterministic and explainable; the LLM only explains it)
- `role_demand(role, scenario)` = sum of signal strength (emerging +, declining −) × recency decay (half-life ~12 months), then × the scenario multiplier for AI-exposed roles
- `skill_match(profile, role)` = weighted skill coverage (similarity ≥ threshold counts as covered, weighted by importance)
- `final_score` = 0.45 × skill_match + 0.35 × normalized role_demand + 0.20 × interest_fit
  - Without the quiz: 0.55 × skill_match + 0.45 × role_demand
  - The user can adjust weights with sliders (human in control)
- The UI shows the formula breakdown, the signals (source + date) behind each number, and an **"Estimate, not a prediction"** label with a confidence band based on signal count and agreement.

## Features / pages
1. `/`: landing page, the problem in 2 stats, "Try with a sample profile" + "Start"
2. `/intake`: CV upload (PDF) **or** form **or** "Load sample profile". Claude extracts a normalized skill profile, which the user edits and confirms (human-in-the-loop). Then an optional 3-minute RIASEC quiz.
3. `/results`:
   - **Future Skills Radar:** rising vs declining roles and skills with source chips (`WEF · Jan 2025`) and a "signals last updated" timestamp
   - **Scenario toggle:** Moderate vs Fast AI disruption, re-sorting live, with an estimate disclaimer
   - **Top 3 matched roles:** score breakdown (skills / demand / interest), skills gap, RIASEC comparison, "why this role" with cited signals
   - **What changed:** a diff vs the last `ranking_snapshot` after new signals arrive
4. `/pathway/[roleId]`: an ordered plan of gap skills → courses from the `courses` table only (each with provider, cost, hours, link), total estimated time, a weekly schedule, and "SDG contribution of this path" (targets 4.3/4.4/8.2/8.5 etc. with reasons)
5. `/signals`: all signals with type, source, date and `fetched_at`; admin **Refresh signals** (`ADMIN_TOKEN`) pulls configured RSS feeds and the Anthropic Economic Index release, Claude tags new items, and rankings recompute
6. `/about`: models used, data sources, fairness approach, limitations, "AI supports, humans decide"

## Seed data (`/seed`)
- About 20 future roles (tech, green economy, healthcare, smart agri, logistics, creative, responsible AI) plus 5 declining roles, all **from cited sources** (WEF Future of Jobs 2025, TalentCorp MyCOL 2024/2025)
- About 80 skills; SDG + target tags for every role and skill
- 30–50 signals from real reports and news **with real dates and URLs**. Never invent; flag `TODO_VERIFY` if unsure.
- 40–60 courses (free MOOCs, MyMahir/TalentCorp programmes, HRD Corp-claimable listings), each with a real URL and estimated hours
- 3 synthetic sample profiles (admin worker returning to work, fresh grad, factory technician); clearly fictional
- RIASEC profile + code for every role (with `riasec_source`)

## Build order (commit after each step)
**Preliminary priority: steps 0–4 must be live and deployed first. That is the "trend signal layer → role matching" judges will score.**
0. `git init`, `.gitignore`, `LICENSE` (Apache-2.0), `.env.example`, README skeleton
1. Scaffold Next.js + Tailwind + Drizzle, schema + migrations, seed script (roles, skills, signals, scenarios, sample profiles)
2. `/signals` page + **Refresh signals** (RSS ingest + Claude tagging)
3. Scoring engine + `/results` with sample profile, scenario toggle, estimate labels (keyword matching first)
4. Ranking snapshots + "What changed" diff after a refresh, then **deploy to Replit**
5. Intake: CV/form → Claude extraction → editable profile → optional RIASEC quiz
6. SDG view + courses table + `/pathway`
7. RunPod embedding endpoint plugged into matching (keep the fallback)
8. `/about`, fairness test, mobile polish, BM strings
9. README: Problem → User → Solution → Must-have checklist (where each lives) → Architecture → Hardest risk + fallback → AI disclosure → Sponsor tools (Replit URL, RunPod proof) → How to run → Future work

## Hardest risks + fallbacks (for the proposal)
- **Unreliable trend data:** curated dated reports as a baseline + RSS refresh; if feeds fail, show the last good `fetched_at`.
- **AI inventing jobs or courses:** roles and courses only from DB tables; LLM output validated against IDs; anything unmatched is dropped.
- **Matching quality:** embeddings on RunPod with a keyword fallback; the user confirms extracted skills.
- **RunPod downtime:** automatic fallback to keyword matching.

## Rules for Claude Code
- Work one step at a time; run `npm run build` and fix errors before moving on.
- Suggest a commit message at the end of every step.
- Keep code simple and readable. No auth beyond `ADMIN_TOKEN`.
- Validate all LLM JSON with zod, retry once on invalid JSON, and **reject any role/course/skill ID not in the DB**.
- Never hardcode or log secrets. Validate uploads (PDF only, max 5MB). Don't store uploaded CVs; keep only the extracted profile.
- UI strings go in `lib/i18n.ts` (`en`, `ms`; `zh` later).
