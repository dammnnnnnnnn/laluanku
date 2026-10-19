import { checkAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";
import { RefreshInProgressError, refreshSignals } from "@/lib/signals/refresh";

// Pulls configured feeds, tags new items and stores accepted ones as signals.
// Admin only: send `Authorization: Bearer <ADMIN_TOKEN>`.
export async function POST(request: Request) {
  const auth = checkAdmin(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });

  try {
    const summary = await refreshSignals(getDb());
    return Response.json(summary);
  } catch (err) {
    if (err instanceof RefreshInProgressError) return Response.json({ error: err.message }, { status: 409 });
    console.error("signal refresh failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Refresh failed. Existing signals are unchanged." }, { status: 500 });
  }
}
