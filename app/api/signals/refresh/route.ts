import { checkAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { runRefreshPipeline } from "@/lib/refresh-pipeline";
import { RefreshInProgressError } from "@/lib/signals/refresh";

// Pulls configured feeds, tags new items, stores accepted ones as signals and re-snapshots rankings.
// Admin only: send `Authorization: Bearer <ADMIN_TOKEN>`.
export async function POST(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const summary = await runRefreshPipeline(getDb());
    return Response.json(summary);
  } catch (err) {
    if (err instanceof RefreshInProgressError) return Response.json({ error: err.message }, { status: 409 });
    console.error("signal refresh failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Refresh failed. Existing signals are unchanged." }, { status: 500 });
  }
}
