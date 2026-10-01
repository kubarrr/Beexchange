import type { SupabaseClient } from "@supabase/supabase-js";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export type PlacePhotoRow = { country_code: string; city: string; url: string; author: string; license: string; source_url: string };
export const placeKey = (cc: string | null | undefined, city: string | null | undefined) => `${cc ?? ""}:${city ?? ""}`;

// Zdjęcia miast dla listy miejsc (jedno zapytanie)
export async function loadPlacePhotos(supabase: SupabaseClient, places: { cc: string | null | undefined; city: string | null | undefined }[]) {
  const cities = [...new Set(places.map((p) => p.city).filter((c): c is string => !!c))];
  const map = new Map<string, PlacePhotoRow>();
  if (!cities.length) return map;
  const { data } = await supabase.from("place_photos").select("country_code, city, url, author, license, source_url").in("city", cities);
  for (const r of (data ?? []) as PlacePhotoRow[]) map.set(placeKey(r.country_code, r.city), r);
  return map;
}

// Podpis wymagany przez licencje Creative Commons: autor, licencja i link do źródła
export function PhotoCredit({ photo, t }: { photo: PlacePhotoRow; t: Dictionary }) {
  return (
    <a
      href={photo.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute right-2 bottom-1.5 max-w-[75%] truncate rounded-md bg-ink/55 px-1.5 py-0.5 text-[10px] leading-tight text-cream/90 hover:text-cream"
    >
      {t.common.photoBy} {photo.author} · {photo.license}
    </a>
  );
}

// Zdjęcie w tle z przyciemnieniem u dołu i treścią na wierzchu
export function PhotoBanner({ src, credit, t, className = "", children }: { src: string; credit?: PlacePhotoRow | null; t: Dictionary; className?: string; children?: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden bg-ink-soft ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/25 to-transparent" />
      {children && <div className="relative flex h-full flex-col justify-end">{children}</div>}
      {credit && <PhotoCredit photo={credit} t={t} />}
    </div>
  );
}
