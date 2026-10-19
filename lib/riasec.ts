// Holland RIASEC interest quiz: 18 items (3 per type), Likert 1-5, EN/BM, written in our own words.
// Interest fit is guidance, never a gate: it never hides roles and the quiz is skippable.

export const RIASEC_TYPES = ["R", "I", "A", "S", "E", "C"] as const;
export type RiasecType = (typeof RIASEC_TYPES)[number];
export type RiasecScores = Record<RiasecType, number>; // each 0..1

export const TYPE_INFO: Record<RiasecType, { en: string; ms: string; enBlurb: string; msBlurb: string }> = {
  R: { en: "Realistic", ms: "Realistik", enBlurb: "hands-on work with tools, machines or the outdoors", msBlurb: "kerja praktikal dengan alat, mesin atau di luar" },
  I: { en: "Investigative", ms: "Penyiasat", enBlurb: "solving problems, analysing and researching", msBlurb: "menyelesaikan masalah, menganalisis dan menyelidik" },
  A: { en: "Artistic", ms: "Artistik", enBlurb: "creating, designing and expressing ideas", msBlurb: "mencipta, mereka bentuk dan meluahkan idea" },
  S: { en: "Social", ms: "Sosial", enBlurb: "helping, teaching and caring for people", msBlurb: "membantu, mengajar dan menjaga orang" },
  E: { en: "Enterprising", ms: "Keusahawanan", enBlurb: "leading, persuading and starting things", msBlurb: "memimpin, meyakinkan dan memulakan sesuatu" },
  C: { en: "Conventional", ms: "Konvensional", enBlurb: "organising information, records and procedures", msBlurb: "menyusun maklumat, rekod dan prosedur" },
};

export type RiasecQuestion = { id: number; type: RiasecType; en: string; ms: string };

// Interleaved R, I, A, S, E, C so similar items aren't answered back to back.
export const QUESTIONS: RiasecQuestion[] = [
  { id: 1, type: "R", en: "Fix or assemble machines, devices or equipment", ms: "Membaiki atau memasang mesin, peranti atau peralatan" },
  { id: 2, type: "I", en: "Work out why something isn't working by testing ideas", ms: "Mencari punca sesuatu tidak berfungsi dengan menguji idea" },
  { id: 3, type: "A", en: "Design posters, videos, layouts or websites", ms: "Mereka bentuk poster, video, susun atur atau laman web" },
  { id: 4, type: "S", en: "Teach or explain things to other people", ms: "Mengajar atau menerangkan sesuatu kepada orang lain" },
  { id: 5, type: "E", en: "Persuade people to try an idea or a product", ms: "Meyakinkan orang untuk mencuba sesuatu idea atau produk" },
  { id: 6, type: "C", en: "Keep records, files or schedules well organised", ms: "Menyusun rekod, fail atau jadual dengan teratur" },
  { id: 7, type: "R", en: "Work outdoors or with my hands, on a farm, site or workshop", ms: "Bekerja di luar atau menggunakan tangan, di ladang, tapak atau bengkel" },
  { id: 8, type: "I", en: "Analyse numbers or data to find patterns", ms: "Menganalisis nombor atau data untuk mencari corak" },
  { id: 9, type: "A", en: "Write stories, captions or articles", ms: "Menulis cerita, kapsyen atau artikel" },
  { id: 10, type: "S", en: "Help people with their problems or look after them", ms: "Membantu orang dengan masalah mereka atau menjaga mereka" },
  { id: 11, type: "E", en: "Lead a project or a group and make the decisions", ms: "Mengetuai projek atau kumpulan dan membuat keputusan" },
  { id: 12, type: "C", en: "Check details carefully so there are no mistakes", ms: "Menyemak butiran dengan teliti supaya tiada kesilapan" },
  { id: 13, type: "R", en: "Operate tools, vehicles or machinery", ms: "Mengendalikan alat, kenderaan atau jentera" },
  { id: 14, type: "I", en: "Learn how things work in science or technology", ms: "Mempelajari cara sesuatu berfungsi dalam sains atau teknologi" },
  { id: 15, type: "A", en: "Come up with original ideas instead of following a set method", ms: "Menghasilkan idea asli dan bukan mengikut kaedah yang ditetapkan" },
  { id: 16, type: "S", en: "Work in a team where people support each other", ms: "Bekerja dalam pasukan yang saling menyokong" },
  { id: 17, type: "E", en: "Start or grow a small business", ms: "Memulakan atau mengembangkan perniagaan kecil" },
  { id: 18, type: "C", en: "Follow clear procedures and work with spreadsheets", ms: "Mengikut prosedur yang jelas dan bekerja dengan hamparan" },
];

export const LIKERT = [
  { value: 1, en: "Strongly dislike", ms: "Sangat tidak suka" },
  { value: 2, en: "Dislike", ms: "Tidak suka" },
  { value: 3, en: "Not sure", ms: "Tidak pasti" },
  { value: 4, en: "Like", ms: "Suka" },
  { value: 5, en: "Strongly like", ms: "Sangat suka" },
] as const;

/** Average of each type's three answers (1-5), rescaled to 0..1. Unanswered items count as neutral (3). */
export function scoreQuiz(answers: Record<number, number>): RiasecScores {
  const scores = {} as RiasecScores;
  for (const type of RIASEC_TYPES) {
    const items = QUESTIONS.filter((q) => q.type === type);
    const avg = items.reduce((s, q) => s + clampLikert(answers[q.id]), 0) / items.length;
    scores[type] = Math.round(((avg - 1) / 4) * 100) / 100;
  }
  return scores;
}

function clampLikert(v: number | undefined): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 3;
  return Math.min(5, Math.max(1, Math.round(v)));
}

/** Top three types by score (ties keep R-I-A-S-E-C order), e.g. "ICR". */
export function riasecCode(scores: RiasecScores, length = 3): string {
  return [...RIASEC_TYPES]
    .sort((a, b) => scores[b] - scores[a] || RIASEC_TYPES.indexOf(a) - RIASEC_TYPES.indexOf(b))
    .slice(0, length)
    .join("");
}

/**
 * Interest fit = cosine similarity of the two 6-dim profiles, each centred on its own mean so
 * the shape of the interests matters rather than how generously someone answered.
 * Mapped from [-1, 1] to [0, 1]; a flat profile on either side gives a neutral 0.5.
 */
export function interestFit(user: RiasecScores, role: RiasecScores): number {
  const centre = (p: RiasecScores) => {
    const mean = RIASEC_TYPES.reduce((s, t) => s + p[t], 0) / RIASEC_TYPES.length;
    return RIASEC_TYPES.map((t) => p[t] - mean);
  };
  const u = centre(user);
  const r = centre(role);
  const dot = u.reduce((s, x, i) => s + x * r[i], 0);
  const norm = Math.hypot(...u) * Math.hypot(...r);
  if (norm < 1e-9) return 0.5;
  return (dot / norm + 1) / 2;
}

/** Types both profiles rank in their top three, for a plain-language "why". */
export function sharedTopTypes(user: RiasecScores, role: RiasecScores): RiasecType[] {
  const top = (p: RiasecScores) => new Set(riasecCode(p).split("") as RiasecType[]);
  const r = top(role);
  return [...top(user)].filter((t) => r.has(t));
}
