import { cityName } from "@/lib/cities";
import { demonym } from "@/lib/demonyms";
import { countryName, institutionShort, semesterLabel, type Institution } from "@/lib/domain";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

// route        PW → PoliMi · semestr               (ta sama trasa)
// nat_uni      Polacy · PoliMi · semestr           nat_city   Polacy · Mediolan · semestr
// nat_country  Polacy · Włochy · semestr           semester   Wszyscy · PoliMi · semestr
// city         Wszyscy · Mediolan · semestr        alumni     Absolwenci PoliMi z PW
// alumni_local Alumni · Warszawa (z flagą kraju wymiany)
export type GroupKind = "route" | "semester" | "alumni" | "city" | "nat_uni" | "nat_city" | "nat_country" | "alumni_local";

// Grupy, które proponujemy i pokazujemy (zawsze na dany semestr). Trasa i grupy absolwentów zostają tylko
// w czatach osób, które już do nich należą.
export const ACTIVE_GROUP_KINDS: GroupKind[] = ["nat_uni", "nat_city", "nat_country", "semester", "city"];

export type GroupInfo = {
  kind: GroupKind;
  home: Institution | null;
  exchange: Institution | null;
  city: string | null;
  country_code: string | null;
  nat_cc?: string | null;
  semester: string | null;
};

export function groupTitle(g: GroupInfo, t: Dictionary, locale: Locale): { title: string; subtitle: string } {
  const ex = g.exchange ? institutionShort(g.exchange, locale) : "";
  const home = g.home ? institutionShort(g.home, locale) : "";
  const sem = semesterLabel(g.semester, t);
  const nat = demonym(g.nat_cc, locale);
  const city = cityName(g.city, locale);
  switch (g.kind) {
    case "route":
      return { title: `${home} → ${ex}`, subtitle: sem };
    case "nat_uni":
      return { title: `${nat} · ${ex}`, subtitle: sem };
    case "nat_city":
      return { title: `${nat} · ${city}`, subtitle: sem };
    case "nat_country":
      return { title: `${nat} · ${countryName(g.country_code, locale)}`, subtitle: sem };
    case "semester":
      return { title: `${t.groups.everyone} · ${ex}`, subtitle: sem };
    case "city":
      return { title: `${t.groups.everyone} · ${city}`, subtitle: sem };
    case "alumni":
      return { title: t.swarm.alumniTitle(ex, home), subtitle: t.swarm.alumniWhy };
    case "alumni_local":
      return { title: `${t.groups.alumni} · ${city}`, subtitle: t.groups.alumniLocalWhy(countryName(g.country_code, locale)) };
  }
}

export function groupWhy(kind: GroupKind, t: Dictionary) {
  return t.groups.why[kind];
}

// Wiersz zwracany przez funkcję group_suggestions() w bazie
export type Suggestion = {
  kind: GroupKind;
  key: string;
  exchange_id: number | null;
  institution_id: number;
  home_id: number | null;
  city: string | null;
  country_code: string | null;
  nat_cc: string | null;
  semester: string | null;
  candidates: number;
  self_counted: boolean;
  group_id: number | null;
  members: number;
  is_member: boolean;
  is_local: boolean;
};
