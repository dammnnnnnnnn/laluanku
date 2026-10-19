import { SDG_GOALS } from "@/lib/sdg";

// Dark text on light SDG colours (e.g. SDG 7 yellow), white on the rest, for readable contrast.
function textColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111111" : "#ffffff";
}

/** An SDG badge in the goal's official colour, with its name. */
export function SdgChip({ goal, title, compact = false }: { goal: number; title?: string; compact?: boolean }) {
  const g = SDG_GOALS[goal];
  if (!g) return null;
  return (
    <span
      title={title ?? `SDG ${g.id}: ${g.en}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: g.color, color: textColor(g.color) }}
    >
      <span className="font-bold">{g.id}</span>
      {!compact && <span>{g.en}</span>}
    </span>
  );
}
