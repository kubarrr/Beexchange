"use client";

import { useState } from "react";
import { createEvent } from "@/app/actions/bx";
import { Switch } from "@/components/bx";
import { COUNTRY_CODES } from "@/components/InstitutionPicker";
import { countryName } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export function EventForm({ locale, defaultCountry }: { locale: Locale; defaultCountry: string }) {
  const t = dictionaries[locale];
  const [online, setOnline] = useState(false);
  // Godzinę z pola zamieniamy na czas UTC w przeglądarce, z uwzględnieniem czasu letniego/zimowego w dniu wydarzenia
  const [startsAt, setStartsAt] = useState("");

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
            <span className="label-caps">{t.events.fCity}</span>
            <input name="city" required className="field" />
          </label>
          <label className="block space-y-1.5">
            <span className="label-caps">{t.events.fCountry}</span>
            <select name="country_code" defaultValue={defaultCountry} className="field">
              {COUNTRY_CODES.map((c) => ({ c, n: countryName(c, locale) }))
                .sort((a, b) => a.n.localeCompare(b.n, locale))
                .map(({ c, n }) => (
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
      <label className="block space-y-1.5">
        <span className="label-caps">{t.events.fDesc}</span>
        <textarea name="description" rows={4} className="field py-3" />
      </label>
      <button className="btn-primary min-h-14 w-full text-lg">{t.events.fSubmit}</button>
    </form>
  );
}
