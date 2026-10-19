import { z } from "zod";
import { COURSE_COSTS } from "../db/schema";

// A profile draft is what the user reviews and confirms. It matches ExtractedProfile in the DB.
export const SkillEntry = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  evidence: z.string().max(300),
});

export const ProfileDraft = z.object({
  displayName: z.string().trim().min(1).max(60),
  headline: z.string().trim().max(200),
  summary: z.string().trim().max(1000),
  yearsExperience: z.number().min(0).max(60),
  education: z.array(z.string().trim().max(200)).max(10),
  languages: z.array(z.string().trim().max(60)).max(10),
  skills: z.array(SkillEntry).min(1, "Add at least one skill").max(60),
  goals: z.array(z.string().trim().max(200)).max(10),
  hoursPerWeek: z.number().int().min(1).max(60),
  budget: z.enum(COURSE_COSTS),
});
export type ProfileDraft = z.infer<typeof ProfileDraft>;

const unit = z.number().min(0).max(1);
export const RiasecInput = z.object({ R: unit, I: unit, A: unit, S: unit, E: unit, C: unit });

export const SaveProfileRequest = z.object({
  draft: ProfileDraft,
  riasec: RiasecInput.nullable(),
  source: z.enum(["cv", "form", "sample"]),
  sampleKey: z.string().regex(/^[a-z0-9-]+$/).optional(),
  extractionMethod: z.enum(["claude", "keyword"]).optional(),
  confirmed: z.literal(true),
});
export type SaveProfileRequest = z.infer<typeof SaveProfileRequest>;

export type CatalogSkill = { id: number; slug: string; name: string; category: string };

export const DEFAULT_DRAFT: ProfileDraft = {
  displayName: "My profile",
  headline: "",
  summary: "",
  yearsExperience: 0,
  education: [],
  languages: [],
  skills: [],
  goals: [],
  hoursPerWeek: 6,
  budget: "free",
};
