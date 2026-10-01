import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

export type Status = "searching" | "going" | "been";

export type Institution = {
  id: number;
  name: string;
  name_en: string | null;
  name_pl: string | null;
  acronym: string | null;
  country_code: string;
  city: string | null;
  status?: string;
};

export const INSTITUTION_FIELDS = "id, name, name_en, name_pl, acronym, country_code, city, status";

export function institutionName(i: Pick<Institution, "name" | "name_en" | "name_pl">, locale: Locale) {
  if (locale === "pl") return i.name_pl || i.name;
  return i.name_en || i.name;
}

export function institutionShort(i: Pick<Institution, "name" | "name_en" | "name_pl" | "acronym">, locale: Locale) {
  return i.acronym || institutionName(i, locale);
}

// Kraje, które Node i przeglądarki nazywają inaczej (różne wersje słowników ICU) — inaczej React zgłasza niezgodność
const FIXED_COUNTRY_NAMES: Record<string, Record<Locale, string>> = {
  FK: { pl: "Falklandy", en: "Falkland Islands" },
  HK: { pl: "Hongkong", en: "Hong Kong" },
  MO: { pl: "Makau", en: "Macao" },
  PS: { pl: "Palestyna", en: "Palestine" },
};

export function countryName(code: string | null | undefined, locale: Locale) {
  if (!code) return "";
  const fixed = FIXED_COUNTRY_NAMES[code.toUpperCase()]?.[locale];
  if (fixed) return fixed;
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

// Semestr zapisujemy jako kod: "2026W" = zima 2026/27, "2027S" = lato 2026/27
// Absolwenci sprzed 2024 wybierają jedną opcję zamiast długiej listy starych semestrów
export const EARLIER_SEMESTER = "2000W";
const FIRST_LISTED_YEAR = 2024;

export function semesterLabel(code: string | null | undefined, t: Dictionary) {
  if (!code) return "";
  if (code === EARLIER_SEMESTER) return t.semester.earlier;
  const m = /^(\d{4})([WS])$/.exec(code);
  if (!m) return code;
  const year = Number(m[1]);
  const start = m[2] === "W" ? year : year - 1;
  return `${t.semester[m[2] as "W" | "S"]} ${start}/${String(start + 1).slice(2)}`;
}

// Zima: wrzesień–luty, lato: luty–lipiec
function semesterRange(code: string): [Date, Date] | null {
  const m = /^(\d{4})([WS])$/.exec(code);
  if (!m) return null;
  const y = Number(m[1]);
  return m[2] === "W" ? [new Date(y, 8, 1), new Date(y + 1, 2, 1)] : [new Date(y, 1, 1), new Date(y, 7, 1)];
}

export type Phase = "upcoming" | "now" | "past";
export function semesterPhase(code: string | null | undefined, now = new Date()): Phase | null {
  const r = code ? semesterRange(code) : null;
  if (!r) return null;
  return now < r[0] ? "upcoming" : now >= r[1] ? "past" : "now";
}

// Etap do wyświetlenia: „jest na wymianie” wynika z semestru
export type Stage = Status | "abroad";
export function stageOf(status: Status, semester: string | null | undefined): Stage {
  return status === "going" && semesterPhase(semester) === "now" ? "abroad" : status;
}

export function semesterOptions(now = new Date()) {
  const y = now.getFullYear();
  const codes: string[] = [];
  for (let start = y + 1; start >= FIRST_LISTED_YEAR; start--) {
    codes.push(`${start + 1}S`, `${start}W`);
  }
  codes.push(`${FIRST_LISTED_YEAR}S`, EARLIER_SEMESTER);
  return codes;
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function formatRelative(iso: string, locale: Locale) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diff < 60) return rtf.format(0, "second");
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), "hour");
  if (diff < 7 * 86400) return rtf.format(-Math.floor(diff / 86400), "day");
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
}
