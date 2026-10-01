import Link from "next/link";
import { ArrowRight, ChevronDown, Compass } from "lucide-react";
import { joinGroup, requestBuddy } from "@/app/actions/bx";
import { Avatar, EmptyState, Flag, InstBadge, StatusBadge } from "@/components/bx";
import { CopyInvite } from "@/components/CopyInvite";
import { GroupFlag, GroupKindIcon } from "@/components/GroupKindIcon";
import { requireProfile } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { institutionShort, semesterLabel, semesterPhase, stageOf, type Institution } from "@/lib/domain";
import { groupTitle, groupWhy, type GroupKind, type Suggestion } from "@/lib/groups";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";

export const generateMetadata = localizedTitle((t) => t.nav.swarm);

type Mini = { id: string; full_name: string; avatar_url: string | null };
type PastExchange = { institution_id: number; semester: string; status: string; institution: Institution };
type BuddyProfile = Mini & { home: Institution | null; exchanges?: PastExchange[] };
type Buddy = BuddyProfile & { local: boolean; was: PastExchange | null };
type Row = Suggestion & { others: number };

// Kolejność grup w ramach wymiany: przed wyjazdem najpierw ta sama trasa i rodacy,
// po powrocie najpierw grupy absolwentów
const UPCOMING_ORDER: GroupKind[] = ["route", "nat_uni", "nat_city", "semester", "city", "nat_country", "alumni", "alumni_local"];
const PAST_ORDER: GroupKind[] = ["alumni", "alumni_local", "route", "nat_uni", "nat_city", "semester", "city", "nat_country"];
const VISIBLE_PER_EXCHANGE = 2;

export default async function SwarmPage() {
  const { supabase, userId, profile: me } = await requireProfile("/roj");
  const { t, locale } = await getDictionary();
  const firstName = me.full_name.split(" ")[0] || "";

  const exInsts = me.exchanges.map((x) => x.institution_id);
  const homeInsts = me.homes.map((h) => h.institution_id);
  const INST = "id, name, name_en, name_pl, acronym, country_code, city";
  const BUDDY_FIELDS = `id, full_name, avatar_url, wants_buddy, home:institutions!profiles_home_institution_id_fkey(${INST})`;

  const [{ data: sugg }, { data: homeBuddies }, { data: localBuddies }, { data: sent }] = await Promise.all([
    supabase.rpc("group_suggestions"),
    // Buddy z moich uczelni (pokazujemy tych, którzy już byli na wymianie)
    homeInsts.length
      ? supabase
          .from("profile_homes")
          .select(`profiles!inner(${BUDDY_FIELDS}, exchanges(institution_id, semester, status, institution:institutions(${INST})))`)
          .in("institution_id", homeInsts)
          .eq("profiles.wants_buddy", true)
          .neq("user_id", userId)
          .limit(40)
      : Promise.resolve({ data: [] }),
    // Lokalni studenci moich uczelni zagranicznych (np. Włosi z PoliMi)
    exInsts.length
      ? supabase.from("profile_homes").select(`profiles!inner(${BUDDY_FIELDS})`).in("institution_id", exInsts).eq("profiles.wants_buddy", true).neq("user_id", userId).limit(6)
      : Promise.resolve({ data: [] }),
    supabase.from("buddy_requests").select("to_user").eq("from_user", userId),
  ]);

  // Uczelnie potrzebne do tytułów grup
  const insts = new Map<number, Institution>();
  for (const x of me.exchanges) insts.set(x.institution_id, x.institution);
  for (const h of me.homes) insts.set(h.institution_id, h.institution);

  const seen = new Set<string>();
  const all: Row[] = ((sugg ?? []) as Suggestion[])
    .filter((s) => s.key && !seen.has(s.key) && seen.add(s.key))
    .map((s) => ({ ...s, others: s.candidates - (s.self_counted ? 1 : 0) }))
    .filter((s) => s.others > 0 || s.members > (s.is_member ? 1 : 0));

  const info = (s: Suggestion) =>
    groupTitle(
      {
        kind: s.kind,
        home: s.home_id ? insts.get(s.home_id) ?? null : null,
        exchange: insts.get(s.institution_id) ?? null,
        city: s.city,
        country_code: s.country_code,
        nat_cc: s.nat_cc,
        semester: s.semester,
      },
      t,
      locale,
    );

  const exchangeRows = all.filter((s) => !s.is_local);
  const localRows = all.filter((s) => s.is_local);
  const isPast = (x: { status: string; semester: string }) => x.status === "been" || semesterPhase(x.semester) === "past";
  const sections = me.exchanges.map((x) => {
    const order = isPast(x) ? PAST_ORDER : UPCOMING_ORDER;
    const rank = (k: GroupKind) => order.indexOf(k) + 1 || 99;
    return { x, groups: exchangeRows.filter((s) => s.exchange_id === x.id).sort((a, b) => rank(a.kind) - rank(b.kind)) };
  });
  // Najlepsze dopasowanie: pierwsza grupa najbliższej wymiany (wymiany przed wyjazdem są na początku listy)
  const best = sections.find((sec) => sec.groups.length)?.groups[0];

  let faces: Mini[] = [];
  if (best?.institution_id) {
    let q = supabase.from("exchanges").select("profiles!inner(id, full_name, avatar_url)").eq("institution_id", best.institution_id).neq("user_id", userId).limit(4);
    if (best.kind === "alumni") q = q.eq("status", "been");
    else if (best.semester) q = q.eq("semester", best.semester);
    faces = ((await q).data ?? []).map((r) => r.profiles as unknown as Mini);
  }

  const sentTo = new Set((sent ?? []).map((r) => r.to_user));
  const localList = new Map<string, Buddy>();
  for (const r of localBuddies ?? []) {
    const p = r.profiles as unknown as BuddyProfile;
    localList.set(p.id, { ...p, local: true, was: null });
  }
  // Z mojej uczelni: tylko ci, którzy już byli na wymianie; najpierw ci, którzy byli tam, dokąd ja jadę
  const homeList = new Map<string, Buddy>();
  for (const r of homeBuddies ?? []) {
    const p = r.profiles as unknown as BuddyProfile;
    if (localList.has(p.id) || homeList.has(p.id)) continue;
    const past = (p.exchanges ?? []).filter(isPast).sort((a, b) => b.semester.localeCompare(a.semester));
    const was = past.find((e) => exInsts.includes(e.institution_id)) ?? past[0];
    if (was) homeList.set(p.id, { ...p, local: false, was });
  }
  const wentWhereIGo = (b: Buddy) => Number(!!b.was && exInsts.includes(b.was.institution_id));
  const homeBuddyList = [...homeList.values()].sort((a, b) => wentWhereIGo(b) - wentWhereIGo(a)).slice(0, 6);
  const localBuddyList = [...localList.values()].slice(0, 6);

  const action = (s: Row, dark = false) =>
    s.is_member && s.group_id ? (
      <Link href={`/grupy/${s.group_id}`} className={dark ? "btn-honey min-h-12 px-5" : "btn-outline shrink-0"}>
        {t.common.joined} <ArrowRight size={16} />
      </Link>
    ) : (
      <form action={joinGroup}>
        <input type="hidden" name="kind" value={s.kind} />
        {s.exchange_id && <input type="hidden" name="exchange_id" value={s.exchange_id} />}
        {s.home_id && <input type="hidden" name="home_id" value={s.home_id} />}
        <button className={dark ? "btn-honey min-h-12 px-5 font-display text-base" : "btn-honey shrink-0 bg-ink text-honey hover:bg-black"}>
          {t.common.join} {dark && <ArrowRight size={18} />}
        </button>
      </form>
    );

  const row = (s: Row) => {
    const { title, subtitle } = info(s);
    return (
      <div key={s.key} className="panel flex items-center gap-3.5 p-3.5">
        <GroupKindIcon kind={s.kind} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 leading-tight font-bold">
            <GroupFlag kind={s.kind} country_code={s.country_code} nat_cc={s.nat_cc} />
            <span className="min-w-0 break-words">{title}</span>
          </p>
          <p className="text-[13px] text-muted">
            {subtitle} · {t.common.people(Math.max(s.others + (s.self_counted ? 1 : 0), s.members))}
          </p>
        </div>
        {action(s)}
      </div>
    );
  };

  const buddyRow = (b: Buddy) => (
    <div key={b.id} className="flex items-center gap-3">
      <Link href={`/u/${b.id}`} className="rounded-full ring-2 ring-ink">
        <Avatar name={b.full_name} url={b.avatar_url} size={48} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${b.id}`} className="block truncate font-bold hover:underline">
          {b.full_name}
        </Link>
        <p className="flex min-w-0 items-center gap-1.5 text-[13px]">
          {b.local ? (
            <>
              <Flag code={b.home?.country_code} className="h-3 w-[18px]" />
              <span className="truncate">
                {t.groups.local} · {b.home ? institutionShort(b.home, locale) : ""}
              </span>
            </>
          ) : (
            b.was && (
              <>
                <span className="shrink-0">{t.swarm.wasAt}</span>
                <Flag code={b.was.institution.country_code} className="h-3 w-[18px]" />
                <span className="truncate">
                  {institutionShort(b.was.institution, locale)} · {semesterLabel(b.was.semester, t)}
                </span>
              </>
            )
          )}
        </p>
      </div>
      {sentTo.has(b.id) ? (
        <span className="rounded-xl border-2 border-ink px-3 py-2 text-xs font-bold">{t.swarm.buddySent}</span>
      ) : (
        <form action={requestBuddy}>
          <input type="hidden" name="user_id" value={b.id} />
          <button className="btn-honey min-h-10 bg-ink text-honey hover:bg-black">{t.swarm.askBuddy}</button>
        </form>
      )}
    </div>
  );

  const discoverCard = (
    <Link href="/grupy" className="panel flex items-center gap-3.5 p-4 hover:border-ink">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-honey">
        <Compass size={22} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{t.discover.browse}</span>
        <span className="block text-[13px] text-muted">{t.discover.browseLead}</span>
      </span>
      <ArrowRight size={18} />
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <div>
        <p className="text-sm font-medium text-muted">{t.swarm.hello(firstName)}</p>
        <h1 className="display text-[32px] leading-[1.05]">{t.swarm.title}</h1>
      </div>

      {discoverCard}

      {!me.exchanges.length && (
        <div className="honeycomb rounded-[28px] bg-honey p-6">
          <h2 className="display text-2xl">{t.swarm.noExchangeTitle}</h2>
          <p className="mt-2 max-w-md">{t.swarm.noExchangeLead}</p>
          <Link href="/profil" className="btn-primary mt-5">
            {t.swarm.noExchangeCta} <ArrowRight size={18} />
          </Link>
        </div>
      )}

      {best && (
        <section className="relative overflow-hidden rounded-[26px] bg-ink p-5 text-cream">
          <svg width="180" height="180" viewBox="0 0 100 100" className="absolute -top-10 -right-10 opacity-20" aria-hidden="true">
            <path d="M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z" fill="none" stroke="#FFC52E" strokeWidth="5" />
          </svg>
          <div className="relative flex items-center gap-2">
            <span className="rounded-full bg-honey px-2.5 py-1 text-xs font-bold text-ink">{t.swarm.best}</span>
            <span className="text-[13px] text-mist">{t.common.people(best.others + (best.self_counted ? 1 : 0))}</span>
          </div>
          <h2 className="display relative mt-3 flex items-center gap-2.5 text-[26px] leading-tight">
            <GroupFlag kind={best.kind} country_code={best.country_code} nat_cc={best.nat_cc} className="h-5 w-[30px]" />
            <span className="min-w-0 break-words">{info(best).title}</span>
          </h2>
          <p className="relative text-[15px] text-honey">{info(best).subtitle}</p>
          <p className="relative mt-2 text-sm text-mist">
            {t.swarm.sameAsYou}: <span className="font-semibold text-honey">{groupWhy(best.kind, t)}</span>
          </p>
          <div className="relative mt-4 flex items-center justify-between gap-3">
            <div className="flex">
              {faces.slice(0, 3).map((f, i) => (
                <span key={f.id} className={`rounded-full ring-[3px] ring-honey ${i ? "-ml-2" : ""}`}>
                  <Avatar name={f.full_name} url={f.avatar_url} size={38} />
                </span>
              ))}
            </div>
            {action(best, true)}
          </div>
        </section>
      )}

      {me.exchanges.length > 0 && !best && (
        <EmptyState title={t.swarm.firstTitle} action={<CopyInvite label={t.swarm.invite} copiedLabel={t.swarm.copied} />}>
          {t.swarm.firstLead}
        </EmptyState>
      )}

      {sections.map(({ x, groups: ordered }) => {
        const groups = ordered.filter((s) => s !== best);
        const shown = groups.slice(0, VISIBLE_PER_EXCHANGE);
        const more = groups.slice(VISIBLE_PER_EXCHANGE);
        return (
          <section key={x.id} className="space-y-3 pt-3">
            <div className="flex items-center gap-3">
              <InstBadge inst={x.institution} size={40} tone="honey" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{institutionShort(x.institution, locale)}</p>
                <p className="flex items-center gap-1.5 text-[13px] text-muted">
                  <Flag code={x.institution.country_code} className="h-3 w-[18px]" />
                  {cityName(x.institution.city, locale)} · {semesterLabel(x.semester, t)}
                </p>
              </div>
              <StatusBadge status={stageOf(x.status, x.semester)} t={t} />
            </div>
            {groups.length ? shown.map(row) : <p className="rounded-2xl bg-sand px-4 py-3 text-sm">{t.swarm.noGroupsYet}</p>}
            {more.length > 0 && (
              <details className="group space-y-3">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-2xl border-2 border-line text-sm font-semibold hover:border-ink [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">{t.swarm.showMore(more.length)}</span>
                  <span className="hidden group-open:inline">{t.swarm.showLess}</span>
                  <ChevronDown size={16} className="transition group-open:rotate-180" />
                </summary>
                {more.map(row)}
              </details>
            )}
          </section>
        );
      })}

      {localRows.length > 0 && (
        <section className="space-y-3 pt-3">
          <div>
            <h3 className="display text-lg">🏠 {t.groups.localSection}</h3>
            <p className="text-[13px] text-muted">{t.groups.localLead}</p>
          </div>
          {localRows.map(row)}
        </section>
      )}

      {homeBuddyList.length + localBuddyList.length > 0 && (
        <section className="space-y-3 rounded-[24px] bg-honey p-4">
          <h3 className="display text-lg">🧸 {t.swarm.buddies}</h3>
          {localBuddyList.length > 0 && <p className="label-caps">{t.swarm.buddiesLocal}</p>}
          {localBuddyList.map(buddyRow)}
          {homeBuddyList.length > 0 && <p className="label-caps pt-1">{t.swarm.buddiesHome}</p>}
          {homeBuddyList.map(buddyRow)}
        </section>
      )}

      <Link href="/ludzie" className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold underline">
        {t.swarm.browsePeople}
      </Link>
    </div>
  );
}
