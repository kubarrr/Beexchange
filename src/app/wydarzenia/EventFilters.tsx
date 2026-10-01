"use client";

import { useRouter } from "next/navigation";
import { cityName } from "@/lib/cities";
import { countryName } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

// Kraj → miasto (miasto to najniższy poziom). Pokazujemy tylko miejsca, w których są wydarzenia.
export function EventFilters({ locale, cc, city, places }: { locale: Locale; cc: string; city: string; places: { cc: string; city: string }[] }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const go = (nextCc: string, nextCity: string) => {
    const sp = new URLSearchParams({ tab: "all" });
    if (nextCc) sp.set("cc", nextCc);
    if (nextCity) sp.set("city", nextCity);
    router.push(`/wydarzenia?${sp.toString()}`);
  };
  const countries = [...new Set(places.map((p) => p.cc))].map((c) => ({ c, n: countryName(c, locale) })).sort((a, b) => a.n.localeCompare(b.n, locale));
  const cities = [...new Set(places.filter((p) => p.cc === cc).map((p) => p.city))].map((c) => ({ c, n: cityName(c, locale) })).sort((a, b) => a.n.localeCompare(b.n, locale));

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1.5">
        <span className="label-caps">{t.people.country}</span>
        <select className="field" value={cc} onChange={(e) => go(e.target.value, "")}>
          <option value="">{t.common.any}</option>
          {countries.map(({ c, n }) => (
            <option key={c} value={c}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1.5">
        <span className="label-caps">{t.people.city}</span>
        <select className="field" value={city} disabled={!cc} onChange={(e) => go(cc, e.target.value)}>
          <option value="">{t.common.any}</option>
          {cities.map(({ c, n }) => (
            <option key={c} value={c}>
              {n}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
