import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { t, type Strings } from "@/lib/i18n";
import { DEFAULT_SAMPLE, loadResults, type ResultsData } from "@/lib/scoring/results";
import { ResultsView } from "./results-view";

export const metadata = { title: "Your future roles · LaluanKu" };

export default function ResultsPage({ searchParams }: PageProps<"/results">) {
  const s = t("en");
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">{s.resultsLoading}</p>}>
        <ResultsContent s={s} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ResultsContent({ s, searchParams }: { s: Strings; searchParams: PageProps<"/results">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const profileRef = typeof params.profile === "string" && params.profile ? params.profile : DEFAULT_SAMPLE;

  let data: ResultsData | null;
  try {
    data = await loadResults(getDb(), profileRef);
  } catch (err) {
    const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : "";
    console.error("results page:", err instanceof Error ? err.message.split("\n")[0] + cause : err);
    return <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{s.signalsDbMissing}</p>;
  }
  if (!data) return <p className="text-sm">{s.resultsNoProfile}</p>;

  return <ResultsView data={data} s={s} />;
}
