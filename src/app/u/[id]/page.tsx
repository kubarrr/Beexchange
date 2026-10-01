import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, Hexagon, MessageSquare } from "lucide-react";
import { startConversation } from "@/app/actions";
import { requestBuddy } from "@/app/actions/bx";
import { InstBadge, LanguageBadge, PassionEmoji } from "@/components/bx";
import { StageChip, personBadges, sortExchanges, type Person as CardPerson } from "@/components/PersonCard";
import { ReportButton } from "@/components/ReportButton";
import { requireProfile, type ExchangeRow, type HomeRow } from "@/lib/auth";
import { INSTITUTION_FIELDS, countryName, exchangeStage, institutionName, institutionShort, semesterLabel } from "@/lib/domain";
import { cityName } from "@/lib/cities";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { passionLabel } from "@/lib/i18n/dictionaries";
import { BUDDY_EMOJI, HELPER_EMOJI, HOUSING_EMOJI, studyLabel } from "@/lib/profile-options";

export const generateMetadata = localizedTitle((t) => t.nav.profile);

type Person = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  passions: string[];
  languages: string[];
  bio: string;
  open_to_questions: boolean;
  wants_buddy: boolean;
  looking_for_housing: boolean;
  helps_departure: boolean;
  homes: HomeRow[];
  exchanges: ExchangeRow[];
};

export default async function PersonPage({ params }: PageProps<"/u/[id]">) {
  const { id } = await params;
  const { supabase, userId, profile: me } = await requireProfile(`/u/${id}`);
  const { t, locale } = await getDictionary();

  const { data } = await supabase
    .from("profiles")
    .select(
      `id, full_name, avatar_url, passions, languages, bio, open_to_questions, wants_buddy, looking_for_housing, helps_departure, stage_choice, stage_semester,
       homes:profile_homes(institution_id, field_of_study, faculty, study, position, institution:institutions(${INSTITUTION_FIELDS})),
       exchanges(id, institution_id, semester, status, institution:institutions(${INSTITUTION_FIELDS}))`,
    )
    .eq("id", id)
    .maybeSingle();
  const p = data as unknown as Person | null;
  if (!p) notFound();
  const homes = [...p.homes].sort((a, b) => a.position - b.position);
  const exchanges = sortExchanges(p.exchanges);
  const badges = personBadges(p as unknown as CardPerson, me.homes.map((h) => h.institution_id));

  const isMe = p.id === userId;
  const { data: req } = isMe ? { data: null } : await supabase.from("buddy_requests").select("status").eq("from_user", userId).eq("to_user", p.id).maybeSingle();

  const common: string[] = [];
  if (!isMe) {
    const myHomes = new Set(me.homes.map((h) => h.institution_id));
    const myEx = new Set(me.exchanges.map((x) => x.institution_id));
    const mySem = new Set(me.exchanges.map((x) => x.semester));
    // Ta sama uczelnia macierzysta albo jej/jego uczelnia to moja uczelnia wymiany (lokalny buddy)
    for (const h of homes) if (myHomes.has(h.institution_id) || myEx.has(h.institution_id)) common.push(institutionShort(h.institution, locale));
    for (const x of exchanges) if (myEx.has(x.institution_id)) common.push(institutionShort(x.institution, locale));
    for (const x of exchanges) if (mySem.has(x.semester) && !common.includes(semesterLabel(x.semester, t))) common.push(semesterLabel(x.semester, t));
    for (const x of p.passions ?? []) if (me.passions?.includes(x)) common.push(passionLabel(t, x));
  }
  const isBuddy = badges.buddy;
  // Plakietki z wyjaśnieniem, co znaczą
  const roles = [
    badges.housing && { emoji: HOUSING_EMOJI, label: t.person.housing, hint: t.person.housingHint },
    badges.buddy && { emoji: BUDDY_EMOJI, label: t.people.buddy, hint: t.person.buddyHint },
    badges.helper && !isMe && { emoji: HELPER_EMOJI, label: t.person.helper, hint: t.person.helperHint },
  ].filter(Boolean) as { emoji: string; label: string; hint: string }[];
  const languages = Array.isArray(p.languages) ? p.languages : [];

  return (
    <div className="mx-auto max-w-2xl md:px-4 md:py-6">
      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden bg-ink-soft md:rounded-[28px]">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <svg viewBox="0 0 400 400" className="h-full w-full" aria-hidden="true">
            <circle cx="200" cy="160" r="72" fill="#FFC52E" />
            <path d="M60 400c12-100 66-150 140-150s128 50 140 150z" fill="#FFC52E" />
          </svg>
        )}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/85 to-transparent" />
        <Link href="/people" aria-label={t.common.back} className="absolute top-4 left-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-cream">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </Link>
        <div className="absolute inset-x-5 bottom-4 space-y-2 text-cream">
          <h1 className="display text-[30px] leading-tight">{p.full_name}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <StageChip stage={badges.stage} t={t} tone="dark" />
            {roles.map((r) => (
              <span key={r.emoji} className="inline-flex items-center gap-1 rounded-full bg-cream/90 px-2 py-0.5 text-[11px] font-bold text-ink">
                <span aria-hidden="true">{r.emoji}</span>
                {r.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5 px-5 py-5 md:px-0">
        {common.length > 0 && (
          <div className="flex items-center gap-3 rounded-[18px] bg-honey px-4 py-3">
            <Hexagon size={22} strokeWidth={2.3} className="shrink-0" />
            <span className="text-sm leading-snug font-semibold">
              {t.person.common}: {common.join(", ")}
            </span>
          </div>
        )}

        <section className="panel space-y-1 p-4">
          {homes.map((h) => (
            <Link key={h.institution_id} href={`/people?ex=all&hu=${h.institution_id}`} className="flex items-center gap-3 rounded-2xl py-1.5 hover:bg-cream">
              <InstBadge inst={h.institution} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block leading-tight font-bold">{institutionName(h.institution)}</span>
                <span className="block text-[13px] text-muted">
                  {[cityName(h.institution.city, locale), h.faculty, h.field_of_study, studyLabel(h.study, t)].filter(Boolean).join(" · ")}
                </span>
              </span>
            </Link>
          ))}
          {exchanges.length > 0 && (
            <div className="flex justify-center py-0.5 text-muted">
              <ArrowDown size={20} strokeWidth={2.5} aria-hidden="true" />
            </div>
          )}
          {exchanges.map((x) => (
            <Link key={x.id} href={`/people?ex=${x.institution_id}`} className="flex items-center gap-3 rounded-2xl py-1.5 hover:bg-cream">
              <InstBadge inst={x.institution} size={44} tone="honey" />
              <span className="min-w-0 flex-1">
                <span className="block leading-tight font-bold">{institutionName(x.institution)}</span>
                <span className="block text-[13px] text-muted">
                  {[cityName(x.institution.city, locale), countryName(x.institution.country_code, locale), semesterLabel(x.semester, t)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <StageChip stage={exchangeStage(x.semester)} t={t} />
            </Link>
          ))}
        </section>

        {roles.length > 0 && (
          <div className="space-y-2">
            {roles.map((r) => (
              <div key={r.emoji} className="flex items-start gap-3 rounded-[18px] bg-sand px-4 py-3">
                <span aria-hidden="true" className="text-xl leading-none">
                  {r.emoji}
                </span>
                <span className="text-sm leading-snug">
                  <span className="font-bold">{r.label}</span>
                  <span className="block text-muted">{r.hint}</span>
                </span>
              </div>
            ))}
          </div>
        )}


        {!!p.passions?.length && (
          <section className="space-y-2">
            <h2 className="label-caps">{t.person.passions}</h2>
            <div className="flex flex-wrap gap-2">
              {p.passions.map((x) => (
                <span key={x} className={`chip gap-1.5 ${me.passions?.includes(x) && !isMe ? "chip-honey" : ""}`}>
                  <PassionEmoji id={x} />
                  {passionLabel(t, x)}
                </span>
              ))}
            </div>
          </section>
        )}

        {languages.length > 0 && (
          <section className="space-y-2">
            <h2 className="label-caps">{t.person.languages}</h2>
            <div className="flex flex-wrap gap-2">
              {languages.map((l) => (
                <LanguageBadge key={l} entry={l} t={t} locale={locale} />
              ))}
            </div>
          </section>
        )}

        {p.bio && (
          <section className="space-y-2">
            <h2 className="label-caps">{t.person.about}</h2>
            <p className="leading-relaxed whitespace-pre-line">{p.bio}</p>
          </section>
        )}

        {isMe ? (
          <Link href="/profile" className="btn-primary w-full">
            {t.profile.title}
          </Link>
        ) : (
          <div className="flex gap-2.5">
            {p.open_to_questions ? (
              <form action={startConversation} className="flex-1">
                <input type="hidden" name="user_id" value={p.id} />
                <button className="btn-primary min-h-14 w-full">
                  <MessageSquare size={20} /> {t.common.write}
                </button>
              </form>
            ) : (
              <p className="flex-1 self-center text-sm text-muted">{t.person.cantMessage}</p>
            )}
            {isBuddy &&
              (req ? (
                <span className="flex min-h-14 flex-1 items-center justify-center rounded-2xl border-2 border-ink px-3 text-center text-sm font-bold">{t.swarm.buddySent}</span>
              ) : (
                <form action={requestBuddy} className="flex-1">
                  <input type="hidden" name="user_id" value={p.id} />
                  <button className="min-h-14 w-full rounded-2xl border-2 border-ink bg-honey px-3 font-bold">{t.swarm.askBuddy}</button>
                </form>
              ))}
          </div>
        )}
        {!isMe && (
          <div className="text-right">
            <ReportButton type="profile" id={p.id} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}
