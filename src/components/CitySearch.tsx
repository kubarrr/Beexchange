"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Flag } from "@/components/bx";
import { cityName, cityQueryCandidates } from "@/lib/cities";
import { countryName } from "@/lib/domain";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";
import { createClient } from "@/lib/supabase/client";

type Place = { cc: string; city: string };
type Popular = Place & { n: number };

// Wyszukiwarka miasta (Mieszkania, Wydarzenia). Bieżące miasto to plakietka w polu; po kliknięciu lista
// podpowiada moje miasta i popularne, a po wpisaniu szuka w miastach uczelni — także po polsku („Mediolan”).
export function CitySearch({
  locale,
  current,
  mine,
  popular = [],
  popularLabel,
  basePath,
  extra = "",
}: {
  locale: Locale;
  current: Place | null;
  mine: Place[];
  popular?: Popular[];
  popularLabel?: string;
  basePath: string;
  extra?: string;
}) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<Place[]>([]);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const typing = q.trim().length >= 2;

  useEffect(() => {
    const clean = q.replace(/[^\p{L}\s.'-]/gu, "").trim();
    if (clean.length < 2) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const ors = cityQueryCandidates(clean).map((c) => `city.ilike.${c}%`).join(",");
      const { data } = await createClient().from("institutions").select("city, country_code").or(ors).not("city", "is", null).limit(400);
      if (!alive) return;
      // Najpierw miasta z największą liczbą uczelni
      const count = new Map<string, Popular>();
      for (const r of (data ?? []) as { city: string; country_code: string }[]) {
        const key = `${r.country_code}:${r.city.toLowerCase()}`;
        count.set(key, { cc: r.country_code, city: r.city, n: (count.get(key)?.n ?? 0) + 1 });
      }
      setFound([...count.values()].sort((a, b) => b.n - a.n).slice(0, 8));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  // Zamknij listę po kliknięciu obok
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const go = (p: Place) => {
    setOpen(false);
    setQ("");
    router.push(`${basePath}?cc=${p.cc}&city=${encodeURIComponent(p.city)}${extra ? `&${extra}` : ""}`);
  };
  const key = (p: Place) => `${p.cc}:${p.city.toLowerCase()}`;
  const mineKeys = new Set(mine.map(key));
  const popularRest = popular.filter((p) => !mineKeys.has(key(p))).slice(0, 6);

  const row = (p: Place, n?: number) => (
    <button key={key(p)} type="button" onClick={() => go(p)} className="flex min-h-11 w-full items-center gap-2.5 px-3.5 text-left hover:bg-cream">
      <Flag code={p.cc} className="h-3.5 w-5" />
      <span className="font-semibold">{cityName(p.city, locale)}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted">{countryName(p.cc, locale)}</span>
      {n !== undefined && <span className="text-xs font-bold text-muted">{n}</span>}
    </button>
  );
  const heading = (text: string) => <p className="px-3.5 pt-2.5 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{text}</p>;

  return (
    <div ref={box} className="relative">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-3 focus-within:border-ink">
        <Search size={18} className="shrink-0 text-muted" />
        {current && !q && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-honey px-2.5 py-1 text-sm font-bold">
            <Flag code={current.cc} className="h-3 w-[18px]" />
            {cityName(current.city, locale)}
          </span>
        )}
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={current ? t.events.searchOther : t.events.searchCity}
          aria-label={t.events.searchCity}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-[60vh] overflow-y-auto rounded-2xl border-[1.5px] border-line bg-white pb-1.5 shadow-lg">
          {typing ? (
            found.length ? (
              found.map((p) => row(p))
            ) : (
              <p className="px-3.5 py-3 text-sm text-muted">…</p>
            )
          ) : (
            <>
              <p className="px-3.5 pt-3 text-sm text-muted">{t.events.typeHint}</p>
              {mine.length > 0 && heading(t.events.yourCities)}
              {mine.map((p) => row(p))}
              {popularRest.length > 0 && heading(popularLabel ?? "")}
              {popularRest.map((p) => row(p, p.n))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
