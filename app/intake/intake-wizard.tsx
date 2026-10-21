"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { fmt, t, type Locale, type Strings } from "@/lib/i18n";
import { DEFAULT_DRAFT, type CatalogSkill, type ProfileDraft } from "@/lib/intake/schema";
import { LIKERT, QUESTIONS, TYPE_INFO, riasecCode, scoreQuiz, type RiasecScores } from "@/lib/riasec";
import { PageHero, btnPrimary as primary, btnSecondary as secondary, inputClass as input } from "../ui";

type Step = "choose" | "cv" | "form" | "sample" | "review" | "quiz" | "saving";
type Source = "cv" | "form" | "sample";
type Extraction = { method: "claude" | "keyword"; model: string | null; warning?: string };

const MAX_BYTES = 5 * 1024 * 1024;
const panel = "card flex flex-col gap-5 p-[clamp(20px,3vw,32px)]";

/** Which of the four progress steps (choose, check, quiz, results) a wizard step belongs to. */
const progressOf = (step: Step) => (step === "review" ? 2 : step === "quiz" || step === "saving" ? 3 : 1);

export function IntakeWizard({
  catalog,
  samples,
  locale,
  roleCount,
}: {
  catalog: CatalogSkill[];
  samples: { key: string; draft: ProfileDraft }[];
  locale: Locale;
  roleCount: number;
}) {
  const router = useRouter();
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

  const progress = progressOf(step);

  return (
    <>
      <PageHero eyebrow={fmt(s.intakeStepOf, { n: progress })} title={s.intakeTitle} intro={s.intakeIntro}>
        <Stepper s={s} current={progress} />
      </PageHero>

      <section className="wrap flex flex-wrap items-start gap-6 pt-10 pb-18">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          {error && <p className="rounded-xl bg-dnbg px-4 py-3 text-sm text-dn">{error}</p>}

          {step === "choose" && (
            <div className={panel}>
              <h2 className="text-xl font-semibold">{s.intakeChooseTitle}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["cv", "PDF", s.intakeOptionCv, s.intakeOptionCvHelp],
                    ["form", "✎", s.intakeOptionForm, s.intakeOptionFormHelp],
                    ["sample", "★", s.intakeOptionSample, s.intakeOptionSampleHelp],
                  ] as const
                ).map(([key, icon, title, help]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStep(key)}
                    className="flex flex-col gap-2 rounded-2xl border border-ln bg-sf2 p-5 text-left transition-colors hover:border-pr"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-soft font-mono text-xs font-bold text-pr" aria-hidden>
                      {icon}
                    </span>
                    <span className="font-semibold">{title}</span>
                    <span className="text-sm leading-snug text-mu">{help}</span>
                  </button>
                ))}
              </div>
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
            <div className={panel}>
              <h2 className="text-xl font-semibold">{s.intakeOptionSample}</h2>
              {samples.map((sample) => (
                <div key={sample.key} className="flex flex-col gap-3 rounded-2xl bg-sf2 p-5">
                  <div>
                    <p className="font-semibold">{sample.draft.displayName}</p>
                    <p className="text-sm text-mu">{sample.draft.headline}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
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

          {step === "saving" && <p className={`${panel} text-sm text-mu`}>{s.saving}</p>}
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <div className="card flex flex-col gap-3.5">
            <b className="text-[17px] font-semibold">{s.intakeNextTitle}</b>
            {[fmt(s.intakeNext1, { n: roleCount }), s.intakeNext2, s.intakeNext3].map((line, i) => (
              <div key={line} className="flex gap-3 text-sm leading-snug">
                <span className="flex size-6 flex-none items-center justify-center rounded-full bg-soft font-mono text-xs font-semibold text-pr">{i + 1}</span>
                {line}
              </div>
            ))}
          </div>
          <div className="rounded-3xl bg-sf2 p-6 text-sm leading-normal text-mu">
            <b className="mb-1.5 block text-[17px] font-semibold text-ink">🔒 {s.intakePrivacyTitle}</b>
            {s.intakePrivacy}
          </div>
        </aside>
      </section>
    </>
  );
}

function Stepper({ s, current }: { s: Strings; current: number }) {
  const labels = [s.intakeStepChoose, s.intakeStepCheck, s.intakeStepQuiz, s.intakeStepResults];
  return (
    <ol className="mt-7 flex flex-wrap items-center gap-3 text-sm font-semibold">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            {i > 0 && <i className={`hidden h-0.5 w-12 sm:block ${n <= current ? "bg-up" : "bg-ln"}`} aria-hidden />}
            <span className={`flex items-center gap-2 ${done ? "text-up" : active ? "text-pr" : "text-mu"}`}>
              <span
                className={`flex size-7 items-center justify-center rounded-full text-[13px] ${done ? "bg-upbg" : active ? "bg-pr text-pri" : "border-[1.5px] border-ln"}`}
              >
                {done ? "✓" : n}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
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
    <div className={panel}>
      <div>
        <h2 className="text-xl font-semibold">{s.intakeOptionCv}</h2>
        <p className="mt-1 text-sm text-mu">{s.intakeOptionCvHelp}</p>
      </div>
      <label
        htmlFor="cv-file"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-[1.5px] border-dashed border-ln bg-sf2 px-4 py-8 text-center text-sm hover:border-pr"
      >
        <span className="font-semibold text-pr">{s.cvChoose}</span>
        <span className="text-mu">{file ? file.name : "PDF · max 5 MB"}</span>
        <input id="cv-file" type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="sr-only" />
      </label>
      {busy && <p className="text-sm text-mu">{s.cvReading}</p>}
      <div className="flex flex-wrap gap-3">
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
    <div className={panel}>
      <h2 className="text-xl font-semibold">{s.intakeOptionForm}</h2>
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
      <div className="flex flex-wrap gap-3">
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
          {s.intakeContinue} →
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
    <div className={panel}>
      <div>
        <h2 className="text-xl font-semibold">{s.reviewTitle}</h2>
        <p className="mt-1 text-sm text-mu">{s.reviewIntro}</p>
      </div>
      {extraction && (
        <p className="rounded-xl bg-soft px-3.5 py-3 text-[13px] font-medium text-pr">
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
      <Field label={`${s.reviewSkills} (${draft.skills.length})`} group>
        <SkillEditor s={s} catalog={catalog} skills={draft.skills} setSkills={(skills) => update({ skills })} showEvidence />
      </Field>
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-[18px]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        {s.reviewConfirm}
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={secondary} onClick={onBack}>
          {s.intakeBack}
        </button>
        <button type="button" className={primary} disabled={!confirmed || draft.skills.length === 0 || !draft.displayName.trim()} onClick={onDone}>
          {s.reviewToQuiz} →
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
      {skills.length === 0 && <p className="text-sm text-mu">{s.reviewNoSkills}</p>}
      <ul className="flex flex-col gap-2">
        {skills.map((skill, i) => {
          const label = name.get(skill.slug) ?? skill.slug;
          return (
            <li key={skill.slug} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-sf2 px-4 py-3 text-sm">
              <span className="min-w-0 flex-[1_1_200px]">
                <span className="block font-medium">{label}</span>
                {showEvidence && skill.evidence && <span className="block text-xs text-mu">{skill.evidence}</span>}
              </span>
              <span className="flex gap-0.5 rounded-[10px] border border-ln bg-sf p-[3px] text-xs font-medium" role="radiogroup" aria-label={`${label} level`}>
                {levels.map(([v, levelLabel]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={skill.level === v}
                    onClick={() => setSkills(skills.map((x, j) => (j === i ? { ...x, level: v } : x)))}
                    className={`rounded-[7px] px-2.5 py-[5px] ${skill.level === v ? "bg-pr text-pri" : "text-mu hover:text-ink"}`}
                  >
                    {levelLabel}
                  </button>
                ))}
              </span>
              <button type="button" className="p-1.5 text-[13px] font-semibold text-dn" onClick={() => setSkills(skills.filter((_, j) => j !== i))}>
                {s.reviewRemove}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="relative">
        <input
          className="w-full rounded-xl border-[1.5px] border-dashed border-ln bg-transparent px-3.5 py-3 text-sm text-ink placeholder:text-mu"
          aria-label={s.reviewAddSkill}
          placeholder={`+ ${s.reviewSearch}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-ln bg-sf shadow-card">
            {matches.map((m) => (
              <li key={m.slug}>
                <button
                  type="button"
                  className="w-full px-3.5 py-2.5 text-left text-sm hover:bg-sf2"
                  onClick={() => {
                    setSkills([...skills, { slug: m.slug, level: 2, evidence: "" }]);
                    setQuery("");
                  }}
                >
                  {m.name} <span className="text-xs text-mu">· {m.category}</span>
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
    <div className={panel}>
      <div>
        <h2 className="text-xl font-semibold">{s.quizTitle}</h2>
        <p className="mt-1 text-sm text-mu">{s.quizIntro}</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-md bg-sf2">
            <div className="h-full rounded-md bg-pr transition-[width]" style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-mu">{fmt(s.quizProgress, { n: answered })}</span>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {QUESTIONS.map((q) => (
          <li key={q.id} className="rounded-2xl bg-sf2 px-4 py-3">
            <fieldset>
              <legend className="text-sm font-medium">
                <span className="mr-1 font-mono text-mu">{q.id}.</span> {locale === "ms" ? q.ms : q.en}
              </legend>
              <div className="mt-2 flex flex-wrap gap-1">
                {LIKERT.map((opt) => (
                  <label
                    key={opt.value}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium has-focus-visible:ring-2 has-focus-visible:ring-pr ${answers[q.id] === opt.value ? "border-pr bg-pr text-pri" : "border-ln bg-sf text-ink hover:border-mu"}`}
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
        <p className="rounded-xl bg-soft px-3.5 py-3 text-sm text-pr">
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
          {s.quizFinish} →
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
      {help && <span className="text-xs text-mu">{help}</span>}
      {children}
    </>
  );
  return group ? (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      {body}
    </div>
  ) : (
    <label className="flex flex-col gap-1.5">{body}</label>
  );
}
