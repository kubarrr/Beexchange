"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestCheck } from "@/app/actions/bx";
import { cityName } from "@/lib/cities";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";

// „Inne miasto”: kraj → miasto z bazy uczelni. Nazwy krajów przychodzą z serwera (takie same w Node i przeglądarce).
export function CityPicker({ locale, cc, city, tab, countries }: { locale: Locale; cc: string; city: string; tab: string; countries: { c: string; n: string }[] }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [country, setCountry] = useState(cc);
  const [cities, setCities] = useState<{ c: string; n: string }[]>([]);
  useEffect(() => {
    if (!country) return;
    let alive = true;
    createClient()
      .rpc("cities_in_country", { p_cc: country })
      .then(({ data }) => {
        if (!alive) return;
        const list = ((data ?? []) as { city: string }[]).map(({ city }) => ({ c: city, n: cityName(city, locale) }));
        setCities(list.sort((a, b) => a.n.localeCompare(b.n, locale)));
      });
    return () => {
      alive = false;
    };
  }, [country, locale]);

  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1.5">
        <span className="label-caps">{t.people.country}</span>
        <select className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
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
        <select
          className="field"
          value={country === cc ? city : ""}
          disabled={!country}
          onChange={(e) => e.target.value && router.push(`/mieszkania?other=1&tab=${tab}&cc=${country}&city=${encodeURIComponent(e.target.value)}`)}
        >
          <option value="">{t.events.fCityPick}</option>
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

// „Poproś o sprawdzenie”: rozwija pole na szczegóły i wysyła prośbę (z wiadomością w czacie)
export function CheckRequest({ locale, checkerId, cc, city, sent }: { locale: Locale; checkerId: string; cc: string; city: string; sent: boolean }) {
  const t = dictionaries[locale];
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(sent);
  if (done) return <span className="rounded-xl border-2 border-ink px-3 py-2 text-xs font-bold">{t.housing.checkSent}</span>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-honey min-h-10 bg-ink text-honey hover:bg-black">
        {t.housing.askCheck}
      </button>
    );
  return (
    <form
      action={async (fd) => {
        await requestCheck(fd);
        setDone(true);
      }}
      className="w-full space-y-2"
    >
      <input type="hidden" name="checker_id" value={checkerId} />
      <input type="hidden" name="country_code" value={cc} />
      <input type="hidden" name="city" value={city} />
      <label className="block space-y-1.5">
        <span className="text-xs font-semibold">{t.housing.checkDetails}</span>
        <textarea name="details" required minLength={5} rows={3} placeholder={t.housing.checkDetailsPh} className="field py-2.5 text-sm" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-outline min-h-10 flex-1">
          {t.common.cancel}
        </button>
        <button className="btn-primary min-h-10 flex-1">{t.housing.send}</button>
      </div>
    </form>
  );
}
