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

// Zwykła wyszukiwarka miasta (Mieszkania, Wydarzenia). Bez wpisywania podpowiada moje miasta,
// po wpisaniu szuka w miastach uczelni — także po polskiej nazwie („Mediolan” → Milan).
export function CitySearch({ locale, current, mine, basePath, extra = "" }: { locale: Locale; current: Place | null; mine: Place[]; basePath: string; extra?: string }) {
  const t = dictionaries[locale];
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<Place[]>([]);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clean = q.replace(/[^\p{L}\s.'-]/gu, "").trim();
    if (clean.length < 2) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const ors = cityQueryCandidates(clean).map((c) => `city.ilike.${c}%`).join(",");
      const { data } = await createClient().from("institutions").select("city, country_code").or(ors).not("city", "is", null).limit(400);
      if (!alive) return;
      // Najpierw miasta z największą liczbą uczelni
      const count = new Map<string, Place & { n: number }>();
      for (const r of (data ?? []) as { city: string; country_code: string }[]) {
        const key = `${r.country_code}:${r.city.toLowerCase()}`;
        const prev = count.get(key);
        count.set(key, { cc: r.country_code, city: r.city, n: (prev?.n ?? 0) + 1 });
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
  const list = q.trim().length >= 2 ? found : mine;

  return (
    <div ref={box} className="relative">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-line bg-white px-3.5 focus-within:border-ink">
        {current && !q ? <Flag code={current.cc} className="h-3.5 w-5" /> : <Search size={18} className="shrink-0 text-muted" />}
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={current ? cityName(current.city, locale) : t.events.searchCity}
          aria-label={t.events.searchCity}
          className={`min-w-0 flex-1 bg-transparent outline-none ${current && !q ? "font-semibold placeholder:text-ink" : ""}`}
        />
      </label>
      {open && list.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-2xl border-[1.5px] border-line bg-white shadow-lg">
          {q.trim().length < 2 && <p className="px-3.5 pt-2.5 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{t.events.yourCities}</p>}
          {list.map((p) => (
            <button key={`${p.cc}:${p.city}`} type="button" onClick={() => go(p)} className="flex min-h-11 w-full items-center gap-2.5 px-3.5 text-left hover:bg-cream">
              <Flag code={p.cc} className="h-3.5 w-5" />
              <span className="font-semibold">{cityName(p.city, locale)}</span>
              <span className="text-[13px] text-muted">{countryName(p.cc, locale)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
