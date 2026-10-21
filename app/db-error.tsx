import type { Strings } from "@/lib/i18n";

/** Logs a database failure (without secrets) and shows what the person can do about it. */
export function DbError({ s, err, where }: { s: Strings; err: unknown; where: string }) {
  const configured = Boolean(process.env.DATABASE_URL);
  const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : "";
  console.error(`${where}:`, err instanceof Error ? err.message.split("\n")[0] + cause : err);
  return <p className="rounded-xl bg-ambg px-4 py-3 text-sm text-am">{configured ? s.dbUnavailable : s.dbNotConfigured}</p>;
}
