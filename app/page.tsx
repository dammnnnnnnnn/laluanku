import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { loadHomeData, type HomeData } from "@/lib/home";
import { fmt, t, type Locale, type Strings } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { SDG_GOALS } from "@/lib/sdg";
import { DbError } from "./db-error";
import { LiveFeed } from "./live-feed";
import { btnPrimary, btnSecondary } from "./ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<Hero s={t("en")} data={null} />}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

async function HomeContent() {
  await connection();
  const { s, locale } = await getStrings();
  let data: HomeData | null = null;
  let error: unknown = null;
  try {
    data = await loadHomeData(getDb());
  } catch (err) {
    error = err;
  }
  return (
    <div lang={locale} className="flex flex-col">
      <Hero s={s} data={data} />
      {error ? (
        <div className="wrap py-8">
          <DbError s={s} err={error} where="home page" />
        </div>
      ) : null}
      <WhyNow s={s} />
      {data && <Radar s={s} data={data} />}
      {data && <SdgGrid s={s} locale={locale} linked={data.linkedGoals} />}
    </div>
  );
}

function Hero({ s, data }: { s: Strings; data: HomeData | null }) {
  const audience = [s.homeAudience1, s.homeAudience2, s.homeAudience3, s.homeAudience4];
  return (
    <section className="bg-hero border-b border-ln">
      <div className="wrap grid items-center gap-12 pt-14 pb-16 sm:pt-16 sm:pb-18 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-6">
          <h1 className="text-[clamp(44px,6.5vw,80px)] leading-[0.98] font-extrabold tracking-[-0.05em] text-balance">
            {s.homeHeroA} <span className="text-pr">{s.homeHeroB}</span>
          </h1>
          <p className="max-w-[560px] text-lg leading-relaxed text-mu">{s.homeHeroText}</p>
          <ul className="flex flex-wrap gap-2">
            {audience.map((a) => (
              <li key={a} className="rounded-full border border-ln bg-sf px-3.5 py-1.5 text-[13px] font-semibold">
                {a}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/intake" className={`${btnPrimary} px-6 py-[15px] text-base`}>
              {s.homeCta}
            </Link>
            <Link href="/results" className={`${btnSecondary} px-6 py-[15px] text-base`}>
              {s.resultsTrySample}
            </Link>
          </div>
          {data && (
            <dl className="flex flex-wrap gap-8 border-t border-ln pt-5">
              {(
                [
                  [data.counts.roles, s.homeStatRoles],
                  [data.counts.signals, s.homeStatSignals],
                  [data.counts.courses, s.homeStatCourses],
                ] as const
              ).map(([n, label]) => (
                <div key={label} className="flex flex-col-reverse">
                  <dt className="text-[13px] text-mu">{label}</dt>
                  <dd className="text-3xl font-extrabold tracking-[-0.03em]">{n}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {data && <LiveFeed s={s} feed={data.feed} total={data.counts.signals} newThisWeek={data.newThisWeek} lastFetched={data.lastFetched?.toISOString() ?? null} />}
      </div>
    </section>
  );
}

function WhyNow({ s }: { s: Strings }) {
  const stats = [
    ["56%", s.homeWhyStat1, s.homeWhyStat1Source],
    ["600,000+", s.homeWhyStat2, s.homeWhyStat2Source],
  ] as const;
  return (
    <section className="wrap grid gap-5 pt-16 md:grid-cols-[1fr_2fr] md:items-center">
      <div>
        <span className="eyebrow">{s.homeWhyEyebrow}</span>
        <h2 className="mt-2 text-[clamp(26px,3vw,34px)] leading-tight font-bold tracking-[-0.03em]">{s.tagline}</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map(([n, text, source]) => (
          <div key={n} className="card flex flex-col gap-2">
            <b className="text-4xl font-extrabold tracking-[-0.03em] text-pr">{n}</b>
            <p className="text-[15px] leading-normal">{text}</p>
            <p className="mt-auto font-mono text-xs text-mu">{source}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Radar({ s, data }: { s: Strings; data: HomeData }) {
  const max = Math.max(...data.rising.map((x) => x.value), ...data.declining.map((x) => -x.value), 1);
  const column = (items: HomeData["rising"], up: boolean) => (
    <div className="card flex flex-col gap-4">
      <b className={`text-[17px] font-semibold ${up ? "text-up" : "text-dn"}`}>{up ? `↑ ${s.radarRisingSkills}` : `↓ ${s.radarDecliningSkills}`}</b>
      {items.map((k) => (
        <div key={k.name} className="flex items-center gap-3">
          <span className={`flex size-7 flex-none items-center justify-center rounded-lg text-[13px] font-bold ${up ? "bg-upbg text-up" : "bg-dnbg text-dn"}`} aria-hidden>
            {up ? "↑" : "↓"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{k.name}</div>
            <div className="mt-1.5 h-1.5 rounded-md bg-sf2">
              <div className={`h-full rounded-md ${up ? "bg-up" : "bg-dn"}`} style={{ width: `${Math.max(6, Math.round((Math.abs(k.value) / max) * 100))}%` }} />
            </div>
          </div>
        </div>
      ))}
      {!up && (
        <Link href="/signals" className="mt-auto text-sm font-semibold text-pr">
          {s.radarSeeSignals} →
        </Link>
      )}
    </div>
  );
  return (
    <section className="wrap flex flex-col gap-7 pt-16">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex-[1_1_420px]">
          <span className="eyebrow">{s.radarEyebrow}</span>
          <h2 className="mt-2 text-[clamp(26px,3vw,34px)] leading-tight font-bold tracking-[-0.03em]">{s.radarHeading}</h2>
        </div>
        <p className="flex-[1_1_320px] leading-relaxed text-mu">{s.radarIntro}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {column(data.rising, true)}
        {column(data.declining, false)}
      </div>
    </section>
  );
}

function SdgGrid({ s, locale, linked }: { s: Strings; locale: Locale; linked: number[] }) {
  const on = new Set(linked);
  return (
    <section className="wrap pt-5 pb-18">
      <div className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <h2 className="text-[17px] font-semibold">{s.sdgGridTitle}</h2>
          <span className="text-sm text-mu">{fmt(s.sdgGridText, { n: on.size })}</span>
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
          {Object.values(SDG_GOALS).map((g) => {
            const name = locale === "ms" ? g.ms : g.en;
            return (
              <li key={g.id} title={`SDG ${g.id}: ${name}`} className={on.has(g.id) ? "" : "opacity-35 grayscale-[40%]"}>
                <Image src={`/sdg/goal-${String(g.id).padStart(2, "0")}.png`} alt={`SDG ${g.id}: ${name}`} width={240} height={240} className="aspect-square w-full rounded-xl" />
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-mu">{s.aboutSdgIcons}</p>
      </div>
    </section>
  );
}
