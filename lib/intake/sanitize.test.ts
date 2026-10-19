import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeDraft, stripSensitive } from "./sanitize";
import { DEFAULT_DRAFT } from "./schema";

describe("stripSensitive", () => {
  it("removes sentences with age, gender, ethnicity, religion, marital status and contact details", () => {
    const text =
      "Admin assistant with 6 years of experience. I am 32 years old. Female, married. Malay Muslim. " +
      "Reach me at siti@example.com or 012-345 6789. Skilled in Excel pivot tables.";
    assert.equal(stripSensitive(text), "Admin assistant with 6 years of experience. Skilled in Excel pivot tables.");
  });

  it("handles BM phrasing and MyKad numbers", () => {
    assert.equal(stripSensitive("Umur 32. Jantina: perempuan. Pembantu tadbir."), "Pembantu tadbir.");
    assert.equal(stripSensitive("IC 900101-14-5678\nTeam lead"), "Team lead");
  });

  it("keeps years of experience", () => {
    assert.equal(stripSensitive("8 years of shop-floor experience."), "8 years of shop-floor experience.");
  });
});

describe("sanitizeDraft", () => {
  it("cleans every free-text field but keeps skills and languages", () => {
    const out = sanitizeDraft({
      ...DEFAULT_DRAFT,
      headline: "Chinese male technician",
      summary: "Fixes machines. Born in 1990.",
      skills: [{ slug: "quality-control", level: 3, evidence: "Runs QC checks. Age: 35" }],
      languages: ["Mandarin", "English"],
    });
    assert.equal(out.headline, "");
    assert.equal(out.summary, "Fixes machines.");
    assert.equal(out.skills[0].evidence, "Runs QC checks.");
    assert.deepEqual(out.languages, ["Mandarin", "English"]);
  });
});
