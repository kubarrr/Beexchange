"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { addInstitution } from "@/app/actions/simple";
import { InstLine } from "@/components/bx";
import { ALL_COUNTRY_CODES } from "@/lib/countries";
import { countryName, type Institution } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

// Wszystkie kraje świata (lista z flag); posortowane po nazwie w języku użytkownika przy wyświetlaniu
export const COUNTRY_CODES: readonly string[] = ALL_COUNTRY_CODES;

export function InstitutionPicker({
  locale,
  value,
  onChange,
  prefer,
}: {
  locale: Locale;
  value: Institution | null;
  onChange: (i: Institution | null) => void;
  prefer?: string;
}) {
  const t = dictionaries[locale];
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({ name: "", country_code: prefer ?? "PL", city: "", website: "" });

  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/institutions?q=${encodeURIComponent(q)}${prefer ? `&prefer=${prefer}` : ""}`, { signal: ctrl.signal });
        if (res.ok) setResults(await res.json());
      } catch {
        // przerwane zapytanie
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, prefer]);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-ink bg-honey p-3">
        <div className="min-w-0 flex-1">
          <InstLine inst={value} locale={locale} extra={countryName(value.country_code, locale)} />
        </div>
        <button type="button" onClick={() => onChange(null)} className="btn-outline min-h-10 shrink-0 bg-cream px-3">
          {t.institution.change}
        </button>
      </div>
    );
  }

  if (adding) {
    return (
      <div className="panel space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="display text-lg">{t.institution.addTitle}</p>
          <button type="button" onClick={() => setAdding(false)} aria-label={t.common.cancel} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-sand">
            <X size={18} />
          </button>
        </div>
        <input className="field" placeholder={t.institution.addName} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <select className="field" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} aria-label={t.institution.addCountry}>
            {COUNTRY_CODES.map((c) => ({ c, n: countryName(c, locale) }))
              .sort((a, b) => a.n.localeCompare(b.n, locale))
              .map(({ c, n }) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
          </select>
          <input className="field" placeholder={t.institution.addCity} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </div>
        <input className="field" placeholder={t.institution.addWebsite} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
        <p className="text-xs text-muted">{t.institution.pendingNote}</p>
        <button
          type="button"
          disabled={pending || form.name.trim().length < 4}
          onClick={() =>
            startTransition(async () => {
              const inst = await addInstitution(form);
              setAdding(false);
              onChange(inst);
            })
          }
          className="btn-primary w-full"
        >
          <Plus size={18} /> {t.institution.addSubmit}
        </button>
      </div>
    );
  }

  const shown = q.trim().length >= 2 ? results : [];

  return (
    <div className="space-y-2">
      <label className="flex min-h-[54px] items-center gap-2.5 rounded-2xl border-2 border-ink bg-white px-4 shadow-[0_4px_0_#17140f]">
        <Search size={20} strokeWidth={2.5} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.institution.searchPh}
          aria-label={t.institution.searchPh}
          className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-[#8a8170]"
          autoComplete="off"
        />
        {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-t-transparent" />}
      </label>
      {shown.length > 0 && (
        <ul className="panel divide-y divide-sand overflow-hidden">
          {shown.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onChange(i)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-cream">
                <span className="min-w-0 flex-1">
                  <InstLine inst={i} locale={locale} extra={countryName(i.country_code, locale)} />
                </span>
                <Check size={18} className="text-line" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !loading && shown.length === 0 && <p className="px-1 text-sm text-muted">{t.institution.noResults}</p>}
      <button type="button" onClick={() => setAdding(true)} className="min-h-11 px-1 text-sm font-semibold underline">
        {t.institution.missing}
      </button>
    </div>
  );
}
