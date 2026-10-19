// Configured trend-signal sources pulled by "Refresh signals". Add or remove feeds here.

export type RssFeed = {
  kind: "rss";
  key: string;
  name: string;
  url: string;
  sourceType: "news" | "research";
  maxItems: number;
  maxAgeDays: number;
};

// New `release_YYYY_MM_DD` folders in a Hugging Face dataset become candidate signals.
export type HfReleasesFeed = {
  kind: "hf-releases";
  key: string;
  name: string;
  dataset: string;
  sourceType: "dataset";
  // Releases on or before this date are already covered by curated seed signals.
  coveredUntil: string;
};

export type FeedConfig = RssFeed | HfReleasesFeed;

function googleNews(query: string): string {
  const q = encodeURIComponent(`${query} when:30d`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-MY&gl=MY&ceid=MY:en`;
}

export const FEEDS: FeedConfig[] = [
  {
    kind: "rss",
    key: "gnews-my-ai-jobs",
    name: "Google News: AI and jobs in Malaysia",
    url: googleNews('(AI OR "artificial intelligence") (jobs OR workers OR reskilling OR upskilling) Malaysia'),
    sourceType: "news",
    maxItems: 15,
    maxAgeDays: 45,
  },
  {
    kind: "rss",
    key: "gnews-my-green-jobs",
    name: "Google News: green jobs in Malaysia",
    url: googleNews('Malaysia ("green jobs" OR "renewable energy" OR solar OR "energy transition") (jobs OR skills OR talent)'),
    sourceType: "news",
    maxItems: 10,
    maxAgeDays: 45,
  },
  {
    kind: "rss",
    key: "gnews-my-care-workforce",
    name: "Google News: care and health workforce in Malaysia",
    url: googleNews('Malaysia (nurses OR caregivers OR "aged care" OR "healthcare workers") (shortage OR demand OR training)'),
    sourceType: "news",
    maxItems: 8,
    maxAgeDays: 45,
  },
  {
    kind: "rss",
    key: "gnews-my-talent-policy",
    name: "Google News: Malaysian talent and skills policy",
    url: googleNews('Malaysia (TalentCorp OR MyMahir OR "HRD Corp" OR TVET) (skills OR reskilling OR "critical occupations")'),
    sourceType: "news",
    maxItems: 8,
    maxAgeDays: 45,
  },
  {
    kind: "rss",
    key: "arxiv-genai-labour",
    name: "arXiv: generative AI and labour markets",
    url: "https://export.arxiv.org/api/query?search_query=abs:%22labor+market%22+AND+abs:%22generative+AI%22&sortBy=submittedDate&sortOrder=descending&max_results=10",
    sourceType: "research",
    maxItems: 6,
    maxAgeDays: 120,
  },
  {
    kind: "hf-releases",
    key: "hf-anthropic-economic-index",
    name: "Anthropic Economic Index (Hugging Face dataset)",
    dataset: "Anthropic/EconomicIndex",
    sourceType: "dataset",
    coveredUntil: "2025-09-15",
  },
];
