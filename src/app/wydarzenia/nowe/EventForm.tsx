"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cityName } from "@/lib/cities";
import { createEvent } from "@/app/actions/bx";
import { Switch } from "@/components/bx";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { EventPhoto } from "./EventPhoto";

// Nazwy krajów liczy serwer: Node i przeglądarki mają różne słowniki (np. „Falklandy (Malwiny)” vs „Falklandy”)
export function EventForm({
  locale,
  defaultCountry,
  userId,
  countries,
}: {
  locale: Locale;
  defaultCountry: string;
  userId: string;
  countries: { c: string; n: string }[];
}) {
  const t = dictionaries[locale];
  const [online, setOnline] = useState(false);
  // Godzinę z pola zamieniamy na czas UTC w przeglądarce, z uwzględnieniem czasu letniego/zimowego w dniu wydarzenia
  const [startsAt, setStartsAt] = useState("");
  // Miasta z bazy uczelni wybranego kraju (zapisujemy nazwę z bazy, wyświetlamy po polsku w wersji PL)
  const [country, setCountry] = useState(defaultCountry);
  const [cities, setCities] = useState<{ c: string; n: string }[] | null>(null);
  useEffect(() => {
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
    <form action={createEvent} className="space-y-4">
      <input type="hidden" name="starts_at_iso" value={startsAt} />
      <label className="block space-y-1.5">
        <span className="label-caps">{t.events.fTitle}</span>
        <input name="title" required minLength={3} maxLength={150} placeholder={t.events.fTitlePh} className="field" />
      </label>
      <label className="block space-y-1.5">
        <span className="label-caps">{t.events.fWhen}</span>
        <input
          type="datetime-local"
          required
          className="field"
          onChange={(e) => setStartsAt(e.target.value ? new Date(e.target.value).toISOString() : "")}
        />
      </label>
      <button type="button" onClick={() => setOnline(!online)} aria-pressed={online} className="flex min-h-14 w-full items-center gap-3 text-left">
        <span className="flex-1 font-semibold">{t.events.fOnline}</span>
        <Switch on={online} />
      </button>
      {online && <input type="hidden" name="is_online" value="on" />}
      {!online && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="label-caps">{t.events.fCountry}</span>
            <select name="country_code" value={country} onChange={(e) => setCountry(e.target.value)} className="field">
              {countries.map(({ c, n }) => (
                  <option key={c} value={c}>
                    {n}
                  </option>
                ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="label-caps">{t.events.fCity}</span>
            <select name="city" required className="field" defaultValue="" key={country}>
              <option value="" disabled>
                {cities === null ? "…" : t.events.fCityPick}
              </option>
              {(cities ?? []).map(({ c, n }) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="label-caps">{t.events.fPlace}</span>
            <input name="location" placeholder={t.events.fPlacePh} className="field" />
          </label>
        </div>
      )}
      <label className="block space-y-1.5">
        <span className="label-caps">{t.events.fLink}</span>
        <input name="link" type="url" placeholder="https://" className="field" />
      </label>
      <fieldset className="space-y-2">
        <legend className="label-caps">{t.events.fAudience}</legend>
        <div className="flex flex-wrap gap-2">
          {(["all", "alumni", "going"] as const).map((a) => (
            <label key={a} className="chip cursor-pointer has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-honey">
              <input type="radio" name="audience" value={a} defaultChecked={a === "all"} className="sr-only" />
              {t.events.audience[a]}
            </label>
          ))}
        </div>
      </fieldset>
      <EventPhoto locale={locale} userId={userId} />
      <div className="space-y-1.5">
        <label className="block space-y-1.5">
          <span className="label-caps">{t.events.fDesc}</span>
          <textarea name="description" rows={4} aria-describedby="event-desc-hint" className="field py-3" />
        </label>
        <p id="event-desc-hint" className="text-xs text-muted">
          {t.events.fDescHint}
        </p>
      </div>
      <button className="btn-primary min-h-14 w-full text-lg">{t.events.fSubmit}</button>
    </form>
  );
}
