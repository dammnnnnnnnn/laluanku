import { count, max } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { profiles, roles, signals } from "@/lib/db/schema";

// Deploy check: is the database reachable and seeded? Reports counts only, never secrets.
export async function GET() {
  await connection();
  if (!process.env.DATABASE_URL) return Response.json({ ok: false, db: "not configured" }, { status: 503 });
  try {
    const db = getDb();
    const [[r], [s], [p]] = await Promise.all([
      db.select({ n: count() }).from(roles),
      db.select({ n: count(), lastFetched: max(signals.fetchedAt) }).from(signals),
      db.select({ n: count() }).from(profiles),
    ]);
    const seeded = r.n > 0;
    return Response.json(
      {
        ok: seeded,
        db: "ok",
        seeded,
        roles: r.n,
        signals: s.n,
        profiles: p.n,
        signalsLastFetched: s.lastFetched,
        claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
        model: process.env.AI_MODEL || "claude-opus-5-5",
      },
      { status: seeded ? 200 : 503 },
    );
  } catch (err) {
    console.error("health check:", err instanceof Error ? err.message.split("\n")[0] : err);
    return Response.json({ ok: false, db: "unreachable or not migrated" }, { status: 503 });
  }
}
