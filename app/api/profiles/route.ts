import { randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { getSkillCatalog } from "@/lib/intake/catalog";
import { sanitizeDraft } from "@/lib/intake/sanitize";
import { SaveProfileRequest } from "@/lib/intake/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Saves a profile the user has reviewed and confirmed. Returns the unguessable id for /results.
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "profiles"), 30, 60 * 60_000);
  if (!limit.ok) return Response.json({ error: "Too many profiles created. Please try again later." }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = SaveProfileRequest.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Profile is incomplete or invalid.", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const req = parsed.data;

  const db = getDb();
  const catalog = new Set((await getSkillCatalog(db)).map((s) => s.slug));
  const unknown = req.draft.skills.filter((s) => !catalog.has(s.slug)).map((s) => s.slug);
  if (unknown.length > 0) {
    return Response.json({ error: `Unknown skills: ${unknown.join(", ")}` }, { status: 400 });
  }
  const seen = new Set<string>();
  const draft = sanitizeDraft({ ...req.draft, skills: req.draft.skills.filter((s) => !seen.has(s.slug) && seen.add(s.slug)) });

  // Never store the CV or form text; record only how the profile was made.
  const rawInput =
    req.source === "cv"
      ? `Created from an uploaded CV (file not stored; extraction: ${req.extractionMethod ?? "unknown"}), then reviewed and confirmed by the user.`
      : req.source === "sample"
        ? `Started from sample profile "${req.sampleKey ?? "unknown"}", then reviewed and confirmed by the user.`
        : "Created from the intake form and confirmed by the user.";

  const publicId = randomBytes(12).toString("base64url");
  await db.insert(profiles).values({ publicId, rawInput, extractedJson: draft, riasec: req.riasec, isSample: false });
  return Response.json({ publicId });
}
