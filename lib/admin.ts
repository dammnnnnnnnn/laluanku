import { createHash, timingSafeEqual } from "node:crypto";

const digest = (s: string) => createHash("sha256").update(s).digest();

export type AdminCheck = { ok: true } | { ok: false; status: 401 | 503; error: string };

/** Checks `Authorization: Bearer <ADMIN_TOKEN>` in constant time. */
export function checkAdmin(request: Request): AdminCheck {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return { ok: false, status: 503, error: "ADMIN_TOKEN is not configured on the server." };
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !timingSafeEqual(digest(token), digest(expected))) {
    return { ok: false, status: 401, error: "Invalid admin token." };
  }
  return { ok: true };
}
