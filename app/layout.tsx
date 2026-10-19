import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { t } from "@/lib/i18n";
import "./globals.css";

const s = t("en");

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
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <nav className="mx-auto flex w-full max-w-4xl items-center gap-6 px-4 py-3 text-sm sm:px-6">
            <Link href="/" className="font-semibold">
              {s.appName}
            </Link>
            <Link href="/intake" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              {s.navIntake}
            </Link>
            <Link href="/results" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              {s.navResults}
            </Link>
            <Link href="/signals" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              {s.navSignals}
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
