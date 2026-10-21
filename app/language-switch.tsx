"use client";

import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

/** EN/BM toggle: stores the choice in a cookie for a year and re-renders the page. */
export function LanguageSwitch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const next: Locale = locale === "en" ? "ms" : "en";
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className="min-h-9 rounded-full border border-ln px-3 py-2 text-[13px] font-semibold text-mu"
      aria-label={next === "ms" ? "Tukar ke Bahasa Melayu" : "Switch to English"}
    >
      <span className={locale === "en" ? "text-ink" : ""}>EN</span> | <span className={locale === "ms" ? "text-ink" : ""}>BM</span>
    </button>
  );
}
