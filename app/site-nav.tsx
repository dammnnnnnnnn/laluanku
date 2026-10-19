import Link from "next/link";
import { connection } from "next/server";
import { t, type Locale, type Strings } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { LanguageSwitch } from "./language-switch";

const linkClass = "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

function NavLinks({ s, locale }: { s: Strings; locale: Locale | null }) {
  return (
    <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm sm:gap-x-6 sm:px-6" aria-label="Main">
      <Link href="/" className="font-semibold">
        {s.appName}
      </Link>
      <Link href="/intake" className={linkClass}>
        {s.navIntake}
      </Link>
      <Link href="/results" className={linkClass}>
        {s.navResults}
      </Link>
      <Link href="/signals" className={linkClass}>
        {s.navSignals}
      </Link>
      <Link href="/about" className={linkClass}>
        {s.navAbout}
      </Link>
      <span className="ml-auto">{locale && <LanguageSwitch locale={locale} />}</span>
    </nav>
  );
}

/** Static English nav shown while the language cookie is read. */
export function SiteNavFallback() {
  return <NavLinks s={t("en")} locale={null} />;
}

export async function SiteNav() {
  await connection();
  const locale = await getLocale();
  return <NavLinks s={t(locale)} locale={locale} />;
}
