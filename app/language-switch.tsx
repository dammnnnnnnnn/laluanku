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
      className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium dark:border-zinc-700"
      aria-label={next === "ms" ? "Tukar ke Bahasa Melayu" : "Switch to English"}
      lang={next}
    >
      {next === "ms" ? "BM" : "EN"}
    </button>
  );
}
