"use client";

import { useRouter } from "next/navigation";
import { InstitutionPicker, COUNTRY_CODES } from "@/components/InstitutionPicker";
import { cityName } from "@/lib/cities";
import { countryName, semesterLabel, semesterOptions, type Institution } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export type DiscoverQuery = { tab: "all" | "semester" | "city" | "country"; cc: string; city: string; inst: Institution | null; sem: string };

function toUrl(q: DiscoverQuery) {
  const sp = new URLSearchParams();
  if (q.tab !== "all") sp.set("tab", q.tab);
  if (q.cc) sp.set("cc", q.cc);
  if (q.city) sp.set("city", q.city);
  if (q.inst) sp.set("inst", String(q.inst.id));
  if (q.sem) sp.set("sem", q.sem);
  return `/grupy?${sp.toString()}`;
}

export function DiscoverFilters({ locale, q, cities }: { locale: Locale; q: DiscoverQuery; cities: string[] }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const go = (patch: Partial<DiscoverQuery>) => router.push(toUrl({ ...q, ...patch }));
  const tabs = [
    ["all", t.discover.all],
    ["semester", t.discover.unis],
    ["city", t.discover.cities],
    ["country", t.discover.countries],
  ] as const;
  const countries = COUNTRY_CODES.map((cc) => ({ cc, name: countryName(cc, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} type="button" onClick={() => go({ tab: k })} className={`chip ${q.tab === k ? "chip-on" : ""}`}>
            {label}
          </button>
        ))}
      </div>

      {q.tab === "semester" ? (
        <InstitutionPicker locale={locale} value={q.inst} onChange={(inst) => go({ inst })} />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className="label-caps">{t.people.country}</span>
            <select className="field" value={q.cc} onChange={(e) => go({ cc: e.target.value, city: "" })}>
              <option value="">{t.common.any}</option>
              {countries.map(({ cc, name }) => (
                <option key={cc} value={cc}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {q.tab !== "country" && (
            <label className="space-y-1.5">
              <span className="label-caps">{t.people.city}</span>
              <select className="field" value={q.city} disabled={!q.cc} onChange={(e) => go({ city: e.target.value })}>
                <option value="">{t.common.any}</option>
                {cities
                  .map((c) => ({ c, n: cityName(c, locale) }))
                  .sort((a, b) => a.n.localeCompare(b.n, locale))
                  .map(({ c, n }) => (
                    <option key={c} value={c}>
                      {n}
                    </option>
                  ))}
              </select>
            </label>
          )}
        </div>
      )}

      <label className="block space-y-1.5">
        <span className="label-caps">{t.people.semester}</span>
        <select className="field" value={q.sem} onChange={(e) => go({ sem: e.target.value })}>
          <option value="">{t.common.any}</option>
          {semesterOptions().map((c) => (
            <option key={c} value={c}>
              {semesterLabel(c, t)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
