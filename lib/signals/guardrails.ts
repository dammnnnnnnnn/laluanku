import type { FeedItem } from "./fetch";
import type { Catalog, TagProposal } from "./types";

// Ingested items are single news/research items, so they never outweigh curated reports.
export const MAX_INGESTED_STRENGTH = 3;
const MAX_SUMMARY = 400;

export type GuardedResult =
  | { accepted: true; proposal: TagProposal; notes: string[] }
  | { accepted: false; reason: string };

const numbersIn = (s: string) => (s.replace(/(\d),(\d)/g, "$1$2").match(/\d+(?:\.\d+)?/g) ?? []);

/**
 * Enforces the "never invent" rules on a tagger proposal:
 * - only role/skill IDs that exist in our catalog are kept;
 * - an item with no valid catalog links is rejected;
 * - a summary that contains a number not present in the source text is replaced by the title;
 * - strength is clamped to 1..MAX_INGESTED_STRENGTH.
 */
export function applyGuardrails(item: FeedItem, p: TagProposal, catalog: Catalog): GuardedResult {
  if (!p.relevant) return { accepted: false, reason: p.reason || "not relevant to jobs or skills" };

  const notes: string[] = [];
  const roleSet = new Set(catalog.roles.map((r) => r.id));
  const skillSet = new Set(catalog.skills.map((s) => s.id));
  const roleIds = [...new Set(p.roleIds)].filter((id) => roleSet.has(id));
  const skillIds = [...new Set(p.skillIds)].filter((id) => skillSet.has(id));
  const dropped = p.roleIds.length + p.skillIds.length - roleIds.length - skillIds.length;
  if (dropped > 0) notes.push(`dropped ${dropped} unknown catalog id(s)`);
  if (roleIds.length === 0 && skillIds.length === 0) {
    return { accepted: false, reason: "no matching roles or skills in the catalog" };
  }

  const sourceNumbers = new Set(numbersIn(`${item.title} ${item.snippet}`));
  let summary = p.summary.trim().slice(0, MAX_SUMMARY);
  const invented = numbersIn(summary).filter((n) => !sourceNumbers.has(n));
  if (!summary || invented.length > 0) {
    if (invented.length > 0) notes.push(`summary had numbers not in the source (${invented.join(", ")}); used the headline instead`);
    summary = item.title;
  }

  const strength = Math.min(MAX_INGESTED_STRENGTH, Math.max(1, Math.round(p.strength)));

  return { accepted: true, proposal: { ...p, roleIds, skillIds, summary, strength }, notes };
}
