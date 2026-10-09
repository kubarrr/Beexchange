"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { InstitutionPicker } from "@/components/InstitutionPicker";
import { cityName } from "@/lib/cities";
import { currentSemester, nextSemester, semesterLabel, semesterOptions, semesterPhase, type Institution } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";

// Kraj i miasto są wymagane, uczelnia opcjonalna. Wybranie uczelni ustawia jej kraj i miasto.
export function SearchForm({
  locale,
  tab,
  initial,
  countries,
}: {
  locale: Locale;
  tab: string;
  initial: { cc: string; city: string; inst: Institution | null; sem: string | null; from: string | null };
  countries: { c: string; n: string }[];
}) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [cc, setCc] = useState(initial.cc);
  const [city, setCity] = useState(initial.city);
  const [inst, setInst] = useState<Institution | null>(initial.inst);
  const [sem, setSem] = useState(initial.sem ?? "");
  const [from, setFrom] = useState(initial.from ?? "");
  // „Jadą”: najbliższe przyszłe semestry; „Są lub byli”: bieżący i wcześniejsze
  const next1 = nextSemester(currentSemester());
  const next2 = nextSemester(next1);
  const sems =
    tab === "going"
      ? [next1, next2, nextSemester(next2)]
      : tab === "been"
        ? semesterOptions().filter((c) => semesterPhase(c) !== "upcoming")
        : [];
  const [cities, setCities] = useState<{ c: string; n: string }[]>([]);

  useEffect(() => {
    if (!cc) return;
    let alive = true;
    createClient()
      .rpc("cities_in_country", { p_cc: cc })
      .then(({ data }) => {
        if (!alive) return;
        const list = ((data ?? []) as { city: string }[]).map(({ city }) => ({ c: city, n: cityName(city, locale) }));
        setCities(list.sort((a, b) => a.n.localeCompare(b.n, locale)));
      });
    return () => {
      alive = false;
    };
  }, [cc, locale]);

  const pickInst = (i: Institution | null) => {
    setInst(i);
    if (i?.city) {
      setCc(i.country_code);
      setCity(i.city);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!cc || !city) return;
        const sp = new URLSearchParams({ tab, cc, city });
        if (inst) sp.set("inst", String(inst.id));
        if (sem) sp.set("sem", sem);
        if (from) sp.set("from", from);
        router.push(`/?${sp.toString()}`);
      }}
      className="panel space-y-4 p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1.5">
          <span className="label-caps">{t.simple.country}</span>
          <select
            className="field"
            value={cc}
            required
            onChange={(e) => {
              setCc(e.target.value);
              setCity("");
              setInst(null);
            }}
          >
            <option value="" disabled>
              {t.simple.pickCountry}
            </option>
            {countries.map(({ c, n }) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="label-caps">{t.simple.city}</span>
          <select className="field" value={city} required disabled={!cc} onChange={(e) => (setCity(e.target.value), setInst(null))}>
            <option value="" disabled>
              {t.simple.pickCity}
            </option>
            {/* wybrane miasto zostaje na liście, zanim dociągną się pozostałe */}
            {city && !cities.some((x) => x.c === city) && <option value={city}>{cityName(city, locale)}</option>}
            {cities.map(({ c, n }) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="space-y-1.5">
        <span className="label-caps">{t.simple.uni}</span>
        <InstitutionPicker locale={locale} value={inst} onChange={pickInst} prefer={cc || undefined} />
      </div>
      {sems.length > 0 && (
        <div className="grid grid-cols-2 items-end gap-2">
          <label className="space-y-1.5">
            <span className="label-caps">{t.simple.semesterFilter}</span>
            <select className="field pr-1 pl-3 text-sm" value={sem} onChange={(e) => setSem(e.target.value)}>
              <option value="">{t.simple.anySemester}</option>
              {sems.map((c) => (
                <option key={c} value={c}>
                  {semesterLabel(c, t)}
                  {semesterPhase(c) === "now" ? ` · ${t.simple.now}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="label-caps">{t.simple.fromFilter}</span>
            <select className="field pr-1 pl-3 text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">{t.simple.anyCountry}</option>
              {countries.map(({ c, n }) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <button className="btn-primary min-h-12 w-full" disabled={!cc || !city}>
        <Search size={18} /> {t.simple.search}
      </button>
    </form>
  );
}

// „Twój buddy” na Twojej uczelni: wystarczy wybrać uczelnię
export function HomeUniForm({ locale, initial }: { locale: Locale; initial: Institution | null }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [inst, setInst] = useState<Institution | null>(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (inst) router.push(`/?tab=helper&mode=home&inst=${inst.id}`);
      }}
      className="panel space-y-4 p-4"
    >
      <div className="space-y-1.5">
        <span className="label-caps">{t.simple.yourUni}</span>
        <InstitutionPicker locale={locale} value={inst} onChange={setInst} prefer="PL" />
      </div>
      <button className="btn-primary min-h-12 w-full" disabled={!inst}>
        <Search size={18} /> {t.simple.search}
      </button>
    </form>
  );
}
