import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPathway, weeklySchedule, type CatalogCourse } from "./engine";

const course = (id: number, skillIds: number[], hours: number, cost: CatalogCourse["cost"] = "free"): CatalogCourse => ({
  id,
  slug: `c${id}`,
  title: `Course ${id}`,
  provider: "Test",
  url: `https://example.org/${id}`,
  cost,
  hours,
  hoursEstimated: false,
  language: "en",
  skillIds,
  requiresSkillIds: [],
  notes: "",
  verifiedAt: "2026-10-20",
});

describe("buildPathway", () => {
  const courses = [course(1, [10, 11], 9), course(2, [10], 2), course(3, [11], 2), course(4, [12], 5, "low"), course(5, [13], 40, "hrdc_claimable")];

  it("covers every coverable gap with catalog courses only", () => {
    const p = buildPathway({ gaps: [{ skillId: 10, importance: 3 }, { skillId: 11, importance: 2 }], courses, budget: "free", hoursPerWeek: 4 });
    const covered = p.steps.flatMap((s) => s.covers).sort();
    assert.deepEqual(covered, [10, 11]);
    assert.ok(p.steps.every((s) => courses.includes(s.course)));
    assert.deepEqual(p.uncovered, []);
  });

  it("prefers short courses per unit of importance and orders the most important gap first", () => {
    const p = buildPathway({ gaps: [{ skillId: 10, importance: 3 }, { skillId: 11, importance: 2 }], courses, budget: "free", hoursPerWeek: 4 });
    // c2 (3/√2 ≈ 2.12) beats c1 (5/√9 ≈ 1.67); then c3 closes skill 11.
    assert.deepEqual(p.steps.map((s) => s.course.id), [2, 3]);
    assert.equal(p.totalHours, 4);
    assert.equal(p.totalWeeks, 1);
  });

  it("respects the budget and reports what is over budget or missing", () => {
    const gaps = [{ skillId: 12, importance: 2 }, { skillId: 13, importance: 3 }, { skillId: 99, importance: 1 }];
    const free = buildPathway({ gaps, courses, budget: "free", hoursPerWeek: 5 });
    assert.equal(free.steps.length, 0);
    assert.deepEqual(free.overBudget.map((o) => o.course.id).sort(), [4, 5]);
    assert.deepEqual(free.uncovered.map((u) => u.skillId), [99]);

    const hrdc = buildPathway({ gaps, courses, budget: "hrdc_claimable", hoursPerWeek: 5 });
    assert.deepEqual(hrdc.steps.map((s) => s.course.id), [5, 4]);
    assert.equal(hrdc.costCounts.hrdc_claimable, 1);
  });

  it("puts a course after the step that teaches its prerequisite", () => {
    const python = course(20, [30], 5);
    const pandas = { ...course(21, [31], 4), requiresSkillIds: [30] };
    const p = buildPathway({ gaps: [{ skillId: 31, importance: 3 }, { skillId: 30, importance: 2 }], courses: [python, pandas], budget: "free", hoursPerWeek: 5 });
    assert.deepEqual(p.steps.map((s) => s.course.id), [20, 21]);
  });

  it("never picks a course only for practice-only skills, and lists them separately", () => {
    const long = course(30, [40, 41], 100);
    const p = buildPathway({ gaps: [{ skillId: 40, importance: 2, practiceOnly: true }], courses: [long], budget: "free", hoursPerWeek: 5 });
    assert.equal(p.steps.length, 0);
    assert.deepEqual(p.practice.map((g) => g.skillId), [40]);
    assert.deepEqual(p.uncovered, []);
  });

  it("offers alternatives for each step, within budget first", () => {
    const p = buildPathway({ gaps: [{ skillId: 10, importance: 3 }], courses, budget: "free", hoursPerWeek: 4 });
    assert.deepEqual(p.steps[0].alternatives.map((a) => [a.course.id, a.withinBudget]), [[1, true]]);
  });

  it("schedules steps back to back by hours per week", () => {
    const p = buildPathway({ gaps: [{ skillId: 12, importance: 2 }, { skillId: 13, importance: 3 }], courses, budget: "hrdc_claimable", hoursPerWeek: 10 });
    assert.deepEqual(p.steps.map((s) => [s.startWeek, s.endWeek]), [[1, 4], [5, 5]]);
    const weeks = weeklySchedule(p);
    assert.equal(weeks.length, 5);
    assert.deepEqual(weeks[4].steps, [2]);
  });
});
