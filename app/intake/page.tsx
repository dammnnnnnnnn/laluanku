import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { getSampleDrafts, getSkillCatalog } from "@/lib/intake/catalog";
import { DbError } from "../db-error";
import { IntakeWizard } from "./intake-wizard";

export const metadata = { title: "Build your profile · LaluanKu" };

export default function IntakePage() {
  const s = t("en");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">{s.resultsLoading}</p>}>
        <IntakeContent />
      </Suspense>
    </main>
  );
}

async function IntakeContent() {
  await connection();
  const { s, locale } = await getStrings();
  let data: { catalog: Awaited<ReturnType<typeof getSkillCatalog>>; samples: Awaited<ReturnType<typeof getSampleDrafts>> };
  try {
    const db = getDb();
    const [catalog, samples] = await Promise.all([getSkillCatalog(db), getSampleDrafts(db)]);
    data = { catalog, samples };
  } catch (err) {
    return <DbError s={s} err={err} where="intake page" />;
  }
  return (
    <div lang={locale}>
      <IntakeWizard catalog={data.catalog} samples={data.samples} locale={locale} />
    </div>
  );
}
