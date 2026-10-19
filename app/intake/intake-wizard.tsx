"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fmt, t, type Locale, type Strings } from "@/lib/i18n";
import { DEFAULT_DRAFT, type CatalogSkill, type ProfileDraft } from "@/lib/intake/schema";
import { LIKERT, QUESTIONS, TYPE_INFO, riasecCode, scoreQuiz, type RiasecScores } from "@/lib/riasec";

type Step = "choose" | "cv" | "form" | "sample" | "review" | "quiz" | "saving";
type Source = "cv" | "form" | "sample";
type Extraction = { method: "claude" | "keyword"; model: string | null; warning?: string };

const MAX_BYTES = 5 * 1024 * 1024;
const card = "rounded-lg border border-zinc-200 p-4 dark:border-zinc-800";
const input = "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";
const primary = "rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const secondary = "rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700";

export function IntakeWizard({ catalog, samples }: { catalog: CatalogSkill[]; samples: { key: string; draft: ProfileDraft }[] }) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const s = t(locale);
  const [step, setStep] = useState<Step>("choose");
  const [source, setSource] = useState<Source>("form");
  const [sampleKey, setSampleKey] = useState<string | undefined>();
  const [draft, setDraft] = useState<ProfileDraft>(DEFAULT_DRAFT);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [error, setError] = useState<string | null>(null);

  function startReview(next: ProfileDraft, from: Source, key?: string) {
    setDraft(next);
    setSource(from);
    setSampleKey(key);
    setError(null);
    setStep("review");
  }

  async function save(riasec: RiasecScores | null) {
    setStep("saving");
    setError(null);
    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft, riasec, source, sampleKey, extractionMethod: extraction?.method, confirmed: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.issues?.join("; ") || body.error || `HTTP ${res.status}`);
      router.push(`/results?profile=${encodeURIComponent(body.publicId)}`);
    } catch (err) {
      setError(`${s.saveFailed}: ${err instanceof Error ? err.message : String(err)}`);
      setStep("quiz");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{s.intakeTitle}</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{s.intakeIntro}</p>
        </div>
        <button type="button" onClick={() => setLocale(locale === "en" ? "ms" : "en")} className="shrink-0 text-sm text-emerald-700 underline dark:text-emerald-400">
          {s.intakeLanguage}
        </button>
      </div>
      <p className="rounded-md bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">🔒 {s.intakePrivacy}</p>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

      {step === "choose" && (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["cv", s.intakeOptionCv, s.intakeOptionCvHelp],
              ["form", s.intakeOptionForm, s.intakeOptionFormHelp],
              ["sample", s.intakeOptionSample, s.intakeOptionSampleHelp],
            ] as const
          ).map(([key, title, help]) => (
            <button key={key} type="button" onClick={() => setStep(key)} className={`${card} text-left hover:border-emerald-700`}>
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">{help}</span>
            </button>
          ))}
        </div>
      )}

      {step === "cv" && (
        <CvStep
          s={s}
          onBack={() => setStep("choose")}
          onError={setError}
          onDone={(next, ex) => {
            setExtraction(ex);
            startReview(next, "cv");
          }}
        />
      )}

      {step === "form" && <FormStep s={s} catalog={catalog} onBack={() => setStep("choose")} onDone={(next) => startReview(next, "form")} />}

      {step === "sample" && (
        <div className="flex flex-col gap-3">
          {samples.map((sample) => (
            <div key={sample.key} className={card}>
              <p className="font-semibold">{sample.draft.displayName}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{sample.draft.headline}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" className={primary} onClick={() => startReview(sample.draft, "sample", sample.key)}>
                  {s.sampleUse}
                </button>
                <Link href={`/results?profile=${sample.key}`} className={secondary}>
                  {s.sampleView}
                </Link>
              </div>
            </div>
          ))}
          <div>
            <button type="button" className={secondary} onClick={() => setStep("choose")}>
              {s.intakeBack}
            </button>
          </div>
        </div>
      )}

      {step === "review" && (
        <ReviewStep
          s={s}
          catalog={catalog}
          draft={draft}
          setDraft={setDraft}
          extraction={source === "cv" ? extraction : null}
          onBack={() => setStep("choose")}
          onDone={() => setStep("quiz")}
        />
      )}

      {step === "quiz" && <QuizStep s={s} locale={locale} onBack={() => setStep("review")} onFinish={save} />}

      {step === "saving" && <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.saving}</p>}
    </div>
  );
}

function CvStep({
  s,
  onBack,
  onDone,
  onError,
}: {
  s: Strings;
  onBack: () => void;
  onDone: (draft: ProfileDraft, extraction: Extraction) => void;
  onError: (msg: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    if (file.size > MAX_BYTES) return onError(s.cvTooBig);
    if (file.type && file.type !== "application/pdf") return onError(s.cvNotPdf);
    setBusy(true);
    onError(null);
    try {
      const form = new FormData();
      form.append("cv", file);
      const res = await fetch("/api/intake/cv", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      onDone(body.draft as ProfileDraft, { method: body.method, model: body.model, warning: body.warning });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${card} flex flex-col gap-3`}>
      <label className="text-sm font-medium" htmlFor="cv-file">
        {s.cvChoose}
      </label>
      <input id="cv-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
      {busy && <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.cvReading}</p>}
      <div className="flex gap-3">
        <button type="button" className={secondary} onClick={onBack} disabled={busy}>
          {s.intakeBack}
        </button>
        <button type="button" className={primary} onClick={upload} disabled={!file || busy}>
          {s.cvUpload}
        </button>
      </div>
    </div>
  );
}

function FormStep({ s, catalog, onBack, onDone }: { s: Strings; catalog: CatalogSkill[]; onBack: () => void; onDone: (draft: ProfileDraft) => void }) {
  const [headline, setHeadline] = useState("");
  const [years, setYears] = useState(0);
  const [education, setEducation] = useState("");
  const [languages, setLanguages] = useState("");
  const [goals, setGoals] = useState("");
  const [skills, setSkills] = useState<ProfileDraft["skills"]>([]);

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <Field label={s.formHeadline}>
        <input className={input} value={headline} placeholder={s.formHeadlinePlaceholder} onChange={(e) => setHeadline(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={s.formYears}>
          <input className={input} type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value) || 0)} />
        </Field>
        <Field label={s.formEducation}>
          <input className={input} value={education} placeholder={s.formEducationPlaceholder} onChange={(e) => setEducation(e.target.value)} />
        </Field>
      </div>
      <Field label={s.formLanguages}>
        <input className={input} value={languages} placeholder="Bahasa Melayu, English" onChange={(e) => setLanguages(e.target.value)} />
      </Field>
      <Field label={s.formSkills} help={s.formSkillsHelp} group>
        <SkillEditor s={s} catalog={catalog} skills={skills} setSkills={setSkills} />
      </Field>
      <Field label={s.formGoals}>
        <textarea className={input} rows={2} value={goals} onChange={(e) => setGoals(e.target.value)} />
      </Field>
      <div className="flex gap-3">
        <button type="button" className={secondary} onClick={onBack}>
          {s.intakeBack}
        </button>
        <button
          type="button"
          className={primary}
          disabled={skills.length === 0}
          onClick={() =>
            onDone({
              ...DEFAULT_DRAFT,
              headline: headline.trim(),
              yearsExperience: Math.max(0, Math.min(60, years)),
              education: education.trim() ? [education.trim()] : [],
              languages: languages.split(",").map((l) => l.trim()).filter(Boolean),
              goals: goals.split("\n").map((g) => g.trim()).filter(Boolean),
              skills,
            })
          }
        >
          {s.intakeContinue}
        </button>
      </div>
    </div>
  );
}

function ReviewStep({
  s,
  catalog,
  draft,
  setDraft,
  extraction,
  onBack,
  onDone,
}: {
  s: Strings;
  catalog: CatalogSkill[];
  draft: ProfileDraft;
  setDraft: (d: ProfileDraft) => void;
  extraction: Extraction | null;
  onBack: () => void;
  onDone: () => void;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const update = (patch: Partial<ProfileDraft>) => {
    setDraft({ ...draft, ...patch });
    setConfirmed(false);
  };

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="text-xl font-semibold">{s.reviewTitle}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.reviewIntro}</p>
      </div>
      {extraction && (
        <p className="rounded-md bg-violet-50 p-2 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-200">
          {extraction.warning ?? (extraction.method === "claude" ? fmt(s.cvMethodClaude, { model: extraction.model ?? "Claude" }) : s.cvMethodKeyword)}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={s.reviewName}>
          <input className={input} value={draft.displayName} maxLength={60} onChange={(e) => update({ displayName: e.target.value })} />
        </Field>
        <Field label={s.reviewHeadline}>
          <input className={input} value={draft.headline} maxLength={200} onChange={(e) => update({ headline: e.target.value })} />
        </Field>
      </div>
      {draft.summary && (
        <Field label={s.reviewSummary}>
          <textarea className={input} rows={3} value={draft.summary} maxLength={1000} onChange={(e) => update({ summary: e.target.value })} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={s.formYears}>
          <input className={input} type="number" min={0} max={60} value={draft.yearsExperience} onChange={(e) => update({ yearsExperience: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} />
        </Field>
        <Field label={s.reviewHours}>
          <input className={input} type="number" min={1} max={60} value={draft.hoursPerWeek} onChange={(e) => update({ hoursPerWeek: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} />
        </Field>
        <Field label={s.reviewBudget}>
          <select className={input} value={draft.budget} onChange={(e) => update({ budget: e.target.value as ProfileDraft["budget"] })}>
            <option value="free">{s.budgetFree}</option>
            <option value="low">{s.budgetLow}</option>
            <option value="hrdc_claimable">{s.budgetHrdc}</option>
          </select>
        </Field>
      </div>
      <Field label={s.reviewSkills} group>
        <SkillEditor s={s} catalog={catalog} skills={draft.skills} setSkills={(skills) => update({ skills })} showEvidence />
      </Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {s.reviewConfirm}
      </label>
      <div className="flex gap-3">
        <button type="button" className={secondary} onClick={onBack}>
          {s.intakeBack}
        </button>
        <button type="button" className={primary} disabled={!confirmed || draft.skills.length === 0 || !draft.displayName.trim()} onClick={onDone}>
          {s.reviewToQuiz}
        </button>
      </div>
    </div>
  );
}

function SkillEditor({
  s,
  catalog,
  skills,
  setSkills,
  showEvidence = false,
}: {
  s: Strings;
  catalog: CatalogSkill[];
  skills: ProfileDraft["skills"];
  setSkills: (skills: ProfileDraft["skills"]) => void;
  showEvidence?: boolean;
}) {
  const [query, setQuery] = useState("");
  const name = useMemo(() => new Map(catalog.map((c) => [c.slug, c.name])), [catalog]);
  const chosen = new Set(skills.map((x) => x.slug));
  const matches = query.trim()
    ? catalog.filter((c) => !chosen.has(c.slug) && c.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const levels = [
    [1, s.levelBasic],
    [2, s.levelWorking],
    [3, s.levelStrong],
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      {skills.length === 0 && <p className="text-sm text-zinc-500">{s.reviewNoSkills}</p>}
      <ul className="flex flex-col gap-2">
        {skills.map((skill, i) => (
          <li key={skill.slug} className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <span className="min-w-0 flex-1">
              <span className="block">{name.get(skill.slug) ?? skill.slug}</span>
              {showEvidence && skill.evidence && <span className="block text-xs text-zinc-500">{skill.evidence}</span>}
            </span>
            <select
              aria-label={`${name.get(skill.slug) ?? skill.slug} level`}
              className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-xs dark:border-zinc-700"
              value={skill.level}
              onChange={(e) => setSkills(skills.map((x, j) => (j === i ? { ...x, level: Number(e.target.value) as 1 | 2 | 3 } : x)))}
            >
              {levels.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <button type="button" className="text-xs text-red-700 underline dark:text-red-400" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>
              {s.reviewRemove}
            </button>
          </li>
        ))}
      </ul>
      <div className="relative">
        <input className={input} aria-label={s.reviewAddSkill} placeholder={s.reviewSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow dark:border-zinc-800 dark:bg-zinc-950">
            {matches.map((m) => (
              <li key={m.slug}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  onClick={() => {
                    setSkills([...skills, { slug: m.slug, level: 2, evidence: "" }]);
                    setQuery("");
                  }}
                >
                  {m.name} <span className="text-xs text-zinc-500">· {m.category}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function QuizStep({ s, locale, onBack, onFinish }: { s: Strings; locale: Locale; onBack: () => void; onFinish: (riasec: RiasecScores | null) => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const answered = Object.keys(answers).length;
  const complete = answered === QUESTIONS.length;
  const scores = complete ? scoreQuiz(answers) : null;

  return (
    <div className={`${card} flex flex-col gap-4`}>
      <div>
        <h2 className="text-xl font-semibold">{s.quizTitle}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.quizIntro}</p>
        <p className="mt-1 text-xs text-zinc-500">{fmt(s.quizProgress, { n: answered })}</p>
      </div>
      <ol className="flex flex-col gap-4">
        {QUESTIONS.map((q) => (
          <li key={q.id}>
            <fieldset>
              <legend className="text-sm font-medium">
                {q.id}. {locale === "ms" ? q.ms : q.en}
              </legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {LIKERT.map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${answers[q.id] === opt.value ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
                  >
                    <input type="radio" className="sr-only" name={`q${q.id}`} value={opt.value} checked={answers[q.id] === opt.value} onChange={() => setAnswers({ ...answers, [q.id]: opt.value })} />
                    {locale === "ms" ? opt.ms : opt.en}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      {scores && (
        <p className="text-sm">
          {s.quizYourCode}: <strong>{riasecCode(scores)}</strong> ·{" "}
          {riasecCode(scores)
            .split("")
            .map((l) => TYPE_INFO[l as keyof typeof TYPE_INFO][locale === "ms" ? "ms" : "en"])
            .join(", ")}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={secondary} onClick={onBack}>
          {s.intakeBack}
        </button>
        <button type="button" className={secondary} onClick={() => onFinish(null)}>
          {s.quizSkip}
        </button>
        <button type="button" className={primary} disabled={!complete} onClick={() => scores && onFinish(scores)}>
          {s.quizFinish}
        </button>
      </div>
    </div>
  );
}

/** A labelled field. Use `group` for composite controls (like the skill editor) that can't sit inside a <label>. */
function Field({ label, help, children, group = false }: { label: string; help?: string; children: React.ReactNode; group?: boolean }) {
  const body = (
    <>
      <span className="text-sm font-medium">{label}</span>
      {help && <span className="text-xs text-zinc-500">{help}</span>}
      {children}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      {body}
    </div>
  ) : (
    <label className="flex flex-col gap-1">{body}</label>
  );
}
