export const LOCALES = ["en", "ms"] as const;
export type Locale = (typeof LOCALES)[number];

export const strings = {
  en: {
    appName: "LaluanKu",
    tagline: "Future-Ready Career Navigator",
    buildStatus: "Under construction: the trend signal layer is live. Matching and pathways come next.",
    navSignals: "Signals",

    signalsTitle: "Trend signals",
    signalsIntro:
      "Every forecast in LaluanKu is built from these dated, sourced signals. Curated reports form the baseline; new items arrive from news, research and dataset feeds when signals are refreshed.",
    signalsLastUpdated: "Signals last updated",
    signalsLastRefresh: "Last refresh",
    signalsNoRefresh: "No feed refresh has run yet. Showing the curated baseline.",
    signalsRefreshFailed: "The latest refresh failed. Showing signals from the last good fetch.",
    signalsCount: "signals",
    signalsAll: "All",
    signalsEmerging: "Emerging",
    signalsDeclining: "Declining",
    signalsPublished: "Published",
    signalsFetched: "Fetched",
    signalsStrength: "Strength",
    signalsRoles: "Roles",
    signalsSkills: "Skills",
    signalsOpenSource: "Open source",
    taggedCurated: "Curated & verified",
    taggedClaude: "Tagged by Claude",
    taggedKeyword: "Keyword fallback",
    signalsStrengthNote:
      "Strength (1–5) is a team judgement of how direct and large the evidence is. Items from feeds are capped at 3, so a single news story never outweighs a major report.",
    signalsDbMissing: "The database is not configured (DATABASE_URL), so signals can't be shown.",
    signalsLoading: "Loading signals…",

    refreshTitle: "Refresh signals (admin)",
    refreshHelp:
      "Pulls the configured feeds, tags new items against our role and skill catalog, and keeps only items that pass the guardrails.",
    refreshToken: "Admin token",
    refreshButton: "Refresh signals",
    refreshRunning: "Refreshing… this can take a minute.",
    refreshDone: "Refresh finished",
    refreshChecked: "checked",
    refreshAccepted: "accepted",
    refreshRejected: "rejected",
    refreshFailedItems: "failed",
    refreshRecentRuns: "Recent refresh runs",
    refreshFeedFailed: "feed failed",
  },
  ms: {
    appName: "LaluanKu",
    tagline: "Navigator Kerjaya Bersedia Masa Depan",
    buildStatus: "Dalam pembinaan: lapisan isyarat trend sudah berfungsi. Padanan dan laluan akan menyusul.",
    navSignals: "Isyarat",

    signalsTitle: "Isyarat trend",
    signalsIntro:
      "Setiap ramalan LaluanKu dibina daripada isyarat yang bertarikh dan bersumber ini. Laporan pilihan menjadi asas; item baharu datang daripada suapan berita, penyelidikan dan set data apabila isyarat dikemas kini.",
    signalsLastUpdated: "Isyarat dikemas kini",
    signalsLastRefresh: "Kemas kini terakhir",
    signalsNoRefresh: "Belum ada kemas kini suapan. Memaparkan asas pilihan.",
    signalsRefreshFailed: "Kemas kini terakhir gagal. Memaparkan isyarat daripada pengambilan terakhir yang berjaya.",
    signalsCount: "isyarat",
    signalsAll: "Semua",
    signalsEmerging: "Meningkat",
    signalsDeclining: "Menurun",
    signalsPublished: "Diterbitkan",
    signalsFetched: "Diambil",
    signalsStrength: "Kekuatan",
    signalsRoles: "Peranan",
    signalsSkills: "Kemahiran",
    signalsOpenSource: "Buka sumber",
    taggedCurated: "Dipilih & disahkan",
    taggedClaude: "Ditag oleh Claude",
    taggedKeyword: "Sandaran kata kunci",
    signalsStrengthNote:
      "Kekuatan (1–5) ialah penilaian pasukan tentang sejauh mana bukti itu langsung dan besar. Item daripada suapan dihadkan kepada 3, jadi satu berita tidak mengatasi laporan utama.",
    signalsDbMissing: "Pangkalan data belum dikonfigurasi (DATABASE_URL), jadi isyarat tidak dapat dipaparkan.",
    signalsLoading: "Memuatkan isyarat…",

    refreshTitle: "Kemas kini isyarat (pentadbir)",
    refreshHelp:
      "Mengambil suapan yang dikonfigurasi, menandakan item baharu mengikut katalog peranan dan kemahiran kami, dan hanya menyimpan item yang lulus kawalan.",
    refreshToken: "Token pentadbir",
    refreshButton: "Kemas kini isyarat",
    refreshRunning: "Sedang dikemas kini… ini mungkin mengambil masa seminit.",
    refreshDone: "Kemas kini selesai",
    refreshChecked: "disemak",
    refreshAccepted: "diterima",
    refreshRejected: "ditolak",
    refreshFailedItems: "gagal",
    refreshRecentRuns: "Kemas kini terkini",
    refreshFeedFailed: "suapan gagal",
  },
} satisfies Record<Locale, Record<string, string>>;

export type Strings = (typeof strings)["en"];

export function t(locale: Locale = "en"): Strings {
  return strings[locale];
}
