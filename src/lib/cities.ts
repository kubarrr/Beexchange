// Polskie nazwy miast (w bazie ROR są angielskie). Klucz: nazwa z ROR, małymi literami.
// Ten sam plik czyta skrypt importu uczelni, żeby wyszukiwarka znajdowała np. „Mediolan”.
import CITY_PL_JSON from "./cities-pl.json";

const CITY_PL: Record<string, string> = CITY_PL_JSON;

export function cityName(city: string | null | undefined, locale: string) {
  if (!city) return "";
  if (locale !== "pl") return city;
  return CITY_PL[city.toLowerCase()] ?? city;
}

// Polska nazwa do wyszukiwarki uczelni (żeby „Mediolan” znajdował uczelnie z Milan)
export function cityNamePl(city: string | null | undefined) {
  return city ? CITY_PL[city.toLowerCase()] ?? null : null;
}

const fold = (s: string) => s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Do wyszukiwarki miast: wpisany tekst plus angielskie nazwy miast, których polska nazwa pasuje („Mediol” → „milan”)
export function cityQueryCandidates(q: string) {
  const f = fold(q.trim());
  const out = new Set<string>([q.trim()]);
  for (const [en, pl] of Object.entries(CITY_PL)) if (fold(pl).startsWith(f)) out.add(en);
  return [...out].filter((x) => x.length >= 2).slice(0, 8);
}
