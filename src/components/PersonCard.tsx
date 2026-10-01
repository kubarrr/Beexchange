import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Avatar, Flag } from "@/components/bx";
import { INSTITUTION_FIELDS, institutionName, personStage, semesterLabel, semesterPhase, type Institution, type Stage } from "@/lib/domain";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { BUDDY_EMOJI, HELPER_EMOJI, HOUSING_EMOJI, STAGE_EMOJI, isStudent } from "@/lib/profile-options";

export type PersonExchange = { semester: string; institution: Institution };
export type Person = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  wants_buddy: boolean;
  looking_for_housing: boolean;
  helps_departure: boolean;
  open_to_questions: boolean;
  stage_choice?: string | null;
  stage_semester?: string | null;
  homes: { position: number; faculty: string | null; field_of_study: string; study?: string | null; institution: Institution }[];
  exchanges: PersonExchange[];
};

// Wszystko, czego potrzebuje wizytówka (do .select() na profiles)
export const PERSON_SELECT = `id, full_name, avatar_url, wants_buddy, looking_for_housing, helps_departure, open_to_questions, stage_choice, stage_semester,
  homes:profile_homes(position, faculty, field_of_study, study, institution:institutions(${INSTITUTION_FIELDS})),
  exchanges(semester, institution:institutions(${INSTITUTION_FIELDS}))`;

// Najważniejsza wymiana: bieżąca, potem najbliższa przyszła, potem ostatnia przeszła
export function sortExchanges<T extends { semester: string }>(list: T[]): T[] {
  const rank = (x: T) => ({ now: 0, upcoming: 1, past: 2 })[semesterPhase(x.semester) ?? "past"];
  return [...list].sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? a.semester.localeCompare(b.semester) : b.semester.localeCompare(a.semester)));
}

// Plakietki przy imieniu: typ osoby, 🏠 szuka mieszkania, 🧸 buddy (tylko studenci), 📋 pomoc przed wyjazdem (tylko dla osób z tej samej uczelni)
export function personBadges(p: Person, viewerHomeIds: number[] = []) {
  const stage = personStage(p.exchanges, p);
  const sameHome = p.homes.some((h) => viewerHomeIds.includes(h.institution.id));
  return {
    stage,
    housing: p.looking_for_housing && (stage === "going" || stage === "abroad"),
    buddy: p.wants_buddy && isStudent(p.homes),
    helper: p.helps_departure && sameHome && p.exchanges.length > 0,
  };
}

export function StageChip({ stage, t, tone = "light" }: { stage: Stage; t: Dictionary; tone?: "light" | "dark" }) {
  const tones: Record<Stage, string> =
    tone === "dark"
      ? { searching: "bg-cream text-ink", going: "bg-honey text-ink", abroad: "bg-honey text-ink", been: "bg-honey text-ink" }
      : { searching: "border border-line bg-white", going: "bg-honey", abroad: "bg-ink text-honey", been: "bg-sand" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${tones[stage]}`}>
      <span aria-hidden="true">{STAGE_EMOJI[stage]}</span>
      {t.statusBadge[stage]}
    </span>
  );
}

function EmojiFlag({ emoji, label }: { emoji: string; label: string }) {
  return (
    <span title={label} aria-label={label} role="img" className="text-[15px] leading-none">
      {emoji}
    </span>
  );
}

// Linijka „uczelnia macierzysta → uczelnia wymiany · semestr” (pełne nazwy)
export function RouteLine({ p, t, className = "", maxExchanges = 1 }: { p: Person; locale?: Locale; t: Dictionary; className?: string; maxExchanges?: number }) {
  const home = [...p.homes].sort((a, b) => a.position - b.position)[0]?.institution;
  const ex = sortExchanges(p.exchanges);
  const shown = ex.slice(0, maxExchanges);
  return (
    <div className={`space-y-0.5 text-[13px] leading-snug ${className}`}>
      {home && <p className="font-semibold">{institutionName(home)}</p>}
      {shown.map((x) => (
        <p key={`${x.institution.id}:${x.semester}`} className="flex min-w-0 items-start gap-1.5">
          <ArrowRight size={14} strokeWidth={2.5} className="mt-[3px] shrink-0" aria-hidden="true" />
          <Flag code={x.institution.country_code} className="mt-[3px] h-3 w-[18px]" />
          <span className="min-w-0">
            {institutionName(x.institution)}
            <span className="opacity-70"> · {semesterLabel(x.semester, t)}</span>
          </span>
        </p>
      ))}
      {ex.length > shown.length && <p className="pl-5 opacity-70">+{ex.length - shown.length}</p>}
    </div>
  );
}

// Wizytówka osoby — wszędzie taka sama
export function PersonCard({
  p,
  locale,
  t,
  viewerHomeIds = [],
  action,
  footer,
  className = "panel p-3.5",
}: {
  p: Person;
  locale: Locale;
  t: Dictionary;
  viewerHomeIds?: number[];
  action?: React.ReactNode;
  footer?: React.ReactNode; // szeroki przycisk pod wizytówką (np. „Poproś o buddy”)
  className?: string;
}) {
  const b = personBadges(p, viewerHomeIds);
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <Link href={`/u/${p.id}`} className="shrink-0">
        <Avatar name={p.full_name} url={p.avatar_url} size={52} />
      </Link>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/u/${p.id}`} className="font-bold hover:underline">
            {p.full_name}
          </Link>
          <StageChip stage={b.stage} t={t} />
          {b.housing && <EmojiFlag emoji={HOUSING_EMOJI} label={t.profile.housing} />}
          {b.buddy && <EmojiFlag emoji={BUDDY_EMOJI} label={t.profile.buddy} />}
          {b.helper && <EmojiFlag emoji={HELPER_EMOJI} label={t.profile.helper} />}
        </div>
        <RouteLine p={p} locale={locale} t={t} className="text-muted [&_p:first-child]:text-ink" />
        {footer && <div className="flex justify-end pt-1.5">{footer}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
