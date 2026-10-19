// Deterministic, explainable scoring. The LLM never computes scores; it may only explain them.
import type { SkillSimilarity } from "../embeddings";
import {
  CONFIDENCE,
  DEMAND_SQUASH_K,
  EXPOSURE_WEIGHT,
  RECENCY_HALF_LIFE_DAYS,
  FEED_PATH_CAP,
  SKILL_PATH_CAP,
  SKILL_SIGNAL_FACTOR,
  SKILL_SIMILARITY_THRESHOLD,
} from "./config";

export type EngineRole = { id: number; aiExposure: keyof typeof EXPOSURE_WEIGHT };
export type EngineRoleSkill = { roleId: number; skillId: number; importance: number };
export type EngineSignal = {
  id: number;
  publishedDate: string; // YYYY-MM-DD
  direction: "emerging" | "declining";
  strength: number;
  roleIds: number[];
  skillIds: number[];
  /** True for signals ingested from feeds (not the curated seed). */
  fromFeed?: boolean;
};
export type EngineScenario = { key: string; aiAdoptionMultiplier: number };
export type ProfileSkill = { skillId: number; level: number };

export type Confidence = "low" | "medium" | "high";

export type Contribution = {
  signalId: number;
  /** Signed contribution to raw demand before the scenario multiplier. */
  value: number;
  decay: number;
  /** "direct" when the signal names the role, otherwise the skill id it came through. */
  via: "direct" | number;
  fromFeed?: boolean;
};

export type RoleDemand = {
  raw: number; // after scenario multiplier
  baseRaw: number; // before scenario multiplier
  multiplier: number;
  normalized: number; // 0..1
  confidence: Confidence;
  agreement: number; // 0..1
  band: number; // ± half-width on the 0..1 scale
  contributions: Contribution[];
};

export type SkillMatch = {
  score: number; // 0..1, importance-weighted coverage
  covered: { skillId: number; importance: number; viaSkillId: number | null }[];
  missing: { skillId: number; importance: number }[];
};

const DAY_MS = 86_400_000;

/** 0.5^(age / half-life). Future-dated signals count as new. */
export function recencyDecay(publishedDate: string, asOf: Date): number {
  const ageDays = Math.max(0, (asOf.getTime() - new Date(`${publishedDate}T00:00:00Z`).getTime()) / DAY_MS);
  return Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
}

/** Scenario multiplier scaled by AI exposure: 1 + (m − 1) × exposureWeight. */
export function scenarioMultiplier(role: EngineRole, scenario: EngineScenario): number {
  return 1 + (scenario.aiAdoptionMultiplier - 1) * EXPOSURE_WEIGHT[role.aiExposure];
}

export function normalizeDemand(raw: number): number {
  return 0.5 + 0.5 * Math.tanh(raw / DEMAND_SQUASH_K);
}

export function confidenceOf(contributions: Contribution[]): { confidence: Confidence; agreement: number } {
  const total = contributions.reduce((s, c) => s + Math.abs(c.value), 0);
  const agreement = total === 0 ? 0 : Math.abs(contributions.reduce((s, c) => s + c.value, 0)) / total;
  const n = contributions.length;
  const confidence: Confidence =
    n >= CONFIDENCE.high.minSignals && agreement >= CONFIDENCE.high.minAgreement
      ? "high"
      : n >= CONFIDENCE.medium.minSignals && agreement >= CONFIDENCE.medium.minAgreement
        ? "medium"
        : "low";
  return { confidence, agreement };
}

/**
 * Signal contributions to one role, scenario-independent. A signal counts once per role:
 * fully if it names the role, otherwise at SKILL_SIGNAL_FACTOR × (importance / 3) through
 * the most important required skill it names.
 */
export function roleContributions(
  roleId: number,
  roleSkills: EngineRoleSkill[],
  signals: EngineSignal[],
  asOf: Date,
): Contribution[] {
  const importance = new Map(roleSkills.filter((rs) => rs.roleId === roleId).map((rs) => [rs.skillId, rs.importance]));
  const out: Contribution[] = [];
  for (const s of signals) {
    const sign = s.direction === "emerging" ? 1 : -1;
    const decay = recencyDecay(s.publishedDate, asOf);
    if (s.roleIds.includes(roleId)) {
      out.push({ signalId: s.id, value: sign * s.strength * decay, decay, via: "direct", fromFeed: s.fromFeed });
      continue;
    }
    let best: { skillId: number; importance: number } | null = null;
    for (const skillId of s.skillIds) {
      const imp = importance.get(skillId);
      if (imp !== undefined && (!best || imp > best.importance)) best = { skillId, importance: imp };
    }
    if (best) {
      out.push({
        signalId: s.id,
        value: sign * s.strength * decay * SKILL_SIGNAL_FACTOR * (best.importance / 3),
        decay,
        via: best.skillId,
      });
    }
  }
  capGroup(out.filter((c) => c.via !== "direct"), SKILL_PATH_CAP);
  capGroup(out.filter((c) => c.via === "direct" && c.fromFeed), FEED_PATH_CAP);
  return out.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

/** Scales a group of contributions down proportionally so their total magnitude is at most `cap`. */
function capGroup(group: Contribution[], cap: number) {
  const total = group.reduce((sum, c) => sum + Math.abs(c.value), 0);
  if (total <= cap) return;
  const scale = cap / total;
  for (const c of group) c.value *= scale;
}

export function roleDemand(role: EngineRole, contributions: Contribution[], scenario: EngineScenario): RoleDemand {
  const baseRaw = contributions.reduce((s, c) => s + c.value, 0);
  const multiplier = scenarioMultiplier(role, scenario);
  const raw = baseRaw * multiplier;
  const { confidence, agreement } = confidenceOf(contributions);
  return {
    raw,
    baseRaw,
    multiplier,
    normalized: normalizeDemand(raw),
    confidence,
    agreement,
    band: CONFIDENCE.band[confidence],
    contributions,
  };
}

/**
 * Importance-weighted share of the role's required skills the person covers. A requirement
 * is covered by the same skill, or by a related skill with similarity ≥ threshold.
 */
export function skillMatch(
  roleId: number,
  roleSkills: EngineRoleSkill[],
  profile: ProfileSkill[],
  similarity: SkillSimilarity,
): SkillMatch {
  const required = roleSkills.filter((rs) => rs.roleId === roleId);
  const covered: SkillMatch["covered"] = [];
  const missing: SkillMatch["missing"] = [];
  let have = 0;
  let total = 0;
  for (const req of required) {
    total += req.importance;
    let via: number | null | undefined;
    if (profile.some((p) => p.skillId === req.skillId)) {
      via = null;
    } else {
      let bestSim = 0;
      for (const p of profile) {
        const sim = similarity.between(p.skillId, req.skillId);
        if (sim >= SKILL_SIMILARITY_THRESHOLD && sim > bestSim) {
          bestSim = sim;
          via = p.skillId;
        }
      }
    }
    if (via === undefined) {
      missing.push({ skillId: req.skillId, importance: req.importance });
    } else {
      have += req.importance;
      covered.push({ skillId: req.skillId, importance: req.importance, viaSkillId: via });
    }
  }
  const byImportance = (a: { importance: number }, b: { importance: number }) => b.importance - a.importance;
  return { score: total === 0 ? 0 : have / total, covered: covered.sort(byImportance), missing: missing.sort(byImportance) };
}

/** Net outlook for each skill from the signals that name it (decayed, signed strength). */
export function skillOutlook(signals: EngineSignal[], asOf: Date): Map<number, { value: number; signalIds: number[] }> {
  const out = new Map<number, { value: number; signalIds: number[] }>();
  for (const s of signals) {
    const v = (s.direction === "emerging" ? 1 : -1) * s.strength * recencyDecay(s.publishedDate, asOf);
    for (const skillId of s.skillIds) {
      const cur = out.get(skillId) ?? { value: 0, signalIds: [] };
      cur.value += v;
      cur.signalIds.push(s.id);
      out.set(skillId, cur);
    }
  }
  return out;
}

export type Weights = { skill: number; demand: number; interest: number };

/** Weighted final score; weights are renormalized so they always sum to 1. */
export function finalScore(parts: { skill: number; demand: number; interest: number | null }, weights: Weights): number {
  const wInterest = parts.interest === null ? 0 : weights.interest;
  const sum = weights.skill + weights.demand + wInterest;
  if (sum <= 0) return 0;
  return (weights.skill * parts.skill + weights.demand * parts.demand + wInterest * (parts.interest ?? 0)) / sum;
}
