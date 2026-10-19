// Turns a role's skills gap into an ordered learning plan using ONLY courses from the catalog.
// Deterministic and explainable: no course, duration or cost is ever generated.

export type Cost = "free" | "low" | "hrdc_claimable";

export type CatalogCourse = {
  id: number;
  slug: string;
  title: string;
  provider: string;
  url: string;
  cost: Cost;
  hours: number;
  hoursEstimated: boolean;
  language: string;
  skillIds: number[];
  requiresSkillIds: number[];
  notes: string;
  verifiedAt: string | null;
};

/** practiceOnly: a human skill (e.g. problem solving) that no course is picked for on its own. */
export type GapSkill = { skillId: number; importance: number; practiceOnly?: boolean };

export type Alternative = { course: CatalogCourse; withinBudget: boolean };

export type PathwayStep = {
  order: number;
  course: CatalogCourse;
  /** Gap skills this course closes in this plan. */
  covers: number[];
  startWeek: number;
  endWeek: number;
  /** Other catalog courses for the same skills, so the person can choose. */
  alternatives: Alternative[];
};

export type Pathway = {
  steps: PathwayStep[];
  /** Gap skills no catalog course covers (yet). */
  uncovered: GapSkill[];
  /** Gap skills only coverable by a course above the person's budget, with that course. */
  overBudget: { skill: GapSkill; course: CatalogCourse }[];
  /** Human skills best built through practice and work experience. */
  practice: GapSkill[];
  totalHours: number;
  totalWeeks: number;
  hoursPerWeek: number;
  costCounts: Record<Cost, number>;
  anyEstimatedHours: boolean;
};

export const ALLOWED_COSTS: Record<Cost, Cost[]> = {
  free: ["free"],
  low: ["free", "low"],
  hrdc_claimable: ["free", "low", "hrdc_claimable"],
};

const COST_RANK: Record<Cost, number> = { free: 0, hrdc_claimable: 1, low: 2 };
const MAX_ALTERNATIVES = 2;

/**
 * 1. Greedy cover: repeatedly pick the allowed course that closes the most important remaining
 *    gaps per unit of time (importance / √hours), preferring free and then shorter courses.
 *    A course is never picked only for practice-only (human) skills.
 * 2. Order: most important gap first, quick wins before long courses, then move any course
 *    after the step that teaches a skill it requires.
 * 3. Schedule back to back at the person's hours per week.
 */
export function buildPathway(input: { gaps: GapSkill[]; courses: CatalogCourse[]; budget: Cost; hoursPerWeek: number }): Pathway {
  const allowed = new Set(ALLOWED_COSTS[input.budget]);
  const hoursPerWeek = Math.max(1, Math.round(input.hoursPerWeek));
  const gapById = new Map(input.gaps.map((g) => [g.skillId, g]));
  const remaining = new Set(input.gaps.map((g) => g.skillId));
  const picked: { course: CatalogCourse; covers: number[] }[] = [];
  const usable = input.courses.filter((c) => allowed.has(c.cost));

  for (;;) {
    let best: { course: CatalogCourse; covers: number[]; score: number } | null = null;
    for (const course of usable) {
      if (picked.some((p) => p.course.id === course.id)) continue;
      const covers = course.skillIds.filter((id) => remaining.has(id));
      const main = covers.filter((id) => !gapById.get(id)?.practiceOnly);
      if (main.length === 0) continue;
      const value = covers.reduce((s, id) => s + (gapById.get(id)!.importance * (gapById.get(id)!.practiceOnly ? 0.5 : 1)), 0);
      const score = value / Math.sqrt(Math.max(1, course.hours));
      const better =
        !best ||
        score > best.score + 1e-9 ||
        (Math.abs(score - best.score) <= 1e-9 &&
          (COST_RANK[course.cost] - COST_RANK[best.course.cost] || course.hours - best.course.hours || course.id - best.course.id) < 0);
      if (better) best = { course, covers, score };
    }
    if (!best) break;
    picked.push({ course: best.course, covers: best.covers });
    for (const id of best.covers) remaining.delete(id);
  }

  const importanceOf = (id: number) => gapById.get(id)?.importance ?? 0;
  const maxImportance = (covers: number[]) => Math.max(...covers.map(importanceOf));
  picked.sort((a, b) => maxImportance(b.covers) - maxImportance(a.covers) || a.course.hours - b.course.hours || a.course.id - b.course.id);

  // Prerequisites: a course goes after the step that teaches a skill it assumes.
  for (let guard = 0; guard < picked.length * picked.length; guard++) {
    let moved = false;
    for (let i = 0; i < picked.length && !moved; i++) {
      for (const req of picked[i].course.requiresSkillIds) {
        const j = picked.findIndex((p) => p.covers.includes(req));
        if (j > i) {
          const [step] = picked.splice(i, 1);
          picked.splice(j, 0, step);
          moved = true;
          break;
        }
      }
    }
    if (!moved) break;
  }

  const pickedIds = new Set(picked.map((p) => p.course.id));
  let cumulative = 0;
  const steps: PathwayStep[] = picked.map((p, i) => {
    const startWeek = Math.floor(cumulative / hoursPerWeek) + 1;
    cumulative += p.course.hours;
    const endWeek = Math.max(startWeek, Math.ceil(cumulative / hoursPerWeek));
    const alternatives = input.courses
      .filter((c) => !pickedIds.has(c.id) && c.skillIds.some((id) => p.covers.includes(id)))
      .map((c) => ({ course: c, withinBudget: allowed.has(c.cost) }))
      .sort((a, b) => Number(b.withinBudget) - Number(a.withinBudget) || COST_RANK[a.course.cost] - COST_RANK[b.course.cost] || a.course.hours - b.course.hours)
      .slice(0, MAX_ALTERNATIVES);
    return { order: i + 1, course: p.course, covers: p.covers, startWeek, endWeek, alternatives };
  });

  const overBudget: Pathway["overBudget"] = [];
  const uncovered: GapSkill[] = [];
  const practice: GapSkill[] = [];
  for (const g of input.gaps.filter((x) => remaining.has(x.skillId))) {
    if (g.practiceOnly) {
      practice.push(g);
      continue;
    }
    const course = input.courses
      .filter((c) => !allowed.has(c.cost) && c.skillIds.includes(g.skillId))
      .sort((a, b) => COST_RANK[a.cost] - COST_RANK[b.cost] || a.hours - b.hours)[0];
    if (course) overBudget.push({ skill: g, course });
    else uncovered.push(g);
  }

  const costCounts: Record<Cost, number> = { free: 0, low: 0, hrdc_claimable: 0 };
  for (const s of steps) costCounts[s.course.cost]++;

  return {
    steps,
    uncovered,
    overBudget,
    practice,
    totalHours: cumulative,
    totalWeeks: steps.length ? Math.ceil(cumulative / hoursPerWeek) : 0,
    hoursPerWeek,
    costCounts,
    anyEstimatedHours: steps.some((s) => s.course.hoursEstimated),
  };
}

/** Week-by-week view: which steps are active in each week. */
export function weeklySchedule(p: Pathway): { week: number; steps: number[] }[] {
  return Array.from({ length: p.totalWeeks }, (_, i) => {
    const week = i + 1;
    return { week, steps: p.steps.filter((s) => s.startWeek <= week && week <= s.endWeek).map((s) => s.order) };
  });
}
