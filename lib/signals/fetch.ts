import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import type { FeedConfig, HfReleasesFeed, RssFeed } from "./feeds";

export type FeedItem = {
  externalId: string;
  feedKey: string;
  title: string;
  url: string;
  sourceName: string;
  sourceType: "news" | "research" | "dataset";
  publishedDate: string; // YYYY-MM-DD
  snippet: string;
};

const USER_AGENT = "LaluanKu/0.1 (career navigator; https://github.com/dammnnnnnnnn/laluanku)";
const TIMEOUT_MS = 15_000;
const MAX_SNIPPET = 1500;

async function get(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return res.text();
}

const shortHash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return text((value as { "#text": unknown })["#text"]);
  return "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

function isRecent(date: string, maxAgeDays: number): boolean {
  return Date.now() - new Date(date).getTime() <= maxAgeDays * 86_400_000;
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

type XmlNode = Record<string, unknown>;

/** Parses RSS 2.0 or Atom into feed items (newest first). */
export function parseFeedXml(xml: string, feed: RssFeed): FeedItem[] {
  const doc = parser.parse(xml) as XmlNode;
  const channel = (doc.rss as XmlNode | undefined)?.channel as XmlNode | undefined;
  const rssItems = asArray(channel?.item as XmlNode | XmlNode[] | undefined);
  const atomEntries = asArray((doc.feed as XmlNode | undefined)?.entry as XmlNode | XmlNode[] | undefined);
  const items: FeedItem[] = [];

  for (const it of rssItems) {
    const link = text(it.link);
    const guid = text(it.guid) || link;
    const publishedDate = toIsoDate(text(it.pubDate));
    let title = stripHtml(text(it.title));
    const source = it.source as XmlNode | string | undefined;
    const sourceName = stripHtml(text(source)) || feed.name;
    // Google News appends " - Publisher" to titles; the publisher is already in <source>.
    if (sourceName && title.endsWith(` - ${sourceName}`)) title = title.slice(0, -(sourceName.length + 3));
    if (!title || !link || !publishedDate) continue;
    items.push({
      externalId: `${feed.key}:${shortHash(guid)}`,
      feedKey: feed.key,
      title,
      url: link,
      sourceName,
      sourceType: feed.sourceType,
      publishedDate,
      snippet: stripHtml(text(it.description)).slice(0, MAX_SNIPPET),
    });
  }

  for (const entry of atomEntries) {
    const links = asArray(entry.link as XmlNode | XmlNode[] | undefined);
    const alternate = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
    const link = alternate ? text(alternate["@_href"]) : "";
    const id = text(entry.id) || link;
    const publishedDate = toIsoDate(text(entry.published) || text(entry.updated));
    const title = stripHtml(text(entry.title));
    if (!title || !link || !publishedDate) continue;
    items.push({
      externalId: `${feed.key}:${shortHash(id)}`,
      feedKey: feed.key,
      title,
      url: link,
      sourceName: feed.name,
      sourceType: feed.sourceType,
      publishedDate,
      snippet: stripHtml(text(entry.summary)).slice(0, MAX_SNIPPET),
    });
  }

  return items
    .filter((i) => isRecent(i.publishedDate, feed.maxAgeDays))
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, feed.maxItems);
}

async function fetchRss(feed: RssFeed): Promise<FeedItem[]> {
  return parseFeedXml(await get(feed.url), feed);
}

async function fetchHfReleases(feed: HfReleasesFeed): Promise<FeedItem[]> {
  const tree = JSON.parse(await get(`https://huggingface.co/api/datasets/${feed.dataset}/tree/main`)) as {
    type: string;
    path: string;
  }[];
  const releases = tree
    .filter((e) => e.type === "directory")
    .map((e) => ({ path: e.path, m: /^release_(\d{4})_(\d{2})_(\d{2})$/.exec(e.path) }))
    .filter((e): e is { path: string; m: RegExpExecArray } => e.m !== null)
    .map((e) => ({ path: e.path, date: `${e.m[1]}-${e.m[2]}-${e.m[3]}` }))
    .filter((e) => e.date > feed.coveredUntil);

  const items: FeedItem[] = [];
  for (const r of releases) {
    // The release notes give the tagger something to read; fall back to the title alone.
    let snippet = "";
    for (const doc of ["data_documentation.md", "README.md"]) {
      try {
        snippet = (await get(`https://huggingface.co/datasets/${feed.dataset}/raw/main/${r.path}/${doc}`)).slice(0, MAX_SNIPPET);
        break;
      } catch {
        // try the next file
      }
    }
    items.push({
      externalId: `${feed.key}:${r.path}`,
      feedKey: feed.key,
      title: `Anthropic Economic Index: new data release (${r.date})`,
      url: `https://huggingface.co/datasets/${feed.dataset}/tree/main/${r.path}`,
      sourceName: feed.name,
      sourceType: feed.sourceType,
      publishedDate: r.date,
      snippet,
    });
  }
  return items;
}

export function fetchFeed(feed: FeedConfig): Promise<FeedItem[]> {
  return feed.kind === "rss" ? fetchRss(feed) : fetchHfReleases(feed);
}
