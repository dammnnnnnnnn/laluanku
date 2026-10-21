import Link from "next/link";
import { connection } from "next/server";
import { t, type Locale, type Strings } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { LanguageSwitch } from "./language-switch";
import { NavPills, PillLinks } from "./nav-pills";
import { ThemeToggle } from "./theme-toggle";

export const REPO_URL = "https://github.com/dammnnnnnnnn/laluanku";

/** "laluan" + accent "ku", the wordmark used in the nav and footer. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-[-0.04em] ${className}`}>
      laluan<span className="text-pr">ku</span>
    </span>
  );
}

function NavBar({ s, locale }: { s: Strings; locale: Locale | null }) {
  // locale is null in the loading fallback, where the current path is not read yet.
  const links = [
    { href: "/", label: s.navHome },
    { href: "/intake", label: s.navIntake },
    { href: "/results", label: s.navResults },
    { href: "/signals", label: s.navSignals },
    { href: "/about", label: s.navAbout },
  ];
  return (
    <nav className="wrap flex flex-wrap items-center gap-x-7 gap-y-3 py-3.5" aria-label={s.navMain}>
      <Link href="/" className="text-[21px]" aria-label={s.appName}>
        <Wordmark />
      </Link>
      {locale ? <NavPills links={links} /> : <PillLinks links={links} activeHref={null} />}
      <div className="ml-auto flex items-center gap-2.5">
        <ThemeToggle s={s} />
        {locale && <LanguageSwitch locale={locale} />}
      </div>
    </nav>
  );
}

/** Static English nav shown while the language cookie is read. */
export function SiteNavFallback() {
  return <NavBar s={t("en")} locale={null} />;
}

export async function SiteNav() {
  await connection();
  const locale = await getLocale();
  return <NavBar s={t(locale)} locale={locale} />;
}

function Footer({ s }: { s: Strings }) {
  return (
    <div className="wrap flex flex-wrap items-center gap-x-4 gap-y-2 py-6 text-[13px] text-mu">
      <Link href="/" className="text-[15px] text-ink">
        <Wordmark />
      </Link>
      <span>{s.footerCredit}</span>
      <span className="ml-auto flex flex-wrap gap-x-5 gap-y-1">
        <Link href="/about" className="hover:text-ink">
          {s.footerAi}
        </Link>
        <Link href="/signals" className="hover:text-ink">
          {s.navSignals}
        </Link>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
          {s.aboutSource} ↗
        </a>
      </span>
    </div>
  );
}

export function SiteFooterFallback() {
  return <Footer s={t("en")} />;
}

export async function SiteFooter() {
  await connection();
  return <Footer s={t(await getLocale())} />;
}
