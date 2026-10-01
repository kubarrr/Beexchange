"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Compass, Eye, GraduationCap, Luggage, MapPinned, Plus, Trash2, X } from "lucide-react";
import { saveProfile } from "@/app/actions/bx";
import { Flag, Switch } from "@/components/bx";
import { InstitutionPicker } from "@/components/InstitutionPicker";
import { AvatarUpload } from "@/components/AvatarUpload";
import { semesterLabel, semesterOptions, semesterPhase, type Institution } from "@/lib/domain";
import { dictionaries, PASSION_KEYS, type Locale } from "@/lib/i18n/dictionaries";
import { DEGREES, LANGUAGE_CODES, LANGUAGE_FLAGS, LEVELS, PASSION_EMOJI, languageName, parseLanguage, parseStudy, type Degree, type Level } from "@/lib/profile-options";

export type HomeEntry = { inst: Institution | null; field: string; study: string; faculty: string };
export type ExchangeEntry = { inst: Institution | null; semester: string | null; status: "going" | "been" };
export type ProfileFormInitial = {
  full_name: string;
  avatar_url: string | null;
  homes: HomeEntry[];
  exchanges: ExchangeEntry[];
  passions: string[];
  languages: string[];
  bio: string;
  open_to_questions: boolean;
  wants_buddy: boolean;
};

type Stage = "searching" | "going" | "abroad" | "been";
const STAGE_ICONS = { searching: Compass, going: Luggage, abroad: MapPinned, been: GraduationCap } as const;

function semestersFor(status: "going" | "been", current: string | null) {
  const list = semesterOptions().filter((c) => (status === "going" ? semesterPhase(c) !== "past" : semesterPhase(c) !== "upcoming"));
  return current && !list.includes(current) ? [current, ...list] : list;
}

export function ProfileForm({ locale, userId, initial, mode }: { locale: Locale; userId: string; initial: ProfileFormInitial; mode: "onboarding" | "edit" }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [p, setP] = useState<ProfileFormInitial>({
    ...initial,
    homes: initial.homes.length ? initial.homes : [{ inst: null, field: "", study: "", faculty: "" }],
  });
  const [stage, setStage] = useState<Stage | null>(mode === "edit" ? "going" : null);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const set = (patch: Partial<ProfileFormInitial>) => {
    setSaved(false);
    setP((prev) => ({ ...prev, ...patch }));
  };
  const setHome = (i: number, patch: Partial<HomeEntry>) => set({ homes: p.homes.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  const setExchange = (i: number, patch: Partial<ExchangeEntry>) => set({ exchanges: p.exchanges.map((x, j) => (j === i ? { ...x, ...patch } : x)) });

  const exchangesValid = p.exchanges.every((x) => x.inst && x.semester);

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await saveProfile({
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        homes: p.homes.filter((h) => h.inst).map((h) => ({ institution_id: h.inst!.id, field_of_study: h.field, study: h.study, faculty: h.faculty })),
        exchanges: p.exchanges.filter((x) => x.inst && x.semester).map((x) => ({ institution_id: x.inst!.id, semester: x.semester!, status: x.status })),
        passions: p.passions,
        languages: p.languages,
        bio: p.bio,
        open_to_questions: p.open_to_questions,
        wants_buddy: p.wants_buddy,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (mode === "onboarding") router.push("/roj");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  // ---------- sekcje ----------
  const homeEditor = (h: HomeEntry, i: number) => {
    const study = parseStudy(h.study);
    const maxYear = study ? DEGREES[study.degree] : 0;
    return (
      <div key={i} className={`space-y-4 ${i > 0 ? "border-t-[1.5px] border-line pt-5" : ""}`}>
        {i > 0 && (
          <button type="button" onClick={() => set({ homes: p.homes.filter((_, j) => j !== i) })} className="flex min-h-10 items-center gap-1.5 text-sm font-semibold text-muted hover:text-red-700">
            <Trash2 size={15} /> {t.common.clear}
          </button>
        )}
        <InstitutionPicker locale={locale} value={h.inst} onChange={(inst) => setHome(i, { inst })} prefer="PL" />
        <div className="space-y-2">
          <span className="label-caps">{t.profile.degree}</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(DEGREES) as Degree[]).map((d) => (
              <button key={d} type="button" onClick={() => setHome(i, { study: DEGREES[d] ? `${d}:1` : d })} className={`chip ${study?.degree === d ? "chip-on" : ""}`}>
                {t.profile.degrees[d]}
              </button>
            ))}
          </div>
        </div>
        {study && maxYear > 0 && (
          <div className="space-y-2">
            <span className="label-caps">{t.profile.year}</span>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: maxYear }, (_, k) => k + 1).map((y) => (
                <button key={y} type="button" onClick={() => setHome(i, { study: `${study.degree}:${y}` })} className={`chip min-w-12 justify-center ${study.year === y ? "chip-on" : ""}`}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
        <SuggestInput rpc="faculties_at" instId={h.inst?.id ?? null} label={t.profile.faculty} placeholder={t.profile.facultyPh} value={h.faculty} onChange={(faculty) => setHome(i, { faculty })} />
        <SuggestInput rpc="fields_at" instId={h.inst?.id ?? null} label={t.profile.field} placeholder={t.profile.fieldPh} value={h.field} onChange={(field) => setHome(i, { field })} />
      </div>
    );
  };

  const homesSection = (
    <div className="space-y-5">
      {p.homes.map(homeEditor)}
      {p.homes.length < 4 && p.homes.every((h) => h.inst) && (
        <button type="button" onClick={() => set({ homes: [...p.homes, { inst: null, field: "", study: "", faculty: "" }] })} className="btn-outline w-full border-dashed">
          <Plus size={16} /> {t.profile.addHome}
        </button>
      )}
    </div>
  );

  const exchangeEditor = (x: ExchangeEntry, i: number, fixedStatus = false) => (
    <div key={i} className={`space-y-4 ${i > 0 ? "border-t-[1.5px] border-line pt-5" : ""}`}>
      <div className="flex items-center gap-2">
        {!fixedStatus && (
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-sand p-1">
            {(["going", "been"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setExchange(i, { status: s, semester: x.semester && semestersFor(s, null).includes(x.semester) ? x.semester : null })}
                className={`min-h-10 rounded-xl text-sm font-semibold ${x.status === s ? "bg-ink text-honey" : ""}`}
              >
                {s === "going" ? t.profile.exGoing : t.profile.exBeen}
              </button>
            ))}
          </div>
        )}
        {(mode === "edit" || i > 0) && (
          <button type="button" aria-label={t.common.clear} onClick={() => set({ exchanges: p.exchanges.filter((_, j) => j !== i) })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-sand hover:text-red-700">
            <Trash2 size={17} />
          </button>
        )}
      </div>
      <InstitutionPicker locale={locale} value={x.inst} onChange={(inst) => setExchange(i, { inst })} />
      <div className="space-y-2">
        <span className="label-caps">{t.onboarding.semesterLabel}</span>
        <div className="flex flex-wrap gap-2">
          {semestersFor(x.status, x.semester).map((code) => (
            <button key={code} type="button" onClick={() => setExchange(i, { semester: code })} className={`chip ${x.semester === code ? "chip-on" : ""}`}>
              {semesterLabel(code, t)}
              {semesterPhase(code) === "now" && <span className="ml-1.5 h-2 w-2 rounded-full bg-honey-deep" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const exchangesSection = (
    <div className="space-y-5">
      {p.exchanges.length === 0 && <p className="rounded-2xl bg-sand p-4 text-sm">{t.profile.noExchanges}</p>}
      {p.exchanges.map((x, i) => exchangeEditor(x, i))}
      {p.exchanges.length < 6 && exchangesValid && (
        <button type="button" onClick={() => set({ exchanges: [...p.exchanges, { inst: null, semester: null, status: "going" }] })} className="btn-outline w-full border-dashed">
          <Plus size={16} /> {t.profile.addExchange}
        </button>
      )}
    </div>
  );

  const [langCode, setLangCode] = useState("");
  const [langLevel, setLangLevel] = useState<Level>("B2");
  const chosenLangs = new Set(p.languages.map((l) => parseLanguage(l)?.code));
  const languagesSection = (
    <div className="space-y-2.5">
      <span className="label-caps">{t.profile.languages}</span>
      <div className="flex flex-wrap gap-2">
        {p.languages.map((l) => {
          const lang = parseLanguage(l);
          return (
            <span key={l} className="chip gap-2 rounded-xl pr-1">
              {lang && <Flag code={LANGUAGE_FLAGS[lang.code]} className="h-3.5 w-5" />}
              {lang ? languageName(lang.code, locale) : l}
              {lang && <span className="text-xs font-medium text-muted">{t.profile.levels[lang.level]}</span>}
              <button type="button" aria-label={`${t.common.clear} ${l}`} onClick={() => set({ languages: p.languages.filter((x) => x !== l) })} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sand">
                <X size={14} />
              </button>
            </span>
          );
        })}
      </div>
      {p.languages.length < 8 && (
        <div className="flex gap-2">
          <select className="field min-w-0 flex-1" value={langCode} onChange={(e) => setLangCode(e.target.value)} aria-label={t.profile.addLanguage}>
            <option value="">{t.profile.addLanguage}…</option>
            {LANGUAGE_CODES.filter((c) => !chosenLangs.has(c))
              .map((c) => ({ c, n: languageName(c, locale) }))
              .sort((a, b) => a.n.localeCompare(b.n, locale))
              .map(({ c, n }) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
          </select>
          <select className="field w-28 shrink-0" value={langLevel} onChange={(e) => setLangLevel(e.target.value as Level)} aria-label={t.profile.level}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {t.profile.levels[l]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!langCode}
            aria-label={t.profile.addLanguage}
            onClick={() => {
              set({ languages: [...p.languages, `${langCode}:${langLevel}`] });
              setLangCode("");
            }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-honey disabled:opacity-40"
          >
            <Plus size={20} />
          </button>
        </div>
      )}
    </div>
  );

  const youSection = (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <AvatarUpload locale={locale} userId={userId} name={p.full_name} url={p.avatar_url} onChange={(avatar_url) => set({ avatar_url })} size={176} />
        <label className="w-full space-y-1.5">
          <span className="label-caps">{t.profile.name}</span>
          <input className="field font-semibold" value={p.full_name} onChange={(e) => set({ full_name: e.target.value })} />
        </label>
      </div>

      <div className="space-y-2">
        <span className="label-caps">{t.profile.passions}</span>
        <p className="text-[13px] text-muted">{t.profile.passionsHint}</p>
        <div className="flex flex-wrap gap-2">
          {PASSION_KEYS.map((key, i) => {
            const on = p.passions.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => set({ passions: on ? p.passions.filter((x) => x !== key) : [...p.passions, key] })}
                className={`chip gap-1.5 ${on ? "chip-honey" : ""}`}
              >
                <span aria-hidden="true">{PASSION_EMOJI[key]}</span>
                {t.passions[i]}
              </button>
            );
          })}
        </div>
      </div>

      {languagesSection}

      <label className="block space-y-1.5">
        <span className="label-caps">{t.profile.about}</span>
        <textarea className="field min-h-24 py-3" rows={3} value={p.bio} placeholder={t.profile.aboutPh} onChange={(e) => set({ bio: e.target.value })} />
      </label>

      <div className="space-y-1">
        <span className="label-caps">{t.profile.contact}</span>
        <button type="button" onClick={() => set({ open_to_questions: !p.open_to_questions })} aria-pressed={p.open_to_questions} className="flex min-h-14 w-full items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{t.profile.canMessage}</span>
            <span className="block text-xs text-muted">{t.profile.canMessageHint}</span>
          </span>
          <Switch on={p.open_to_questions} />
        </button>
        {(
          <button type="button" onClick={() => set({ wants_buddy: !p.wants_buddy })} aria-pressed={p.wants_buddy} className="flex min-h-14 w-full items-center gap-3 text-left">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.profile.buddy}</span>
              <span className="block text-xs text-muted">{t.profile.buddyHint}</span>
            </span>
            <Switch on={p.wants_buddy} />
          </button>
        )}
      </div>
    </div>
  );

  const errorBox = error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error === "home" ? t.profile.needHome : error === "name" ? t.profile.needName : error}</p>;

  // ---------- onboarding krok po kroku ----------
  if (mode === "onboarding") {
    const steps = stage === "searching" || !stage ? ["stage", "home", "you"] : ["stage", "home", "exchange", "you"];
    const current = steps[Math.min(step, steps.length - 1)];
    const last = step >= steps.length - 1;
    const titles: Record<string, [string, string]> = {
      stage: [t.onboarding.statusTitle, t.onboarding.statusLead],
      home: [t.onboarding.homeTitle, t.onboarding.homeLead],
      exchange: [stage === "been" ? t.onboarding.exchangeTitleBeen : stage === "abroad" ? t.onboarding.exchangeTitleAbroad : t.onboarding.exchangeTitle, t.onboarding.exchangeLead],
      you: [t.onboarding.youTitle, t.onboarding.youLead],
    };
    const canNext =
      (current === "stage" && !!stage) ||
      (current === "home" && !!p.homes[0]?.inst) ||
      (current === "exchange" && !!p.exchanges[0]?.inst && !!p.exchanges[0]?.semester) ||
      (current === "you" && p.full_name.trim().length > 1);

    const pickStage = (s: Stage) => {
      setStage(s);
      const now = semesterOptions().find((c) => semesterPhase(c) === "now") ?? null;
      set({
        exchanges:
          s === "searching"
            ? []
            : [{ inst: p.exchanges[0]?.inst ?? null, status: s === "been" ? "been" : "going", semester: s === "abroad" ? now : null }],
      });
    };

    return (
      <div className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-md flex-col gap-6 px-5 py-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            aria-label={t.common.back}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-line bg-white disabled:opacity-40"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="grid flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
            {steps.map((s, i) => (
              <div key={s} className={`h-2 rounded-full ${i < step ? "bg-ink" : i === step ? "bg-honey" : "bg-line"}`} />
            ))}
          </div>
          <span className="text-[13px] font-semibold text-muted">{t.onboarding.step(step + 1, steps.length)}</span>
        </div>

        <div>
          <h1 className="display text-[34px] leading-[1.05]">{titles[current][0]}</h1>
          <p className="mt-1.5 text-[15px] text-muted">{titles[current][1]}</p>
        </div>

        <div className="flex-1">
          {current === "stage" && (
            <div className="grid gap-3">
              {(["searching", "going", "abroad", "been"] as Stage[]).map((s) => {
                const Icon = STAGE_ICONS[s];
                const on = stage === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickStage(s)}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left font-semibold transition ${on ? "border-ink bg-honey" : "border-line bg-white hover:border-honey-deep"}`}
                  >
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? "bg-ink text-honey" : "bg-cream"}`}>
                      <Icon size={20} />
                    </span>
                    {t.stageLong[s]}
                  </button>
                );
              })}
            </div>
          )}
          {current === "home" && homeEditor(p.homes[0], 0)}
          {current === "exchange" && p.exchanges[0] && exchangeEditor(p.exchanges[0], 0, true)}
          {current === "you" && youSection}
          {current !== "stage" && current !== "you" && <p className="mt-4 text-xs text-muted">{t.profile.moreLater}</p>}
        </div>

        {errorBox}
        <button type="button" disabled={!canNext || pending} onClick={() => (last ? submit() : setStep(step + 1))} className="btn-primary sticky bottom-4 min-h-14 w-full text-lg">
          {last ? t.onboarding.finish : t.common.next}
          {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-honey border-t-transparent" /> : <ArrowRight size={20} strokeWidth={2.5} />}
        </button>
      </div>
    );
  }

  // ---------- edycja profilu ----------
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="display text-[30px]">{t.profile.title}</h1>
        <Link href={`/u/${userId}`} className="btn-honey min-h-10">
          <Eye size={16} /> {t.profile.preview}
        </Link>
      </div>
      <div className="space-y-10">
        <section>{youSection}</section>
        <section className="space-y-3">
          <h2 className="display text-xl">{t.profile.studies}</h2>
          {homesSection}
        </section>
        <section className="space-y-3">
          <h2 className="display text-xl">{t.profile.exchanges}</h2>
          {exchangesSection}
        </section>
        {errorBox}
        <button type="button" onClick={submit} disabled={pending || !p.homes[0]?.inst || !p.full_name.trim() || !exchangesValid} className="btn-primary sticky bottom-24 min-h-14 w-full text-lg md:bottom-4">
          {saved ? (
            <>
              <Check size={20} /> {t.profile.saved}
            </>
          ) : (
            t.profile.saveProfile
          )}
        </button>
      </div>
    </div>
  );
}

// Pole z podpowiedziami z tej samej uczelni (wydziały, kierunki): pierwsze wpisy ustalają nazwy dla reszty
function SuggestInput({
  rpc,
  instId,
  label,
  placeholder,
  value,
  onChange,
}: {
  rpc: "faculties_at" | "fields_at";
  instId: number | null;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const listId = useId();
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!instId) return;
    let alive = true;
    createClient()
      .rpc(rpc, { p_inst: instId })
      .then(({ data }) => alive && setOptions(((data ?? []) as Record<string, string>[]).map((r) => Object.values(r)[0])));
    return () => {
      alive = false;
    };
  }, [rpc, instId]);
  return (
    <label className="block space-y-1.5">
      <span className="label-caps">{label}</span>
      <input className="field" list={listId} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </label>
  );
}
