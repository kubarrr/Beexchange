import { countryName } from "@/lib/domain";
import type { Locale } from "@/lib/i18n/dictionaries";

// Nazwy mieszkańców (liczba mnoga) do tytułów grup „Polacy · PoliMi”. Kraje spoza listy: „Z kraju: X”.
const PL: Record<string, string> = {
  PL: "Polacy", IT: "Włosi", ES: "Hiszpanie", PT: "Portugalczycy", DE: "Niemcy", FR: "Francuzi", NL: "Holendrzy", BE: "Belgowie",
  AT: "Austriacy", CH: "Szwajcarzy", CZ: "Czesi", SK: "Słowacy", HU: "Węgrzy", RO: "Rumuni", BG: "Bułgarzy", HR: "Chorwaci",
  SI: "Słoweńcy", RS: "Serbowie", GR: "Grecy", CY: "Cypryjczycy", MT: "Maltańczycy", TR: "Turcy", UA: "Ukraińcy", LT: "Litwini",
  LV: "Łotysze", EE: "Estończycy", FI: "Finowie", SE: "Szwedzi", NO: "Norwegowie", DK: "Duńczycy", IS: "Islandczycy", IE: "Irlandczycy",
  GB: "Brytyjczycy", LU: "Luksemburczycy", MK: "Macedończycy", AL: "Albańczycy", BA: "Bośniacy", ME: "Czarnogórcy", MD: "Mołdawianie",
  BY: "Białorusini", GE: "Gruzini", AM: "Ormianie", AZ: "Azerowie", KZ: "Kazachowie", US: "Amerykanie", CA: "Kanadyjczycy",
  MX: "Meksykanie", BR: "Brazylijczycy", AR: "Argentyńczycy", CL: "Chilijczycy", CO: "Kolumbijczycy", CN: "Chińczycy", JP: "Japończycy",
  KR: "Koreańczycy", IN: "Hindusi", VN: "Wietnamczycy", ID: "Indonezyjczycy", AU: "Australijczycy", IL: "Izraelczycy",
  EG: "Egipcjanie", MA: "Marokańczycy", TN: "Tunezyjczycy",
};
const EN: Record<string, string> = {
  PL: "Poles", IT: "Italians", ES: "Spaniards", PT: "Portuguese", DE: "Germans", FR: "French", NL: "Dutch", BE: "Belgians",
  AT: "Austrians", CH: "Swiss", CZ: "Czechs", SK: "Slovaks", HU: "Hungarians", RO: "Romanians", BG: "Bulgarians", HR: "Croatians",
  SI: "Slovenians", RS: "Serbians", GR: "Greeks", CY: "Cypriots", MT: "Maltese", TR: "Turks", UA: "Ukrainians", LT: "Lithuanians",
  LV: "Latvians", EE: "Estonians", FI: "Finns", SE: "Swedes", NO: "Norwegians", DK: "Danes", IS: "Icelanders", IE: "Irish",
  GB: "British", LU: "Luxembourgers", MK: "Macedonians", AL: "Albanians", BA: "Bosnians", ME: "Montenegrins", MD: "Moldovans",
  BY: "Belarusians", GE: "Georgians", AM: "Armenians", AZ: "Azerbaijanis", KZ: "Kazakhs", US: "Americans", CA: "Canadians",
  MX: "Mexicans", BR: "Brazilians", AR: "Argentinians", CL: "Chileans", CO: "Colombians", CN: "Chinese", JP: "Japanese",
  KR: "Koreans", IN: "Indians", VN: "Vietnamese", ID: "Indonesians", AU: "Australians", IL: "Israelis",
  EG: "Egyptians", MA: "Moroccans", TN: "Tunisians",
};

export function demonym(cc: string | null | undefined, locale: Locale) {
  if (!cc) return "";
  const map = locale === "pl" ? PL : EN;
  return map[cc] ?? (locale === "pl" ? `Z kraju: ${countryName(cc, locale)}` : `From ${countryName(cc, locale)}`);
}
