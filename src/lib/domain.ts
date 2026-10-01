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

// Nazwa w języku kraju uczelni (Politecnico di Milano, Politechnika Warszawska), niezależnie od języka aplikacji.
// Nazwy angielskie zostają w wyszukiwarce uczelni.
export function institutionName(i: Pick<Institution, "name" | "name_en" | "name_pl"> & { country_code?: string }) {
  if (i.country_code === "PL") return i.name_pl || i.name;
  return i.name;
}

// Skrót albo nazwa w języku kraju (język aplikacji nie ma znaczenia, parametr zostaje dla zgodności wywołań)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function institutionShort(i: Pick<Institution, "name" | "name_en" | "name_pl" | "acronym"> & { country_code?: string }, locale?: Locale) {
  return i.acronym || institutionName(i);
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

// Bieżący semestr — tak samo jak current_semester() w bazie: wrzesień–luty to zima, marzec–sierpień to lato
export function currentSemester(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 9 ? `${y}W` : m <= 2 ? `${y - 1}W` : `${y}S`;
}

// Kody semestrów porównują się jak tekst: "2026W" < "2027S" < "2027W"
export type Phase = "upcoming" | "now" | "past";
export function semesterPhase(code: string | null | undefined, now = new Date()): Phase | null {
  if (!code || !/^\d{4}[WS]$/.test(code)) return null;
  const cur = currentSemester(now);
  return code === cur ? "now" : code > cur ? "upcoming" : "past";
}

// Typ osoby wynika z jej wymian (jak person_stage() w bazie):
// 🔍 szuka (brak wymiany), ✈️ jedzie (przyszły semestr), 📍 na wymianie (bieżący), 👑 absolwent (tylko przeszłe)
export type Stage = Status | "abroad";
// Filtr w Ludziach: wszyscy, 🔍 szukają, ✈️ jadą, 📍 są teraz na wymianie, 👑 absolwenci
export const PEOPLE_SEGMENTS = ["all", "searching", "going", "abroad", "been"] as const;
// Wybór z profilu (stage_choice) wygrywa, ale tylko w semestrze, w którym go ustawiono
export type StageChoice = { stage_choice?: string | null; stage_semester?: string | null };
export function personStage(exchanges: { semester: string }[], choice?: StageChoice | null, now = new Date()): Stage {
  if (choice?.stage_choice && choice.stage_semester === currentSemester(now)) return choice.stage_choice as Stage;
  return autoStage(exchanges, now);
}

// Etap wyliczony tylko z semestrów wymian
export function autoStage(exchanges: { semester: string }[], now = new Date()): Stage {
  const phases = exchanges.map((x) => semesterPhase(x.semester, now));
  if (phases.includes("now")) return "abroad";
  if (phases.includes("upcoming")) return "going";
  return exchanges.length ? "been" : "searching";
}

// Etap jednej wymiany
export function exchangeStage(semester: string): Stage {
  const phase = semesterPhase(semester);
  return phase === "now" ? "abroad" : phase === "upcoming" ? "going" : "been";
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
