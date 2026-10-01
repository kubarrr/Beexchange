import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

// Typ osoby: 🔍 szuka, ✈️ jedzie, 📍 na wymianie, 👑 absolwent (królowa roju); 🏠 szuka mieszkania, 📋 pomoc przed wyjazdem, 🧸 buddy
export const STAGE_EMOJI = { searching: "🔍", going: "✈️", abroad: "📍", been: "👑" } as const;
export const HOUSING_EMOJI = "🏠";
export const HELPER_EMOJI = "📋";
export const BUDDY_EMOJI = "🧸";

export const PASSION_EMOJI: Record<string, string> = {
  travel: "🗺️",
  photography: "📷",
  volleyball: "🏐",
  football: "⚽",
  cooking: "🍳",
  parties: "🎉",
  music: "🎵",
  mountains: "⛰️",
  coffee: "☕",
  art: "🎨",
  startups: "🚀",
  languages: "🗣️",
  running: "🏃",
  gym: "🏋️",
  gaming: "🎮",
  cinema: "🎬",
  dance: "💃",
  volunteering: "🤝",
  books: "📚",
  skiing: "⛷️",
  basketball: "🏀",
  tennis: "🎾",
  tech: "💻",
  nature: "🌿",
};

// Języki do wyboru i flaga, którą pokazujemy obok (flagi SVG, bo emoji flag nie działają na Windowsie)
export const LANGUAGE_FLAGS: Record<string, string> = {
  pl: "PL", en: "GB", de: "DE", es: "ES", it: "IT", fr: "FR", pt: "PT", nl: "NL", sv: "SE", da: "DK", no: "NO", fi: "FI",
  cs: "CZ", sk: "SK", uk: "UA", hu: "HU", ro: "RO", hr: "HR", el: "GR", tr: "TR", ca: "ES-CT", ru: "RU", ja: "JP",
  zh: "CN", ko: "KR", ar: "SA",
};
export const LANGUAGE_CODES = Object.keys(LANGUAGE_FLAGS);
export const LEVELS = ["native", "C2", "C1", "B2", "B1", "A2", "A1"] as const;
export type Level = (typeof LEVELS)[number];

export function languageName(code: string, locale: Locale) {
  try {
    const n = new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
    return n.charAt(0).toUpperCase() + n.slice(1);
  } catch {
    return code;
  }
}

// Języki zapisujemy jako "kod:poziom", np. "en:C1". Starsze wpisy (wolny tekst) pokazujemy bez zmian.
export function parseLanguage(entry: string): { code: string; level: Level } | null {
  const m = /^([a-z]{2}):(native|C2|C1|B2|B1|A2|A1)$/.exec(entry);
  return m ? { code: m[1], level: m[2] as Level } : null;
}

export const DEGREES = { bachelor: 3, engineer: 4, master: 2, long: 6, phd: 4, graduate: 0 } as const;
export type Degree = keyof typeof DEGREES;

// Nadal studiuje: ma choć jedną uczelnię bez „ukończonych studiów” (brak stopnia też liczymy jako studenta).
// Tylko studenci mogą być 🧸 buddy — niezależnie od tego, czy byli już na wymianie.
export const isStudent = (homes: { study?: string | null }[]) => homes.some((h) => h.study !== "graduate");

// Studia zapisujemy jako "stopień:rok", np. "master:1" albo "graduate"
export function parseStudy(value: string | null | undefined): { degree: Degree; year: number | null } | null {
  const m = /^(bachelor|engineer|master|long|phd|graduate)(?::(\d))?$/.exec(value ?? "");
  return m ? { degree: m[1] as Degree, year: m[2] ? Number(m[2]) : null } : null;
}

export function studyLabel(value: string | null | undefined, t: Dictionary) {
  const s = parseStudy(value);
  if (!s) return value ?? "";
  return t.profile.study(t.profile.degrees[s.degree], s.year);
}
