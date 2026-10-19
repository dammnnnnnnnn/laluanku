import Link from "next/link";
import { t } from "@/lib/i18n";

export default function Home() {
  const en = t("en");
  const ms = t("ms");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">{en.appName}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        {en.tagline} · {ms.tagline}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/intake" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white">
          {en.intakeTitle} · {ms.intakeTitle}
        </Link>
        <Link href="/results" className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          {en.resultsTrySample} · {ms.resultsTrySample}
        </Link>
        <Link href="/signals" className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
          {en.signalsTitle}
        </Link>
      </div>
      <p className="text-sm text-zinc-500">{en.buildStatus}</p>
      <p className="text-sm text-zinc-500">{ms.buildStatus}</p>
    </main>
  );
}
