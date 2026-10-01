import { semesterPhase, type Institution } from "@/lib/domain";

export const cityKey = (cc: string | null | undefined, city: string | null | undefined) => `${cc ?? ""}:${(city ?? "").toLowerCase()}`;

// Moje miasta: najpierw wymiany trwające i przyszłe, potem uczelnie macierzyste, na końcu wymiany zakończone
export function myCities(me: { homes: { institution: Institution }[]; exchanges: { semester: string; institution: Institution }[] }) {
  const out = new Map<string, { cc: string; city: string }>();
  const ordered = [
    ...me.exchanges.filter((x) => semesterPhase(x.semester) !== "past").map((x) => x.institution),
    ...me.homes.map((h) => h.institution),
    ...me.exchanges.map((x) => x.institution),
  ];
  for (const i of ordered) if (i.city) out.set(cityKey(i.country_code, i.city), { cc: i.country_code, city: i.city });
  return out;
}

// Waluta ogłoszeń według kraju (euro, jeśli kraj go używa albo nie znamy waluty)
const CURRENCY: Record<string, string> = { PL: "PLN", CZ: "CZK", HU: "HUF", SE: "SEK", DK: "DKK", NO: "NOK", CH: "CHF", GB: "GBP", RO: "RON", BG: "BGN", TR: "TRY", IS: "ISK", US: "USD", CA: "CAD", AU: "AUD", JP: "JPY", KR: "KRW" };
export const currencyFor = (cc: string) => CURRENCY[cc] ?? "EUR";
export const CURRENCIES = ["EUR", "PLN", "CZK", "HUF", "SEK", "DKK", "NOK", "CHF", "GBP", "RON", "BGN", "TRY", "USD"];

export function formatPrice(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
