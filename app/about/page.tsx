import { count, countDistinct, eq, max } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { courses, roles, signals, skillEmbeddings, skills } from "@/lib/db/schema";
import { fmt, t } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { runpodConfig } from "@/lib/runpod";
import { DEFAULT_MODEL } from "@/lib/signals/tag-claude";

export const metadata = { title: "About · LaluanKu" };

const REPO_URL = "https://github.com/dammnnnnnnnn/laluanku";

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">{t("en").resultsLoading}</p>}>
        <AboutContent />
      </Suspense>
    </main>
  );
}

type Counts = { signals: number; sources: number; lastFetched: Date | null; roles: number; skills: number; courses: number; embeddings: number };

async function loadCounts(model: string | null): Promise<Counts | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const db = getDb();
    const [[sig], [rol], [ski], [cou], [emb]] = await Promise.all([
      db.select({ n: count(), sources: countDistinct(signals.sourceName), last: max(signals.fetchedAt) }).from(signals),
      db.select({ n: count() }).from(roles),
      db.select({ n: count() }).from(skills),
      db.select({ n: count() }).from(courses),
      db.select({ n: count() }).from(skillEmbeddings).where(eq(skillEmbeddings.model, model ?? "")),
    ]);
    return { signals: sig.n, sources: sig.sources, lastFetched: sig.last, roles: rol.n, skills: ski.n, courses: cou.n, embeddings: emb.n };
  } catch {
    return null;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

async function AboutContent() {
  await connection();
  const { s, locale } = await getStrings();
  const llmModel = process.env.AI_MODEL || DEFAULT_MODEL;
  const llmOn = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const rp = runpodConfig();
  const counts = await loadCounts(rp?.model ?? null);
  const date = counts?.lastFetched
    ? new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(counts.lastFetched)
    : "–";

  return (
    <div lang={locale} className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{s.aboutTitle}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">{s.aboutIntro}</p>
      </header>

      <Section title={s.aboutPrinciplesTitle}>
        <List items={[s.aboutP1, s.aboutP2, s.aboutP3, s.aboutP4, s.aboutP5]} />
      </Section>

      <Section title={s.aboutModelsTitle}>
        <List
          items={[
            fmt(s.aboutModelLlm, { model: llmModel, status: llmOn ? s.aboutModelLlmOn : s.aboutModelLlmOff }),
            fmt(s.aboutModelEmb, {
              model: rp?.model ?? "BAAI/bge-m3",
              status: rp ? fmt(s.aboutModelEmbOn, { n: counts?.embeddings ?? 0 }) : s.aboutModelEmbOff,
            }),
            s.aboutModelNone,
          ]}
        />
      </Section>

      <Section title={s.aboutDataTitle}>
        <List
          items={[
            ...(counts
              ? [
                  fmt(s.aboutDataSignals, { n: counts.signals, sources: counts.sources, date }),
                  fmt(s.aboutDataRoles, { roles: counts.roles, skills: counts.skills }),
                  fmt(s.aboutDataCourses, { n: counts.courses }),
                ]
              : []),
            s.aboutDataSdg,
            s.aboutDataSamples,
          ]}
        />
        <p className="text-sm">
          <Link href="/signals" className="text-emerald-700 underline dark:text-emerald-400">
            {s.navSignals}
          </Link>
        </p>
      </Section>

      <Section title={s.aboutFairnessTitle}>
        <List items={[s.aboutF1, s.aboutF2, s.aboutF3, s.aboutF4]} />
      </Section>

      <Section title={s.aboutPrivacyTitle}>
        <List items={[s.aboutPr1, s.aboutPr2]} />
      </Section>

      <Section title={s.aboutLimitsTitle}>
        <List items={[s.aboutL1, s.aboutL2, s.aboutL3, s.aboutL4, s.aboutL5]} />
      </Section>

      <Section title={s.aboutAttributionTitle}>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{s.aboutBuiltBy}</p>
        <OnetAttribution />
        <p className="text-sm">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline dark:text-emerald-400">
            {s.aboutSource} ↗
          </a>
        </p>
      </Section>
    </div>
  );
}

/** Attribution wording required by the O*NET licence (kept in English, as published). */
function OnetAttribution() {
  return (
    <p lang="en" className="text-sm text-zinc-700 dark:text-zinc-300">
      This page includes information from the{" "}
      <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noopener noreferrer" className="underline">
        O*NET 31.0 Database
      </a>{" "}
      by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the{" "}
      <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer" className="underline">
        CC BY 4.0
      </a>{" "}
      license. LaluanKu mapped each role to its closest O*NET occupation and rescaled the interest scores. O*NET® is a trademark of USDOL/ETA.
    </p>
  );
}

