// Small fixed-window rate limiter kept in memory. Enough to stop a public demo from being used to
// run up Claude costs; it resets on restart and is per server instance.
const windows = new Map<string, { start: number; count: number }>();

export function clientKey(request: Request, scope: string): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    return { ok: true, retryAfterSec: 0 };
  }
  if (w.count >= limit) return { ok: false, retryAfterSec: Math.ceil((w.start + windowMs - now) / 1000) };
  w.count++;
  return { ok: true, retryAfterSec: 0 };
}
