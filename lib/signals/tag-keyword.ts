import type { FeedItem } from "./fetch";
import type { Catalog, TagOutcome, Tagger } from "./types";

// Deterministic fallback when no Anthropic credentials are configured, so a refresh never
// breaks the demo. It links only on explicit keyword matches and writes no new text:
// the summary is the headline itself.

const ROLE_KEYWORDS: Record<string, string[]> = {
  "data-analyst": ["data analyst", "data scientist", "data analytics", "data science"],
  "bi-analyst": ["business intelligence", "power bi", "dashboard"],
  "ai-ml-specialist": ["machine learning", "ai engineer", "ai specialist", "ai talent", "ai-skilled", "ai professionals"],
  "software-developer": ["software developer", "software engineer", "developers", "programmer", "coding"],
  "information-security-analyst": ["cybersecurity", "cyber security", "information security", "security analyst"],
  "ux-ui-designer": ["ux ", "ui/ux", "user experience", "product design"],
  "iot-specialist": ["internet of things", "iot", "smart manufacturing", "industry 4.0"],
  "devops-engineer": ["devops", "cloud engineer"],
  "process-automation-specialist": ["automation specialist", "process automation", "rpa", "workflow automation"],
  "renewable-energy-engineer": ["renewable energy", "energy transition", "netr", "green jobs"],
  "solar-pv-technician": ["solar"],
  "environmental-engineer": ["environmental engineer", "pollution", "waste management"],
  "sustainability-specialist": ["esg", "sustainability", "carbon", "green jobs", "net-zero", "net zero"],
  "ev-specialist": ["electric vehicle", " ev ", "ev charging", "battery"],
  "nursing-professional": ["nurse", "nursing", "healthcare workers", "health workers"],
  "personal-care-aide": ["caregiver", "aged care", "elderly care", "care worker", "ageing"],
  "social-worker-counsellor": ["social worker", "counsellor", "counselor", "mental health"],
  "smart-farming-technician": ["agritech", "smart farming", "precision agriculture", "agriculture"],
  "supply-chain-specialist": ["supply chain", "logistics"],
  "ecommerce-specialist": ["e-commerce", "ecommerce", "online seller"],
  "digital-marketing-specialist": ["digital marketing", "social media marketing", "content creator"],
  "project-manager": ["project manager", "project management"],
  "ai-governance-specialist": ["ai governance", "ai ethics", "responsible ai", "ai code of ethics", "ai regulation"],
  "skills-trainer": ["trainer", "tvet", "vocational", "upskilling programme", "training programme"],
  "administrative-assistant": ["administrative", "admin staff", "secretar", "clerical"],
  "data-entry-clerk": ["data entry"],
  "bank-teller": ["bank teller", "bank branch"],
  "cashier-ticket-clerk": ["cashier", "self-checkout"],
  "accounting-clerk": ["bookkeep", "payroll", "accounting clerk"],
  "customer-service-worker": ["customer service", "call centre", "call center", "chatbot"],
};

const SKILL_KEYWORDS: Record<string, string[]> = {
  "generative-ai-use": ["generative ai", "genai", "chatgpt", "claude", "ai tools", "ai skills", "ai literacy", "use ai", "ai-skilled", "ai readiness", "economic index"],
  "digital-literacy": ["digital skills", "digital literacy", "digitalisation", "digitalization"],
  "lifelong-learning": ["reskill", "upskill", "lifelong learning", "micro-credential", "short courses", "short-term courses", "training grants"],
  "machine-learning": ["machine learning"],
  "data-analysis": ["data analytics", "data analysis"],
  "cybersecurity": ["cybersecurity", "cyber security"],
  "solar-pv-systems": ["solar"],
  "esg-reporting": ["esg"],
  "elderly-care": ["aged care", "elderly care", "caregiver"],
  "clinical-nursing": ["nurse", "nursing"],
  "process-automation": ["automation"],
  "ai-ethics-governance": ["ai governance", "ai ethics", "responsible ai"],
  "teaching-mentoring": ["trainer", "teacher"],
};

const WORK_WORDS = /\b(jobs?|workers?|workforce|talent|skills?|reskill\w*|upskill\w*|employ\w*|careers?|hiring|recruit\w*|shortage|training|courses?|occupations?|tasks?|pekerja|kemahiran|tvet)\b/i;
const DECLINE_WORDS =
  /\b(replace[sd]?|automation risks?|at risk|lose|losing|lost|cuts?|layoffs?|laid off|retrench\w*|redundan\w*|displace\w*|obsolete|decline\w*|shed\w*|slash\w*|job losses|downsiz\w*|closures?)\b/i;
// News digests ("Top News Today: chip stocks, bitcoin, AI jobs…") mention many topics in passing.
const DIGEST = /\b(top news|news roundup|morning brief\w*|daily brief\w*|week in review)\b/i;
const MALAYSIA = /\b(malaysia\w*|m'sia|sabah|sarawak|selangor|johor|penang|melaka|kuala lumpur|putrajaya|mohr|mosti|hrd corp|talentcorp|perkeso|socso)\b/i;
// Items about another country only (no Malaysian angle) say little about demand here.
const OTHER_COUNTRY = /\b(philippines?|filipino|china|chinese|indonesia\w*|singapore\w*|thailand|thai|vietnam\w*|india|indian|america\w*|britain|british|australia\w*|japan\w*|korea\w*)\b/i;
const OTHER_COUNTRY_ABBR = /\b(PH|US|UK)\b|\bU\.S\./; // case-sensitive, so "us" and "uk" as words don't count

// When AI or automation is the cause of a decline, it is not itself declining: never mark these
// skills or roles as falling because a headline says "jobs at risk from automation".
export const CAUSE_SKILLS = new Set(["generative-ai-use", "process-automation", "machine-learning", "ai-ethics-governance"]);
export const CAUSE_ROLES = new Set(["process-automation-specialist", "ai-ml-specialist", "ai-governance-specialist"]);

function matches(textLower: string, words: string[]): boolean {
  return words.some((w) => textLower.includes(w));
}

/** Why a headline should be skipped before tagging, or null if it is usable. */
export function skipReason(title: string, snippet = ""): string | null {
  if (DIGEST.test(title) || (title.split(":")[1] ?? "").split(/,\s/).length >= 4) return "news digest covering many topics";
  const raw = `${title} ${snippet}`;
  if ((OTHER_COUNTRY.test(raw) || OTHER_COUNTRY_ABBR.test(raw)) && !MALAYSIA.test(raw)) return "about another country, with no Malaysian angle";
  return null;
}

export class KeywordTagger implements Tagger {
  name = "keyword" as const;
  model = null;

  async tag(items: FeedItem[], catalog: Catalog): Promise<TagOutcome[]> {
    return items.map((item) => {
      const raw = `${item.title} ${item.snippet}`;
      const t = ` ${raw.toLowerCase()} `;
      const direction = DECLINE_WORDS.test(raw) ? "declining" : "emerging";
      const isCause = (set: Set<string>, slug: string) => direction === "declining" && set.has(slug);
      const roleIds = catalog.roles.filter((r) => !isCause(CAUSE_ROLES, r.slug) && matches(t, ROLE_KEYWORDS[r.slug] ?? [])).map((r) => r.id);
      const skillIds = catalog.skills.filter((s) => !isCause(CAUSE_SKILLS, s.slug) && matches(t, SKILL_KEYWORDS[s.slug] ?? [])).map((s) => s.id);
      const skip = skipReason(item.title, item.snippet);
      const relevant = !skip && WORK_WORDS.test(raw) && roleIds.length + skillIds.length > 0;
      return {
        ok: true,
        proposal: {
          relevant,
          reason: skip ?? (relevant ? "keyword match on jobs/skills terms" : "no jobs/skills keyword match"),
          direction,
          strength: 1,
          summary: item.title,
          roleIds,
          skillIds,
        },
      };
    });
  }
}
