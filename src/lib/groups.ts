import { cityName } from "@/lib/cities";
import { countryName, institutionShort, semesterLabel, type Institution } from "@/lib/domain";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";

export type GroupKind = "route" | "semester" | "alumni" | "city" | "country";

export type GroupInfo = {
  kind: GroupKind;
  home: Institution | null;
  exchange: Institution | null;
  city: string | null;
  country_code: string | null;
  semester: string | null;
};

export function groupTitle(g: GroupInfo, t: Dictionary, locale: Locale): { title: string; subtitle: string } {
  const ex = g.exchange ? institutionShort(g.exchange, locale) : "";
  const home = g.home ? institutionShort(g.home, locale) : "";
  const sem = semesterLabel(g.semester, t);
  switch (g.kind) {
    case "route":
      return { title: `${home} → ${ex}`, subtitle: sem };
    case "semester":
      return { title: ex, subtitle: sem };
    case "alumni":
      return { title: t.swarm.alumniTitle(ex, home), subtitle: t.swarm.alumniWhy };
    case "city":
      return { title: cityName(g.city, locale), subtitle: sem };
    case "country":
      return { title: countryName(g.country_code, locale), subtitle: sem };
  }
}

export function groupWhy(kind: GroupKind, t: Dictionary) {
  return { route: t.swarm.route, semester: t.swarm.semesterWhy, alumni: t.swarm.alumniWhy, city: t.swarm.cityWhy, country: t.swarm.countryWhy }[kind];
}

// Wiersz zwracany przez funkcję group_suggestions() w bazie
export type Suggestion = {
  kind: GroupKind;
  key: string;
  exchange_id: number;
  institution_id: number;
  home_id: number | null;
  city: string | null;
  country_code: string | null;
  semester: string | null;
  candidates: number;
  self_counted: boolean;
  group_id: number | null;
  members: number;
  is_member: boolean;
};
