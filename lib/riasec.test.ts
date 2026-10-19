import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QUESTIONS, RIASEC_TYPES, interestFit, riasecCode, scoreQuiz, sharedTopTypes, type RiasecScores } from "./riasec";

const profile = (p: Partial<RiasecScores>): RiasecScores => ({ R: 0, I: 0, A: 0, S: 0, E: 0, C: 0, ...p });

describe("quiz", () => {
  it("has 18 questions, 3 per type, each bilingual", () => {
    assert.equal(QUESTIONS.length, 18);
    for (const t of RIASEC_TYPES) assert.equal(QUESTIONS.filter((q) => q.type === t).length, 3);
    for (const q of QUESTIONS) assert.ok(q.en && q.ms);
  });

  it("scores all-5 as 1, all-1 as 0, and missing answers as neutral 0.5", () => {
    const all = (v: number) => Object.fromEntries(QUESTIONS.map((q) => [q.id, v]));
    assert.deepEqual(Object.values(scoreQuiz(all(5))), [1, 1, 1, 1, 1, 1]);
    assert.deepEqual(Object.values(scoreQuiz(all(1))), [0, 0, 0, 0, 0, 0]);
    assert.deepEqual(Object.values(scoreQuiz({})), [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  });

  it("derives the code from the top three types", () => {
    assert.equal(riasecCode(profile({ I: 0.9, C: 0.8, R: 0.5, S: 0.1 })), "ICR");
  });
});

describe("interestFit", () => {
  it("is 1 for the same shape, 0 for the opposite shape, 0.5 for a flat profile", () => {
    const a = profile({ R: 1, I: 0.8 });
    assert.ok(Math.abs(interestFit(a, profile({ R: 0.5, I: 0.4 })) - 1) < 1e-9);
    const opposite = profile({ R: 0, I: 0.2, A: 1, S: 1, E: 1, C: 1 });
    assert.ok(interestFit(a, opposite) < 0.2);
    assert.equal(interestFit(profile({ R: 0.5, I: 0.5, A: 0.5, S: 0.5, E: 0.5, C: 0.5 }), a), 0.5);
  });

  it("finds shared top types", () => {
    assert.deepEqual(sharedTopTypes(profile({ I: 1, C: 0.9, S: 0.8 }), profile({ I: 1, C: 0.7, R: 0.6 })), ["I", "C"]);
  });
});
