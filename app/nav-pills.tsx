"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

/** The segmented page switcher, with `activeHref` highlighted (none while loading). */
export function PillLinks({ links, activeHref }: { links: NavLink[]; activeHref: string | null }) {
  return (
    <div className="flex flex-wrap gap-0.5 rounded-full border border-ln bg-sf2 p-1">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === activeHref ? "page" : undefined}
          className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:px-4 ${l.href === activeHref ? "bg-sf text-ink shadow-sm" : "text-mu hover:text-ink"}`}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

/** Highlights the current page. A pathway page counts as part of Results. */
export function NavPills({ links }: { links: NavLink[] }) {
  const path = usePathname();
  const active = links.find((l) => (l.href === "/" ? path === "/" : path.startsWith(l.href) || (l.href === "/results" && path.startsWith("/pathway"))));
  return <PillLinks links={links} activeHref={active?.href ?? null} />;
}
