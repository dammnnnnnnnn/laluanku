"use client";

import { useSyncExternalStore } from "react";
import type { Strings } from "@/lib/i18n";
import { THEME_KEY } from "@/lib/theme";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Re-renders when data-theme on <html> or the system colour scheme changes. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

/** Light/dark switch. Without a saved choice the site follows the system setting. */
export function ThemeToggle({ s }: { s: Strings }) {
  // null on the server, where the theme isn't known yet.
  const theme = useSyncExternalStore<Theme | null>(subscribe, currentTheme, () => null);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be blocked; the switch still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={s.themeToggle}
      className="min-h-9 rounded-full border border-ln bg-sf2 px-3.5 py-2 text-[13px] font-medium text-ink"
    >
      ◐ {theme === "dark" ? s.themeLight : s.themeDark}
    </button>
  );
}
