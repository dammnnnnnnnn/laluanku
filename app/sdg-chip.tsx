import type { Locale } from "@/lib/i18n";
import { SDG_GOALS } from "@/lib/sdg";

// Dark text on light SDG colours (e.g. SDG 7 yellow), white on the rest, for readable contrast.
function textColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

/**
 * An SDG badge in the goal's official colour. The goal name shows from the sm breakpoint up;
 * on phones only the number shows (the name stays available to screen readers and as a tooltip).
 */
export function SdgChip({ goal, title, compact = false, locale = "en" }: { goal: number; title?: string; compact?: boolean; locale?: Locale }) {
  const g = SDG_GOALS[goal];
  if (!g) return null;
  const name = locale === "ms" ? g.ms : g.en;
  return (
    <span
      title={title ?? `SDG ${g.id}: ${name}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: g.color, color: textColor(g.color) }}
    >
      <span className="font-bold">
        <span className="sr-only">SDG </span>
        {g.id}
      </span>
      {!compact && <span className="sr-only sm:not-sr-only">{name}</span>}
    </span>
  );
}
