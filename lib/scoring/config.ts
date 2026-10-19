// Every constant behind a LaluanKu score lives here, so the formula shown in the UI and
// the code that computes it can't drift apart. These are modelling choices, not facts.

/** Signals lose half their weight every 12 months after publication. */
export const RECENCY_HALF_LIFE_DAYS = 365;

/**
 * Signals linked to a skill (not the role itself) count at half weight, scaled by how
 * important that skill is to the role (importance / 3).
 */
export const SKILL_SIGNAL_FACTOR = 0.5;

/**
 * Skill-level signals together add at most ±2 raw demand to a role (scaled down
 * proportionally above that), so roles built on generic skills such as digital literacy
 * aren't inflated by every reskilling headline.
 */
export const SKILL_PATH_CAP = 2;

/** How much of the scenario multiplier applies, by the role's AI exposure level. */
export const EXPOSURE_WEIGHT = { low: 0, medium: 0.5, high: 1 } as const;

/** raw demand → 0..1 via 0.5 + 0.5·tanh(raw / K); 0.5 means no net signal. */
export const DEMAND_SQUASH_K = 5;

/** Keyword similarity at or above this counts a related skill as covering a requirement. */
export const SKILL_SIMILARITY_THRESHOLD = 0.5;

/** Default weights (CLAUDE.md). The interest weight applies only once the RIASEC quiz exists. */
export const DEFAULT_WEIGHTS = {
  withInterest: { skill: 0.45, demand: 0.35, interest: 0.2 },
  withoutInterest: { skill: 0.55, demand: 0.45, interest: 0 },
} as const;

/** Confidence from signal count and agreement; drives the ± band on demand. */
export const CONFIDENCE = {
  high: { minSignals: 4, minAgreement: 0.7 },
  medium: { minSignals: 2, minAgreement: 0.4 },
  // Half-width of the demand band (0..1 scale) at each level.
  band: { high: 0.05, medium: 0.1, low: 0.18 },
} as const;
