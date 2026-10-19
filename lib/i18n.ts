export const LOCALES = ["en", "ms"] as const;
export type Locale = (typeof LOCALES)[number];

export const strings = {
  en: {
    appName: "LaluanKu",
    tagline: "Future-Ready Career Navigator",
    buildStatus: "Under construction: database and seed data are in place. Signals, matching and pathways come next.",
  },
  ms: {
    appName: "LaluanKu",
    tagline: "Navigator Kerjaya Bersedia Masa Depan",
    buildStatus: "Dalam pembinaan: pangkalan data dan data asas sudah sedia. Isyarat, padanan dan laluan akan menyusul.",
  },
} satisfies Record<Locale, Record<string, string>>;

export function t(locale: Locale = "en") {
  return strings[locale];
}
