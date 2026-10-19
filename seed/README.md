# Seed data

Curated baseline data loaded by `npm run db:seed`. Every file is validated with zod and cross-checked (unknown slugs, duplicates, missing SDG tags) before anything is written. Run `npm run db:check` to validate edits against an in-memory Postgres, with no database needed.

| File | Contents |
|---|---|
| `skills.json` | 89 skills, each with a category, SDG ids and a one-line SDG reason |
| `roles.json` | 24 emerging and 6 declining roles, each with a cited source, SDG targets, AI exposure level, O*NET RIASEC profile and required skills (importance 1–3) |
| `signals.json` | 36 dated trend signals from real reports, research and news |
| `courses.json` | 46 courses, the only source for learning pathways (see below) |
| `scenarios.json` | `moderate_2030` and `fast_ai_2030` |
| `profiles/*.json` | 3 **synthetic** sample profiles (fictional people, no real CVs) |

## Sources

All URLs, dates and figures were checked on **2026-10-20** (this is the `fetched_at` of the seed signals). WEF figures come from the report PDFs. `Fig.` numbers refer to the report figures.

| Source | Published | Used for |
|---|---|---|
| [WEF Future of Jobs Report 2025](https://www.weforum.org/publications/the-future-of-jobs-report-2025/) | 2025-01-07 | Most roles (Fig. 2.2 fastest-growing/declining, Fig. 2.4 largest-growing/declining), skills on the rise (Fig. 3.4), Malaysia findings |
| [WEF Future of Jobs Report 2023](https://www.weforum.org/publications/the-future-of-jobs-report-2023/) | 2023-04-30 | Sustainability, BI, process automation, e-commerce, digital marketing, supply chain, solar installation, agricultural equipment, vocational teacher roles (Fig. 3.3) |
| [ILO Working Paper 140](https://www.ilo.org/publications/generative-ai-and-jobs-refined-global-index-occupational-exposure) | 2025-05-20 | Clerical exposure to generative AI |
| [Anthropic Economic Index](https://www.anthropic.com/news/the-anthropic-economic-index) (Feb, Mar and Sep 2025 reports) | 2025-02-10 / 03-27 / 09-15 | AI usage patterns; motivation for the fast-AI scenario |
| [IMF blog on SDN/2024/001](https://www.imf.org/en/Blogs/Articles/2024/01/14/ai-will-transform-the-global-economy-lets-make-sure-it-benefits-humanity) | 2024-01-14 | Global AI exposure |
| [Malay Mail: MOSTI](https://www.malaymail.com/news/malaysia/2025/01/07/mosti-ai-disruption-looms-in-malaysia-600000-workers-must-reskill-in-three-to-five-years/162368) | 2025-01-07 | 600,000+ workers must reskill (brief's statistic) |
| [Bernama: MOHR–TalentCorp study](https://bernama.com/en/general/news.php?id=2350085) | 2024-10-10 | 600,000 workers in 10 strategic sectors |
| [People Matters, citing Hays Asia Salary Guide 2025](https://sea.peoplemattersglobal.com/article/strategic-hr/ai-in-malaysian-workplaces-a-strategic-outlook-46436) | 2025-07-31 | 56% use AI / 26% formally trained (brief's statistic) |
| [Microsoft & LinkedIn Work Trend Index 2024](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part) | 2024-05-08 | AI skills in hiring |
| Malaysian policy news (NETR, green jobs, National Semiconductor Strategy, NAIO, AIGE, DOSM population) | 2023–2024 | Malaysia-specific demand signals |
| [pv magazine, citing IRENA–ILO](https://www.pv-magazine.com/2026/01/14/solar-accounted-for-7-24-million-jobs-in-2024/) | 2026-01-14 | Renewable energy employment |

**Caveats:**
- The Hays primary report is behind a registration form, so we cite the secondary article. Coverage differs on whether the 26% is out of all professionals or only AI users.
- The NETR job figures have been revised several times. We quote the figure as each article states it, with that article's date.

## Editorial judgements (team-made, not statistics)

These are modelling choices, and the UI should label them as such:

- **Signal `strength` (1–5):** 5 = a major global report naming the role or skill directly in a ranked list; 4 = an official national target or quantified national finding; 3 = credible news or research with a clear but indirect link; 2 = indirect or usage-based evidence; 1 = anecdotal.
- **Signal ↔ role/skill links:** which roles and skills a signal is attached to.
- **Role `ai_exposure` (low/medium/high):** a coarse classification informed by ILO WP140 (clerical work is the most exposed) and the Anthropic Economic Index (computer and writing tasks see the most usage). It is not a measured score.
- **Role skills and importance:** curated by the team. They will be cross-checked against O*NET in a later step.
- **SDG tags and reasons:** our mapping to SDG targets.
- **Scenario multipliers** (1.0 / 1.5): assumptions, labelled as estimates.

## Role interest profiles (RIASEC)

Each role's `riasec` scores and `riasec_code` come from the O*NET 31.0 `career_interest_types` file: occupational interest scores (1–7) rescaled to 0–1 as (score − 1) / 6, with the code taken from O*NET's first, second and third interest high-points (some occupations have only two). Each role is mapped to its closest O*NET occupation, which `riasec_source` names (for example, AI & Machine Learning Specialist → 15-1221.00 Computer and Information Research Scientists). The mappings are team judgements.

This includes information from the [O*NET 31.0 Database](https://www.onetcenter.org/database.html) by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license. Changes: rescaled scores and our role-to-occupation mapping. O*NET® is a trademark of USDOL/ETA.

## Courses

Every course URL was opened on **2026-10-20**, and its title, provider, cost and duration were read from the provider's page.

- **Providers:** Kaggle Learn, Cisco Networking Academy, Microsoft Learn, UiPath Academy, HubSpot Academy, Anthropic Academy, GitHub Skills, Canva Design School, freeCodeCamp, Harvard CS50x, University of Helsinki (Elements of AI, Ethics of AI), LearnFree, GHG Protocol, Coursera and edX courses from universities and Google, and a SEDA solar PV course at Pahang Skills Development Centre.
- **`cost`:** `free` means free to take, including any certificate. `low` means Coursera or edX, where the certificate is paid (a subscription or a per-course fee), auditing is sometimes free, and financial aid exists. `hrdc_claimable` means the provider's page says the course is HRD Corp (HRDF) claimable; approval is per run, so the notes say to confirm before applying.
- **`hours`:** the provider's stated time, or a total computed from stated module times or weeks × hours per week. `hours_estimated: true` marks our estimate where the provider gives no total (for example Elements of AI and LearnFree Excel).
- **`skills` / `requires`:** the team maps each course to catalog skills, and `requires` lists assumed skills, used to order pathways.

**Left out because they couldn't be verified on 2026-10-20:** an OpenWHO hand-hygiene course (page not found), Cisco's Introduction to IoT (empty page), the MIT supply chain course on edX (404), and a specific AI Untuk Rakyat course URL. Most skills without a course are clinical, agricultural or practical skills that need formal training or work experience; the pathway says so.
