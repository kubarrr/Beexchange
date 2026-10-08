"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Trash2 } from "lucide-react";
import { saveMe, type EntryKind } from "@/app/actions/simple";
import { InstitutionPicker } from "@/components/InstitutionPicker";
import { Switch } from "@/components/bx";
import { semesterLabel, semesterOptions, semesterPhase, type Institution } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export type Entry = { kind: EntryKind; inst: Institution | null; semester: string | null };
export type MeInitial = {
  display_name: string;
  home: Institution | null;
  instagram: string;
  facebook: string;
  whatsapp: string;
  looking_for_housing: boolean;
  is_buddy: boolean;
  entries: Entry[];
};


export function MeForm({ locale, initial }: { locale: Locale; initial: MeInitial }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [me, setMe] = useState<MeInitial>({ ...initial, entries: initial.entries.length ? initial.entries : [{ kind: "exchange", inst: null, semester: null }] });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const set = (patch: Partial<MeInitial>) => {
    setSaved(false);
    setMe((m) => ({ ...m, ...patch }));
  };
  const setEntry = (i: number, patch: Partial<Entry>) => set({ entries: me.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)) });

  function submit() {
    setError("");
    start(async () => {
      const res = await saveMe({
        display_name: me.display_name,
        home_institution_id: me.home?.id ?? null,
        instagram: me.instagram,
        facebook: me.facebook,
        whatsapp: me.whatsapp,
        looking_for_housing: me.looking_for_housing,
        is_buddy: me.is_buddy,
        entries: me.entries.filter((e) => e.inst).map((e) => ({ kind: e.kind, institution_id: e.inst!.id, semester: e.semester })),
      });
      if (!res.ok) {
        setError(res.error === "name" ? t.simple.errName : res.error === "contact" ? t.simple.errContact : res.error === "entries" ? t.simple.errEntries : res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  const contact = (key: "instagram" | "facebook" | "whatsapp", ph: string, type = "text") => (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{t.simple[key]}</span>
      <input className="field" type={type} value={me[key]} placeholder={ph} onChange={(e) => set({ [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <label className="block space-y-1.5">
          <span className="label-caps">{t.simple.name}</span>
          <input className="field font-semibold" value={me.display_name} placeholder={t.simple.namePh} maxLength={60} onChange={(e) => set({ display_name: e.target.value })} />
        </label>
        <div className="space-y-1.5">
          <span className="label-caps">{t.simple.homeUni}</span>
          <InstitutionPicker locale={locale} value={me.home} onChange={(home) => set({ home })} prefer="PL" />
          <p className="text-xs text-muted">{t.simple.homeUniHint}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label-caps">{t.simple.contacts}</h2>
        {contact("instagram", t.simple.instagramPh)}
        {contact("facebook", t.simple.facebookPh)}
        {contact("whatsapp", t.simple.whatsappPh, "tel")}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="display text-xl">{t.simple.entries}</h2>
          <p className="text-sm text-muted">{t.simple.entriesLead}</p>
        </div>
        {me.entries.map((e, i) => (
          <div key={i} className="panel space-y-3 p-4">
            {me.entries.length > 1 && (
              <div className="flex justify-end">
                <button type="button" aria-label={t.simple.remove} onClick={() => set({ entries: me.entries.filter((_, j) => j !== i) })} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-red-700">
                  <Trash2 size={17} />
                </button>
              </div>
            )}
            <p className="text-xs font-semibold text-muted">{t.simple.kindHint.exchange}</p>
            <InstitutionPicker locale={locale} value={e.inst} onChange={(inst) => setEntry(i, { inst })} />
            {e.kind === "exchange" && (
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold">{t.simple.semester}</span>
                <select className="field" value={e.semester ?? ""} required onChange={(ev) => setEntry(i, { semester: ev.target.value || null })}>
                  <option value="" disabled>
                    {t.simple.pickSemester}
                  </option>
                  {semesterOptions().map((c) => (
                    <option key={c} value={c}>
                      {semesterLabel(c, t)}
                      {semesterPhase(c) === "now" ? ` · ${t.simple.now}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        ))}
        {me.entries.length < 10 && me.entries.every((e) => e.inst && e.semester) && (
          <button type="button" onClick={() => set({ entries: [...me.entries, { kind: "exchange", inst: null, semester: null }] })} className="btn-outline w-full border-dashed">
            <Plus size={16} /> {t.simple.addEntry}
          </button>
        )}
      </section>

      <button type="button" aria-pressed={me.looking_for_housing} onClick={() => set({ looking_for_housing: !me.looking_for_housing })} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t.simple.housing}</span>
          <span className="block text-xs text-muted">{t.simple.housingHint}</span>
        </span>
        <Switch on={me.looking_for_housing} />
      </button>
      <button
        type="button"
        aria-pressed={me.is_buddy}
        disabled={!me.home}
        onClick={() => set({ is_buddy: !me.is_buddy })}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white px-4 text-left disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t.simple.buddy}</span>
          <span className="block text-xs text-muted">{me.home ? t.simple.buddyHint : t.simple.buddyNeedsHome}</span>
        </span>
        <Switch on={me.is_buddy && !!me.home} />
      </button>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="button" onClick={submit} disabled={pending} className="btn-primary sticky bottom-4 min-h-14 w-full text-lg">
        {saved ? (
          <>
            <Check size={20} /> {t.simple.saved}
          </>
        ) : (
          t.simple.save
        )}
      </button>
    </div>
  );
}
