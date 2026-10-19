import { asc, eq, or } from "drizzle-orm";
import { courses, profiles, skills } from "../db/schema";
import type { AnyDb } from "../db/types";
import { loadScoringContext, profileSkillsFor, scoreProfile, type RoleResult } from "../scoring/context";
import { goalOfTarget } from "../sdg";
import { buildPathway, weeklySchedule, type CatalogCourse, type Pathway } from "./engine";

export type SdgContribution = { target: string; goal: number; reason: string };

export type PathwayData = {
  profile: { ref: string; displayName: string; isSample: boolean; hoursPerWeek: number; budget: CatalogCourse["cost"] };
  role: RoleResult;
  scenarioKey: string;
  pathway: Pathway;
  schedule: { week: number; steps: number[] }[];
  skillNames: Record<number, string>;
  /** Targets this path contributes to, with a plain-language reason each. */
  contributions: SdgContribution[];
  /** SDGs reached through the specific skills this path builds. */
  skillGoals: { goal: number; skills: string[] }[];
  coursesVerifiedAt: string | null;
};

/** Builds the learning path for one role and one profile (sample key or public id). */
export async function loadPathway(db: AnyDb, roleSlug: string, profileRef: string): Promise<PathwayData | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(or(eq(profiles.sampleKey, profileRef), eq(profiles.publicId, profileRef)))
    .limit(1);
  if (!profile) return null;

  const [ctx, courseRows, skillRows] = await Promise.all([
    loadScoringContext(db),
    db.select().from(courses).orderBy(asc(courses.id)),
    db.select({ id: skills.id, name: skills.name, category: skills.category, sdgIds: skills.sdgIds }).from(skills),
  ]);
  const role = scoreProfile(ctx, profileSkillsFor(ctx, profile.extractedJson), profile.riasec).find((r) => r.slug === roleSlug);
  if (!role) return null;

  const scenarioKey = ctx.scenarios[0]?.key ?? "moderate_2030";
  const budget = profile.extractedJson.budget;
  const hoursPerWeek = profile.extractedJson.hoursPerWeek;
  // Human skills (communication, problem solving…) are built through practice, not a course on their own.
  const categoryOf = new Map(skillRows.map((s) => [s.id, s.category]));
  const pathway = buildPathway({
    gaps: role.skill.missing.map((g) => ({ ...g, practiceOnly: categoryOf.get(g.skillId) === "human" })),
    courses: courseRows.map((c) => ({ ...c, slug: c.slug ?? `course-${c.id}` })),
    budget,
    hoursPerWeek,
  });

  const skillById = new Map(skillRows.map((s) => [s.id, s]));
  const skillNames = Object.fromEntries(skillRows.map((s) => [s.id, s.name]));
  const builtSkills = pathway.steps.flatMap((s) => s.covers);
  const demand = role.demand[scenarioKey];

  const contributions: SdgContribution[] = [];
  const add = (target: string, reason: string) => {
    if (!contributions.some((c) => c.target === target)) contributions.push({ target, goal: goalOfTarget(target), reason });
  };
  if (builtSkills.length > 0) {
    add("4.4", `Builds ${builtSkills.length} job-relevant skill${builtSkills.length > 1 ? "s" : ""}: ${builtSkills.map((id) => skillNames[id]).join(", ")}.`);
    const affordable = pathway.steps.filter((s) => s.course.cost !== "low").length;
    add(
      "4.3",
      `Lifelong learning you can afford: ${pathway.costCounts.free} of ${pathway.steps.length} course${pathway.steps.length > 1 ? "s are" : " is"} free` +
        (pathway.costCounts.hrdc_claimable ? `, ${pathway.costCounts.hrdc_claimable} HRD Corp claimable` : "") +
        (affordable < pathway.steps.length ? `, the rest low cost.` : "."),
    );
  }
  if (role.outlook === "emerging" && demand && demand.normalized >= 0.5) {
    add("8.5", `Moves you toward a role with rising demand (${Math.round(demand.normalized * 100)}/100 in the moderate scenario), supporting full and productive employment.`);
  }
  if (role.aiExposure === "high" || builtSkills.some((id) => (skillById.get(id)?.sdgIds ?? []).includes(9))) {
    add("8.2", "Builds digital and technical skills that raise productivity through technology and innovation.");
  }
  for (const target of role.sdgTargets) add(target, role.sdgReason);

  const byGoal = new Map<number, string[]>();
  for (const id of builtSkills) {
    for (const goal of skillById.get(id)?.sdgIds ?? []) {
      byGoal.set(goal, [...(byGoal.get(goal) ?? []), skillNames[id]]);
    }
  }
  const skillGoals = [...byGoal.entries()].map(([goal, list]) => ({ goal, skills: list })).sort((a, b) => a.goal - b.goal);

  const verified = courseRows.map((c) => c.verifiedAt).filter((d): d is string => Boolean(d)).sort();

  return {
    profile: {
      ref: profileRef,
      displayName: profile.extractedJson.displayName,
      isSample: profile.isSample,
      hoursPerWeek,
      budget,
    },
    role,
    scenarioKey,
    pathway,
    schedule: weeklySchedule(pathway),
    skillNames,
    contributions,
    skillGoals,
    coursesVerifiedAt: verified.at(-1) ?? null,
  };
}
