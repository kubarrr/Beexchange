"use client";

import { useState } from "react";
import { requestCheck } from "@/app/actions/bx";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

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
