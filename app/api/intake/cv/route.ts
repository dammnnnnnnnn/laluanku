import { getDb } from "@/lib/db";
import { getSkillCatalog } from "@/lib/intake/catalog";
import { MAX_CV_BYTES, extractProfileFromCv, isPdf } from "@/lib/intake/extract-cv";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// Extracts a profile draft from an uploaded CV. The file is read into memory, sent for
// extraction and discarded: it is never written to disk or the database, and never logged.
export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "cv"), 10, 60 * 60_000);
  if (!limit.ok) {
    return Response.json({ error: "Too many CV uploads. Please try again later." }, { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_CV_BYTES + 64 * 1024) return Response.json({ error: "The file is larger than 5 MB." }, { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Send the CV as multipart form data in a field named cv." }, { status: 400 });
  }
  const file = form.get("cv");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_CV_BYTES) return Response.json({ error: "The file is larger than 5 MB." }, { status: 413 });
  if (file.type && file.type !== "application/pdf") return Response.json({ error: "Only PDF files are accepted." }, { status: 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(bytes)) return Response.json({ error: "That file is not a valid PDF." }, { status: 415 });

  try {
    const catalog = await getSkillCatalog(getDb());
    const result = await extractProfileFromCv(bytes, catalog);
    return Response.json(result);
  } catch (err) {
    console.error("cv extraction failed:", err instanceof Error ? err.message.split("\n")[0] : "unknown error");
    return Response.json({ error: "We couldn't read that PDF. Try another file or use the form instead." }, { status: 422 });
  }
}
