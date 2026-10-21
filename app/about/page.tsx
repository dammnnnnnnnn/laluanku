import { count, countDistinct, eq, max } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { courses, roles, signals, skillEmbeddings, skills } from "@/lib/db/schema";
import { fmt, t, type Strings } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { runpodConfig } from "@/lib/runpod";
import { DEFAULT_MODEL } from "@/lib/signals/tag-claude";
import { REPO_URL } from "../site-nav";
import { PageBody, PageHero } from "../ui";

export const metadata = { title: "About · LaluanKu" };

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<Hero s={t("en")} />}>
        <AboutContent />
      </Suspense>
    </main>
  );
}

function Hero({ s }: { s: Strings }) {
  return (
    <PageHero
      eyebrow={s.aboutEyebrow}
      title={
        <>
          {s.aboutHeroA} <span className="text-pr">{s.aboutHeroB}</span>
        </>
      }
      intro={s.aboutIntro}
    />
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

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card flex flex-col gap-3 ${className}`}>
      <h2 className="text-[17px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-normal text-mu marker:text-pr">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
}

function ModelRow({ tag, text, on, onLabel, offLabel }: { tag: string; text: string; on: boolean; onLabel: string; offLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-2xl bg-sf2 px-4 py-3.5 text-sm leading-normal">
      <span className="rounded-lg bg-soft px-2.5 py-1 font-mono text-xs font-semibold text-pr">{tag}</span>
      <span className="min-w-0 flex-[1_1_260px]">{text}</span>
      <span className={`text-[13px] font-semibold ${on ? "text-up" : "text-am"}`}>● {on ? onLabel : offLabel}</span>
    </div>
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
  const principles = [s.aboutP1, s.aboutP2, s.aboutP3, s.aboutP4, s.aboutP5];

  return (
    <div lang={locale}>
      <Hero s={s} />
      <PageBody className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        {principles.map((p, i) => (
          <div key={p} className="card flex flex-col gap-2">
            <span className="font-mono text-xs font-semibold text-pr">{String(i + 1).padStart(2, "0")}</span>
            <p className="text-sm leading-normal">{p}</p>
          </div>
        ))}

        <Card title={s.aboutModelsTitle} className="col-span-full">
          <ModelRow tag="LLM" text={fmt(s.aboutModelLlm, { model: llmModel, status: llmOn ? s.aboutModelLlmOn : s.aboutModelLlmOff })} on={llmOn} onLabel={s.aboutModelLlmOn} offLabel={s.aboutFallback} />
          <ModelRow
            tag="EMB"
            text={fmt(s.aboutModelEmb, { model: rp?.model ?? "BAAI/bge-m3", status: rp ? fmt(s.aboutModelEmbOn, { n: counts?.embeddings ?? 0 }) : s.aboutModelEmbOff })}
            on={Boolean(rp)}
            onLabel={s.aboutModelLlmOn}
            offLabel={s.aboutFallback}
          />
          <p className="text-[13px] text-mu">{s.aboutModelNone}</p>
        </Card>

        <section className="flex flex-col gap-4 rounded-3xl bg-pr p-6 text-pri">
          <h2 className="text-[17px] font-semibold">{s.aboutDataTitle}</h2>
          {counts && (
            <dl className="grid grid-cols-2 gap-3">
              {(
                [
                  [counts.signals, s.liveSignals],
                  [counts.roles, s.homeStatRoles],
                  [counts.courses, s.homeStatCourses],
                  [17, "SDGs"],
                ] as const
              ).map(([n, label]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="text-[13px] opacity-85">{label}</dt>
                  <dd className="text-3xl font-extrabold">{n}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link href="/signals" className="text-sm font-semibold underline">
            {s.navSignals} →
          </Link>
        </section>

        <Card title={s.aboutDataTitle} className="md:col-span-2">
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
        </Card>

        <Card title={s.aboutFairnessTitle}>
          <List items={[s.aboutF1, s.aboutF2, s.aboutF3, s.aboutF4]} />
        </Card>

        <Card title={s.aboutPrivacyTitle}>
          <List items={[s.aboutPr1, s.aboutPr2]} />
        </Card>

        <Card title={s.aboutLimitsTitle}>
          <List items={[s.aboutL1, s.aboutL2, s.aboutL3, s.aboutL4, s.aboutL5]} />
        </Card>

        <Card title={s.aboutAttributionTitle} className="col-span-full">
          <p className="text-sm text-mu">{s.aboutBuiltBy}</p>
          <OnetAttribution />
          <p className="text-sm text-mu">{s.aboutSdgIcons}</p>
          <p className="text-sm">
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-pr">
              {s.aboutSource} ↗
            </a>
          </p>
        </Card>
      </PageBody>
    </div>
  );
}

/** Attribution wording required by the O*NET licence (kept in English, as published). */
function OnetAttribution() {
  return (
    <p lang="en" className="text-sm text-mu">
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

