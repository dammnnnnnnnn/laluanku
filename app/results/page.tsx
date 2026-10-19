import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { DEFAULT_SAMPLE, loadResults, type ResultsData } from "@/lib/scoring/results";
import { DbError } from "../db-error";
import { ResultsView } from "./results-view";

export const metadata = { title: "Your future roles · LaluanKu" };

export default function ResultsPage({ searchParams }: PageProps<"/results">) {
  const s = t("en");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">{s.resultsLoading}</p>}>
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

  let data: ResultsData | null;
  try {
    data = await loadResults(getDb(), profileRef);
  } catch (err) {
    return <DbError s={s} err={err} where="results page" />;
  }
  if (!data) return <p className="text-sm">{s.resultsNoProfile}</p>;

  return (
    <div lang={locale}>
      <ResultsView data={data} s={s} locale={locale} />
    </div>
  );
}
