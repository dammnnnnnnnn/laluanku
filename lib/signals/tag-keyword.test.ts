// The keyword fallback tagger on real headlines it once got wrong (direction, digests,
// other-country news, and AI/automation marked as "declining" when it is the cause).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import rolesJson from "../../seed/roles.json";
import skillsJson from "../../seed/skills.json";
import type { FeedItem } from "./fetch";
import { KeywordTagger, skipReason } from "./tag-keyword";
import type { Catalog } from "./types";

const catalog: Catalog = {
  roles: rolesJson.map((r, i) => ({ id: i + 1, slug: r.slug, title: r.title, sector: r.sector, outlook: r.outlook })),
  skills: skillsJson.map((s, i) => ({ id: i + 1, slug: s.slug, name: s.name, category: s.category })),
};
const roleSlug = new Map(catalog.roles.map((r) => [r.id, r.slug]));
const skillSlug = new Map(catalog.skills.map((s) => [s.id, s.slug]));

async function tag(title: string) {
  const item: FeedItem = { externalId: title, feedKey: "test", title, url: "https://example.com", sourceName: "Test", sourceType: "news", publishedDate: "2026-10-16", snippet: "" };
  const [out] = await new KeywordTagger().tag([item], catalog);
  assert.ok(out.ok);
  const p = out.proposal;
  return { ...p, roles: p.roleIds.map((id) => roleSlug.get(id)), skills: p.skillIds.map((id) => skillSlug.get(id)) };
}

describe("keyword tagger", () => {
  it("reads job cuts as declining", async () => {
    const p = await tag("Malaysian solar firm sheds 400 jobs as orders fall");
    assert.equal(p.direction, "declining");
  });

  it("skips news digests", async () => {
    const p = await tag("Top News Today: Korean Chip Stocks, Young VC Leadership, AI Jobs, Bitcoin, Claude Security");
    assert.equal(p.relevant, false);
    assert.ok(skipReason("Morning Brief: AI jobs, oil, ringgit, Bursa"));
  });

  it("skips items about another country only", async () => {
    assert.equal((await tag("PH welcomes ASEAN delegates for regional dialogue on green jobs, future skills")).relevant, false);
    assert.equal((await tag("China solar giants shed another 40,000 jobs last year as overcapacity persists")).relevant, false);
  });

  it("keeps foreign news with a Malaysian angle", async () => {
    const p = await tag("Zahid wants China's TVET training model in Malaysia's rural areas");
    assert.equal(p.relevant, true);
    assert.deepEqual(p.roles, ["skills-trainer"]);
  });

  it("does not mark AI or automation as declining when it is the cause", async () => {
    const p = await tag("Ten per cent of Malaysian jobs face AI-related automation risks - Economy Minister");
    assert.equal(p.direction, "declining");
    assert.ok(!p.skills.includes("process-automation"));
    assert.equal(p.relevant, false, "nothing specific is left to mark as declining");
  });

  it("still tags ordinary Malaysian headlines", async () => {
    const p = await tag("Health Ministry to speed up nurse recruitment, strengthen staff retention");
    assert.equal(p.relevant, true);
    assert.equal(p.direction, "emerging");
    assert.deepEqual(p.roles, ["nursing-professional"]);
    assert.ok(!skipReason("Join us: Budget 2027 boosts TVET training places"));
  });
});
