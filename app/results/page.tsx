import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { DEFAULT_SAMPLE, loadResults, type ResultsData } from "@/lib/scoring/results";
import { DbError } from "../db-error";
import { PageBody, PageHero } from "../ui";
import { ResultsView } from "./results-view";

export const metadata = { title: "Your future roles · LaluanKu" };

export default function ResultsPage({ searchParams }: PageProps<"/results">) {
  const s = t("en");
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <PageHero eyebrow={s.navResults} title={s.resultsTitle}>
            <p className="mt-4 text-sm text-mu">{s.resultsLoading}</p>
          </PageHero>
        }
      >
        <ResultsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResultsContent({ searchParams }: { searchParams: PageProps<"/results">["searchParams"] }) {
  await connection();
  const { s, locale } = await getStrings();
  const params = await searchParams;
  const profileRef = typeof params.profile === "string" && params.profile ? params.profile : DEFAULT_SAMPLE;

  let data: ResultsData | null = null;
  let error: unknown = null;
  try {
    data = await loadResults(getDb(), profileRef);
  } catch (err) {
    error = err;
  }
  if (!data) {
    return (
      <>
        <PageHero eyebrow={s.navResults} title={s.resultsTitle} />
        <PageBody>{error ? <DbError s={s} err={error} where="results page" /> : <p className="text-sm">{s.resultsNoProfile}</p>}</PageBody>
      </>
    );
  }

  return (
    <div lang={locale}>
      <ResultsView data={data} s={s} locale={locale} />
    </div>
  );
}
