"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Switch } from "@/components/bx";
import { InstitutionPicker } from "@/components/InstitutionPicker";
import { countryName, institutionShort, semesterLabel, semesterOptions, type Institution } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";
import { cityName } from "@/lib/cities";

export type PeopleQuery = {
  seg: "all" | "going" | "been";
  hu: Institution | null;
  ex: Institution | null;
  field: string;
  cc: string;
  city: string;
  sem: string;
  buddy: boolean;
  open: boolean;
};

function toUrl(f: PeopleQuery) {
  const sp = new URLSearchParams();
  if (f.seg !== "all") sp.set("seg", f.seg);
  if (f.hu) sp.set("hu", String(f.hu.id));
  sp.set("ex", f.ex ? String(f.ex.id) : "all");
  if (f.field) sp.set("field", f.field);
  if (f.cc) sp.set("cc", f.cc);
  if (f.city) sp.set("city", f.city);
  if (f.sem) sp.set("sem", f.sem);
  if (f.buddy) sp.set("buddy", "1");
  if (f.open) sp.set("open", "1");
  return `/ludzie?${sp.toString()}`;
}

// Szybki wybór jednej z moich uczelni (macierzystych albo wymiany)
function MineChips({ list, value, onPick, locale, label }: { list: Institution[]; value: Institution | null; onPick: (i: Institution) => void; locale: Locale; label: string }) {
  const rest = list.filter((i) => i.id !== value?.id);
  if (!rest.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}:</span>
      {rest.map((i) => (
        <button key={i.id} type="button" onClick={() => onPick(i)} className="chip min-h-8 px-3 py-1 text-[13px]">
          {institutionShort(i, locale)}
        </button>
      ))}
    </div>
  );
}

export function PeopleFilters({
  locale,
  initial,
  myHomes,
  myExchanges,
  places,
}: {
  locale: Locale;
  initial: PeopleQuery;
  myHomes: Institution[];
  myExchanges: Institution[];
  places: { city: string; cc: string }[];
}) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const apply = (next: PeopleQuery) => {
    setF(next);
    router.push(toUrl(next));
  };

  // Podpowiedzi kierunków i wydziałów z wybranej uczelni macierzystej
  const huId = f.hu?.id;
  useEffect(() => {
    if (!huId) return;
    let cancelled = false;
    const supabase = createClient();
    Promise.all([supabase.rpc("fields_at", { p_inst: huId }), supabase.rpc("faculties_at", { p_inst: huId })]).then(([a, b]) => {
      if (cancelled) return;
      const names = [...((a.data ?? []) as { field: string }[]).map((r) => r.field), ...((b.data ?? []) as { faculty: string }[]).map((r) => r.faculty)];
      setSuggestions([...new Set(names)]);
    });
    return () => {
      cancelled = true;
    };
  }, [huId]);

  // Dodatkowe filtry (w panelu „Więcej filtrów”)
  const extra: { label: string; clear: Partial<PeopleQuery> }[] = [];
  if (initial.cc) extra.push({ label: countryName(initial.cc, locale), clear: { cc: "", city: "" } });
  if (initial.city) extra.push({ label: cityName(initial.city, locale), clear: { city: "" } });
  if (initial.sem) extra.push({ label: semesterLabel(initial.sem, t), clear: { sem: "" } });
  if (initial.buddy) extra.push({ label: `🧸 ${t.people.buddy}`, clear: { buddy: false } });
  if (initial.open) extra.push({ label: t.people.onlyOpen, clear: { open: false } });

  const countries = [...new Set(places.map((p) => p.cc))].map((cc) => ({ cc, name: countryName(cc, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale));
  const cities = [...new Set(places.filter((p) => !f.cc || p.cc === f.cc).map((p) => p.city))]
    .map((c) => ({ c, n: cityName(c, locale) }))
    .sort((a, b) => a.n.localeCompare(b.n, locale));

  const toggles = [
    { key: "buddy", label: `🧸 ${t.people.onlyBuddy}`, hint: t.people.onlyBuddyHint },
    { key: "open", label: t.people.onlyOpen, hint: t.people.onlyOpenHint },
  ] as const;

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          apply(f);
        }}
        className="panel space-y-4 p-4"
      >
        <div className="space-y-2">
          <span className="label-caps">{t.people.homeUni}</span>
          <InstitutionPicker locale={locale} value={f.hu} onChange={(hu) => setF({ ...f, hu })} />
          <MineChips list={myHomes} value={f.hu} onPick={(hu) => setF({ ...f, hu })} locale={locale} label={t.people.mine} />
        </div>
        <div className="space-y-2">
          <span className="label-caps">{t.people.exchangeUni}</span>
          <InstitutionPicker locale={locale} value={f.ex} onChange={(ex) => setF({ ...f, ex })} />
          <MineChips list={myExchanges} value={f.ex} onPick={(ex) => setF({ ...f, ex })} locale={locale} label={t.people.mine} />
        </div>
        <label className="block space-y-2">
          <span className="label-caps">{t.people.field}</span>
          <input className="field" value={f.field} list="people-field-suggestions" placeholder={t.people.fieldPh} onChange={(e) => setF({ ...f, field: e.target.value })} />
          <datalist id="people-field-suggestions">
            {(huId ? suggestions : []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <div className="flex gap-2.5">
          <button type="submit" className="btn-primary min-h-12 flex-1">
            <Search size={18} /> {t.people.search}
          </button>
          <button type="button" onClick={() => setOpen(true)} aria-label={t.people.moreFilters} className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-ink">
            <SlidersHorizontal size={20} />
            {extra.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-cream bg-honey px-1 text-[11px] font-extrabold text-ink">{extra.length}</span>
            )}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
        {(["all", "going", "been"] as const).map((s) => (
          <button key={s} type="button" onClick={() => apply({ ...f, seg: s })} className={`min-h-10 rounded-xl text-sm font-semibold ${initial.seg === s ? "bg-ink text-honey" : ""}`}>
            {{ all: t.people.segAll, going: t.people.segGoing, been: t.people.segBeen }[s]}
          </button>
        ))}
      </div>

      {extra.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {extra.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => apply({ ...initial, ...c.clear })}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-honey py-1.5 pr-2 pl-3 text-[13px] font-semibold"
            >
              <span className="truncate">{c.label}</span>
              <X size={14} strokeWidth={3} />
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-40 flex flex-col justify-end md:items-center md:justify-center">
          <button type="button" aria-label={t.common.cancel} onClick={() => setOpen(false)} className="absolute inset-0 bg-ink/55" />
          <div className="relative max-h-[88dvh] w-full overflow-y-auto rounded-t-[28px] bg-paper px-5 pt-2.5 pb-6 md:max-w-lg md:rounded-[28px]">
            <div className="mx-auto mb-3 h-[5px] w-11 rounded-full bg-line md:hidden" />
            <div className="flex items-center justify-between">
              <h2 className="display text-2xl">{t.people.moreFilters}</h2>
              <button type="button" onClick={() => setF({ ...f, cc: "", city: "", sem: "", buddy: false, open: false })} className="min-h-11 text-sm font-semibold underline">
                {t.common.clear}
              </button>
            </div>

            <div className="mt-4 space-y-5">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-2">
                  <span className="label-caps">{t.people.country}</span>
                  <select className="field" value={f.cc} onChange={(e) => setF({ ...f, cc: e.target.value, city: "" })}>
                    <option value="">{t.common.any}</option>
                    {countries.map(({ cc, name }) => (
                      <option key={cc} value={cc}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="label-caps">{t.people.city}</span>
                  <select className="field" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })}>
                    <option value="">{t.common.any}</option>
                    {cities.map(({ c, n }) => (
                      <option key={c} value={c}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <span className="label-caps">{t.people.semester}</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setF({ ...f, sem: "" })} className={`chip ${!f.sem ? "chip-on" : ""}`}>
                    {t.common.any}
                  </button>
                  {semesterOptions().map((c) => (
                    <button key={c} type="button" onClick={() => setF({ ...f, sem: c })} className={`chip ${f.sem === c ? "chip-on" : ""}`}>
                      {semesterLabel(c, t)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="label-caps">{t.people.onlyShow}</span>
                {toggles.map((tg) => (
                  <button key={tg.key} type="button" aria-pressed={f[tg.key]} onClick={() => setF({ ...f, [tg.key]: !f[tg.key] })} className="flex min-h-14 w-full items-center gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{tg.label}</span>
                      <span className="block text-xs text-muted">{tg.hint}</span>
                    </span>
                    <Switch on={f[tg.key]} />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  apply(f);
                }}
                className="btn-primary min-h-14 w-full text-lg"
              >
                {t.people.show}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
