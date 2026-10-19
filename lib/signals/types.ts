import type { FeedItem } from "./fetch";

export type CatalogRole = { id: number; slug: string; title: string; sector: string; outlook: string };
export type CatalogSkill = { id: number; slug: string; name: string; category: string };
export type Catalog = { roles: CatalogRole[]; skills: CatalogSkill[] };

// What a tagger proposes for one feed item. Guardrails check it before anything is saved.
export type TagProposal = {
  relevant: boolean;
  reason: string;
  direction: "emerging" | "declining";
  strength: number;
  summary: string;
  roleIds: number[];
  skillIds: number[];
};

export type TagOutcome = { ok: true; proposal: TagProposal } | { ok: false; error: string };

export interface Tagger {
  name: "claude" | "keyword";
  model: string | null;
  tag(items: FeedItem[], catalog: Catalog): Promise<TagOutcome[]>;
}
