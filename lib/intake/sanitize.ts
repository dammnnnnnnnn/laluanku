// Removes information that must never be a scoring input or be stored: age, gender, ethnicity,
// religion, marital status, date of birth, identity numbers and contact details.
// Applied to every free-text field, whatever produced it (Claude, keyword fallback or the form).
import type { ProfileDraft } from "./schema";

const SENSITIVE: RegExp[] = [
  /\b\d{1,2}\s*(years?|yrs?)\s*old\b/i,
  /\b(aged?|umur|usia)\s*:?\s*\d{1,2}\b/i,
  /\b\d{1,2}\s*tahun\b/i,
  /\b(date of birth|d\.?o\.?b\.?|born (on|in)|tarikh lahir)\b/i,
  /\b(male|female|man|woman|lelaki|perempuan|wanita|gender|jantina|sex)\b/i,
  /\b(malay|chinese|indian|bumiputera?|kadazan|iban|dayak|orang asli|ethnicity|race|bangsa|keturunan)\b/i,
  /\b(muslim|islam|christian|buddhist|hindu|sikh|taoist|religion|agama)\b/i,
  /\b(married|divorced|widowed|berkahwin|bujang|marital|single (mother|father|parent))\b/i,
  /\b(mykad|ic (no|number)|nric|passport (no|number)|no\.? kad pengenalan)\b/i,
  /\b\d{6}-\d{2}-\d{4}\b/, // MyKad number
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /(\+?6?0)[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{4}/, // Malaysian mobile number
];

/** Drops any sentence or list item that mentions a sensitive attribute. */
export function stripSensitive(text: string): string {
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .filter((part) => !SENSITIVE.some((re) => re.test(part)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSensitive(text: string): boolean {
  return SENSITIVE.some((re) => re.test(text));
}

export function sanitizeDraft(draft: ProfileDraft): ProfileDraft {
  const clean = (s: string) => stripSensitive(s);
  const list = (xs: string[]) => xs.map(clean).filter(Boolean);
  return {
    ...draft,
    displayName: isSensitive(draft.displayName) ? "My profile" : draft.displayName.trim(),
    headline: clean(draft.headline),
    summary: clean(draft.summary),
    education: list(draft.education),
    // Languages are kept: they are a skill (multilingual communication), not a scoring input on their own.
    languages: draft.languages.map((l) => l.trim()).filter(Boolean),
    goals: list(draft.goals),
    skills: draft.skills.map((s) => ({ ...s, evidence: clean(s.evidence) })),
  };
}
