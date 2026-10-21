import type { Locale } from "@/lib/i18n";
import { SDG_GOALS } from "@/lib/sdg";

// Dark text on light SDG colours (e.g. SDG 7 yellow), white on the rest, for readable contrast.
function textColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

/**
 * An SDG badge in the goal's official colour: "SDG 8", plus the goal name when `named`.
 * The name always stays available to screen readers and as a tooltip.
 */
export function SdgChip({ goal, title, named = false, locale = "en" }: { goal: number; title?: string; named?: boolean; locale?: Locale }) {
  const g = SDG_GOALS[goal];
  if (!g) return null;
  const name = locale === "ms" ? g.ms : g.en;
  return (
    <span
      title={title ?? `SDG ${g.id}: ${name}`}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-[3px] text-[11px] font-semibold"
      style={{ backgroundColor: g.color, color: textColor(g.color) }}
    >
      SDG {g.id}
      {named ? <span>· {name}</span> : <span className="sr-only">: {name}</span>}
    </span>
  );
}

/** An SDG target number ("4.4") in its goal's colour. */
export function SdgTarget({ goal, target, title }: { goal: number; target: string; title?: string }) {
  const color = SDG_GOALS[goal]?.color ?? "#666666";
  return (
    <span title={title} className="h-fit flex-none rounded-lg px-2 py-[3px] text-xs font-bold" style={{ backgroundColor: color, color: textColor(color) }}>
      {target}
    </span>
  );
}
