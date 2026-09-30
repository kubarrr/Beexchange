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
