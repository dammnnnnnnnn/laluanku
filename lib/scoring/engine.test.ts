import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getSkillSimilarity, keywordSimilarity } from "../embeddings";
import {
  confidenceOf,
  finalScore,
  normalizeDemand,
  recencyDecay,
  roleContributions,
  roleDemand,
  scenarioMultiplier,
  skillMatch,
  type EngineSignal,
} from "./engine";

const asOf = new Date("2026-10-20T00:00:00Z");
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

describe("recencyDecay", () => {
  it("is 1 for today, 0.5 after one half-life, 0.25 after two", () => {
    close(recencyDecay("2026-10-20", asOf), 1);
    close(recencyDecay("2025-10-20", asOf), 0.5);
    close(recencyDecay("2024-10-20", asOf), 0.25); // 730 days
  });
  it("treats future dates as new", () => close(recencyDecay("2027-01-01", asOf), 1));
});

describe("scenarioMultiplier", () => {
  const fast = { key: "fast", aiAdoptionMultiplier: 1.5 };
  it("applies fully to high exposure, half to medium, not at all to low", () => {
    close(scenarioMultiplier({ id: 1, aiExposure: "high" }, fast), 1.5);
    close(scenarioMultiplier({ id: 1, aiExposure: "medium" }, fast), 1.25);
    close(scenarioMultiplier({ id: 1, aiExposure: "low" }, fast), 1);
  });
});

describe("roleContributions and roleDemand", () => {
  const roleSkills = [
    { roleId: 1, skillId: 10, importance: 3 },
    { roleId: 1, skillId: 11, importance: 1 },
  ];
  const signals: EngineSignal[] = [
    { id: 100, publishedDate: "2026-10-20", direction: "emerging", strength: 4, roleIds: [1], skillIds: [10] },
    { id: 101, publishedDate: "2026-10-20", direction: "declining", strength: 2, roleIds: [], skillIds: [11, 10] },
    { id: 102, publishedDate: "2026-10-20", direction: "emerging", strength: 5, roleIds: [2], skillIds: [99] },
  ];

  it("counts a role-level signal fully and a skill-level one at half weight × importance/3, once each", () => {
    const c = roleContributions(1, roleSkills, signals, asOf);
    assert.equal(c.length, 2);
    const direct = c.find((x) => x.signalId === 100)!;
    const viaSkill = c.find((x) => x.signalId === 101)!;
    assert.equal(direct.via, "direct");
    close(direct.value, 4);
    assert.equal(viaSkill.via, 10); // the more important of the two named skills
    close(viaSkill.value, -2 * 0.5 * (3 / 3));
  });

  it("caps the combined skill-level contribution at SKILL_PATH_CAP, scaled proportionally", () => {
    const many: EngineSignal[] = Array.from({ length: 10 }, (_, i) => ({
      id: 200 + i,
      publishedDate: "2026-10-20",
      direction: "emerging" as const,
      strength: 3,
      roleIds: [],
      skillIds: [10],
    }));
    const c = roleContributions(1, roleSkills, many, asOf);
    close(c.reduce((s, x) => s + x.value, 0), 2);
    close(c[0].value, c[9].value);
  });

  it("amplifies declining demand too under fast AI for exposed roles", () => {
    const declining: EngineSignal[] = [{ id: 1, publishedDate: "2026-10-20", direction: "declining", strength: 4, roleIds: [1], skillIds: [] }];
    const c = roleContributions(1, roleSkills, declining, asOf);
    const moderate = roleDemand({ id: 1, aiExposure: "high" }, c, { key: "m", aiAdoptionMultiplier: 1 });
    const fast = roleDemand({ id: 1, aiExposure: "high" }, c, { key: "f", aiAdoptionMultiplier: 1.5 });
    close(moderate.raw, -4);
    close(fast.raw, -6);
    assert.ok(fast.normalized < moderate.normalized);
  });

  it("normalizes to 0.5 with no signals and stays inside (0, 1)", () => {
    close(normalizeDemand(0), 0.5);
    assert.ok(normalizeDemand(1000) <= 1 && normalizeDemand(-1000) >= 0);
  });
});

describe("confidenceOf", () => {
  const c = (value: number) => ({ signalId: 0, value, decay: 1, via: "direct" as const });
  it("is high for many agreeing signals, low for one or conflicting", () => {
    assert.equal(confidenceOf([c(1), c(2), c(1), c(3)]).confidence, "high");
    assert.equal(confidenceOf([c(1)]).confidence, "low");
    assert.equal(confidenceOf([c(2), c(-2), c(1), c(-1)]).confidence, "low");
  });
});

describe("skillMatch", async () => {
  const sim = await getSkillSimilarity([
    { id: 1, name: "Data analysis" },
    { id: 2, name: "SQL and databases" },
    { id: 3, name: "Data analysis and reporting" },
    { id: 4, name: "Cash handling" },
  ]);
  const roleSkills = [
    { roleId: 1, skillId: 1, importance: 3 },
    { roleId: 1, skillId: 2, importance: 1 },
  ];

  it("weights coverage by importance", () => {
    const m = skillMatch(1, roleSkills, [{ skillId: 1, level: 2 }], sim);
    close(m.score, 3 / 4);
    assert.deepEqual(m.missing.map((x) => x.skillId), [2]);
  });

  it("lets a closely related skill cover a requirement and records which one", () => {
    const m = skillMatch(1, roleSkills, [{ skillId: 3, level: 1 }], sim);
    assert.equal(m.covered[0].skillId, 1);
    assert.equal(m.covered[0].viaSkillId, 3);
  });

  it("does not count unrelated skills", () => {
    close(skillMatch(1, roleSkills, [{ skillId: 4, level: 3 }], sim).score, 0);
    assert.ok(keywordSimilarity("Data entry", "Data analysis") < 0.5);
  });
});

describe("finalScore", () => {
  it("uses the no-quiz weights when interest is missing", () => {
    close(finalScore({ skill: 1, demand: 0, interest: null }, { skill: 0.55, demand: 0.45, interest: 0.2 }), 0.55);
  });
  it("renormalizes weights from sliders", () => {
    close(finalScore({ skill: 0.8, demand: 0.4, interest: null }, { skill: 1, demand: 1, interest: 0 }), 0.6);
  });
});
