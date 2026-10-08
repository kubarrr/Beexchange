"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteAccount } from "@/app/actions/simple";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export function DeleteAccount({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const ok = typed.trim().toUpperCase() === t.profile.deleteWord;

  return (
    <section className="mx-auto max-w-2xl px-4 pb-10">
      <div className="rounded-3xl border-2 border-red-200 bg-white p-5">
        <button type="button" onClick={() => setOpen(!open)} className="flex min-h-11 items-center gap-2 font-bold text-red-700">
          <Trash2 size={18} /> {t.profile.deleteTitle}
        </button>
        {open && (
          <form action={deleteAccount} className="mt-3 space-y-3">
            <p className="text-sm text-muted">{t.profile.deleteLead}</p>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">{t.profile.deleteHint(t.profile.deleteWord)}</span>
              <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} className="field" autoComplete="off" />
            </label>
            <button disabled={!ok} className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-red-700 px-5 font-bold text-white disabled:opacity-40">
              {t.profile.deleteButton}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
