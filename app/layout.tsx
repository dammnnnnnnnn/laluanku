import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { SiteFooter, SiteFooterFallback, SiteNav, SiteNavFallback } from "./site-nav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LaluanKu: Future-Ready Career Navigator",
  description:
    "Tracks AI-trend signals, matches skills to future roles and builds low-cost reskilling pathways linked to the UN SDGs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React hydrates, so the attribute may differ.
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-ln bg-bg/95 backdrop-blur">
          <Suspense fallback={<SiteNavFallback />}>
            <SiteNav />
          </Suspense>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-ln">
          <Suspense fallback={<SiteFooterFallback />}>
            <SiteFooter />
          </Suspense>
        </footer>
      </body>
    </html>
  );
}
