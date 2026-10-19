import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSignalsVersion } from "./context";
import { buildRanking, diffRankings, headlineChange } from "./diff";

const weights = { skill: 0.55, demand: 0.45, interest: 0 };
const role = (id: number, skill: number, demand: number, outlook: "emerging" | "declining" = "emerging") => ({
  id,
  outlook,
  skill: { score: skill },
  interest: null,
  demand: { m: { normalized: demand } },
});

describe("buildRanking", () => {
  it("ranks emerging roles only, by score", () => {
    const r = buildRanking([role(1, 0.2, 0.9), role(2, 0.9, 0.9), role(3, 1, 1, "declining")], "m", weights, [5, 3]);
    assert.deepEqual(
      r.roles.map((x) => [x.roleId, x.rank]),
      [
        [1, 2],
        [2, 1],
        [3, null],
      ],
    );
    assert.deepEqual(r.signalIds, [3, 5]);
  });
});

describe("diffRankings", () => {
  const before = buildRanking([role(1, 0.5, 0.5), role(2, 0.5, 0.4), role(3, 0.5, 0.3)], "m", weights, [1, 2]);
  const after = buildRanking([role(1, 0.5, 0.5), role(2, 0.5, 0.4), role(3, 0.5, 0.9)], "m", weights, [1, 2, 7, 8]);

  it("reports rank moves, demand deltas and new signals", () => {
    const d = diffRankings(before, after, new Date("2026-10-20T00:00:00Z"));
    assert.deepEqual(d.newSignalIds, [7, 8]);
    assert.equal(d.removedSignalCount, 0);
    const r3 = d.changes.find((c) => c.roleId === 3)!;
    assert.equal(r3.prevRank, 3);
    assert.equal(r3.currRank, 1);
    assert.ok(Math.abs(r3.demandDelta - 0.6) < 1e-9);
    assert.deepEqual(d.changes.map((c) => c.roleId), [3, 1, 2]); // ordered by current rank
  });

  it("headlines the biggest climb into the top 3", () => {
    const d = diffRankings(before, after, new Date());
    assert.equal(headlineChange(d)?.roleId, 3);
    assert.equal(headlineChange(diffRankings(before, before, new Date())), null);
  });
});

describe("computeSignalsVersion", () => {
  const s = (id: number, strength = 3) => ({ id, direction: "emerging" as const, strength, publishedDate: "2026-01-01", roleIds: [2, 1], skillIds: [] });
  it("is order-independent and changes when a signal is added or re-tagged", () => {
    assert.equal(computeSignalsVersion([s(1), s(2)]), computeSignalsVersion([s(2), s(1)]));
    assert.notEqual(computeSignalsVersion([s(1)]), computeSignalsVersion([s(1), s(2)]));
    assert.notEqual(computeSignalsVersion([s(1)]), computeSignalsVersion([s(1, 4)]));
  });
});
