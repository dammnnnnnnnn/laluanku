// Small shared building blocks for the page layout (hero band, badges, buttons).
// No hooks, so they work in both server and client components.

/** The gradient band at the top of each page: eyebrow label, big heading, intro line. */
export function PageHero({
  eyebrow,
  title,
  intro,
  aside,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-hero border-b border-ln">
      <div className="wrap flex flex-wrap items-end gap-x-10 gap-y-6 pt-12 pb-10 sm:pt-14 sm:pb-11">
        <div className="min-w-0 flex-[1_1_480px]">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="mt-2 text-[clamp(34px,4.5vw,52px)] leading-[1.05] font-bold tracking-[-0.035em] text-balance">{title}</h1>
          {intro && <p className="mt-3 max-w-[640px] text-[17px] leading-relaxed text-mu">{intro}</p>}
          {children}
        </div>
        {aside}
      </div>
    </section>
  );
}

/** The main content area under a hero band. */
export function PageBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`wrap pt-10 pb-18 ${className}`}>{children}</section>;
}

type Tone = "up" | "dn" | "am" | "info" | "pr" | "neutral";

const TONES: Record<Tone, string> = {
  up: "bg-upbg text-up",
  dn: "bg-dnbg text-dn",
  am: "bg-ambg text-am",
  info: "bg-infobg text-info",
  pr: "bg-soft text-pr",
  neutral: "bg-sf2 text-ink",
};

/** A small rounded label, e.g. "↑ Emerging" or "Free". */
export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${TONES[tone]} ${className}`}>{children}</span>;
}

export const btnPrimary =
  "inline-flex items-center justify-center rounded-xl bg-pr px-5 py-3 text-[15px] font-semibold text-pri transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45";
export const btnSecondary =
  "inline-flex items-center justify-center rounded-xl border-[1.5px] border-ln bg-sf px-5 py-3 text-[15px] font-semibold text-ink transition-colors hover:border-mu disabled:opacity-45";
export const inputClass = "w-full rounded-xl border border-ln bg-bg px-3.5 py-3 text-[15px] text-ink placeholder:text-mu/70";
export const linkClass = "font-semibold text-pr hover:opacity-85";

/** A thin horizontal bar, e.g. for skill and demand scores. */
export function Meter({ value, color = "bg-pr" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-md bg-sf2">
      <div className={`h-full rounded-md ${color}`} style={{ width: `${Math.max(2, Math.min(100, Math.round(value * 100)))}%` }} />
    </div>
  );
}
