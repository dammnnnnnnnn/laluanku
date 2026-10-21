import { count, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { roles } from "@/lib/db/schema";
import { t } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { getSampleDrafts, getSkillCatalog } from "@/lib/intake/catalog";
import { DbError } from "../db-error";
import { PageBody, PageHero } from "../ui";
import { IntakeWizard } from "./intake-wizard";

export const metadata = { title: "Build your profile · LaluanKu" };

export default function IntakePage() {
  const s = t("en");
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <PageHero title={s.intakeTitle} intro={s.intakeIntro}>
            <p className="mt-4 text-sm text-mu">{s.resultsLoading}</p>
          </PageHero>
        }
      >
        <IntakeContent />
      </Suspense>
    </main>
  );
}

async function IntakeContent() {
  await connection();
  const { s, locale } = await getStrings();
  let data: { catalog: Awaited<ReturnType<typeof getSkillCatalog>>; samples: Awaited<ReturnType<typeof getSampleDrafts>>; roleCount: number };
  try {
    const db = getDb();
    const [catalog, samples, [{ n }]] = await Promise.all([
      getSkillCatalog(db),
      getSampleDrafts(db),
      db.select({ n: count() }).from(roles).where(eq(roles.outlook, "emerging")),
    ]);
    data = { catalog, samples, roleCount: n };
  } catch (err) {
    return (
      <>
        <PageHero title={s.intakeTitle} intro={s.intakeIntro} />
        <PageBody>
          <DbError s={s} err={err} where="intake page" />
        </PageBody>
      </>
    );
  }
  return (
    <div lang={locale}>
      <IntakeWizard catalog={data.catalog} samples={data.samples} locale={locale} roleCount={data.roleCount} />
    </div>
  );
}
