import Link from "next/link";
import { ArrowRight, ChevronDown, Compass } from "lucide-react";
import { joinGroup, requestBuddy } from "@/app/actions/bx";
import { Avatar, EmptyState, Flag, InstBadge, StatusBadge } from "@/components/bx";
import { CopyInvite } from "@/components/CopyInvite";
import { GroupFlag, GroupKindIcon } from "@/components/GroupKindIcon";
import { PhotoBanner, loadPlacePhotos, placeKey } from "@/components/PlacePhoto";
import { requireProfile } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { groupSemesters, exchangeStage, institutionName, personStage, semesterLabel, semesterPhase, type Institution } from "@/lib/domain";
import { PERSON_SELECT, PersonCard, personBadges, sortExchanges, type Person } from "@/components/PersonCard";
import { groupTitle, isActiveGroup, groupWhy, type GroupKind, type Suggestion } from "@/lib/groups";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";

export const generateMetadata = localizedTitle((t) => t.nav.swarm);

type Mini = { id: string; full_name: string; avatar_url: string | null };
type Row = Suggestion & { others: number };

// Kolejność grup przy wymianie: najpierw rodacy na uczelni i w mieście, potem wszyscy, na końcu kraj
const GROUP_ORDER: GroupKind[] = ["nat_uni", "nat_city", "semester", "city", "nat_country"];
const VISIBLE_PER_EXCHANGE = 2;

export default async function SwarmPage() {
  const { supabase, userId, profile: me } = await requireProfile("/swarm");
  const { t, locale } = await getDictionary();
  const firstName = me.full_name.split(" ")[0] || "";

  const myStage = personStage(me.exchanges, me);
  // Buddy szukam tylko na uczelniach wymian, które są przede mną albo trwają
  const exInsts = me.exchanges.filter((x) => semesterPhase(x.semester) !== "past").map((x) => x.institution_id);
  const homeInsts = me.homes.map((h) => h.institution_id);
  // Drugie dołączenie profile_homes (alias „at”) tylko do filtrowania po uczelni
  const bySchool = (ids: number[], flag: "wants_buddy" | "helps_departure") =>
    supabase.from("profiles").select(`${PERSON_SELECT}, at:profile_homes!inner(institution_id)`).in("at.institution_id", ids).eq(flag, true).neq("id", userId).limit(30);

  const [{ data: sugg }, { data: localRows0 }, { data: helperRows }, { data: sent }] = await Promise.all([
    supabase.rpc("group_suggestions"),
    // 🧸 Lokalni studenci uczelni, na które jadę (np. Włosi z PoliMi)
    exInsts.length ? bySchool(exInsts, "wants_buddy") : Promise.resolve({ data: [] }),
    // 📋 Osoby z mojej uczelni, które pomogą przed wyjazdem (nie pokazujemy absolwentom)
    homeInsts.length && (myStage === "searching" || myStage === "going") ? bySchool(homeInsts, "helps_departure") : Promise.resolve({ data: [] }),
    supabase.from("buddy_requests").select("to_user").eq("from_user", userId),
  ]);

  // Uczelnie potrzebne do tytułów grup
  const insts = new Map<number, Institution>();
  for (const x of me.exchanges) insts.set(x.institution_id, x.institution);
  for (const h of me.homes) insts.set(h.institution_id, h.institution);

  const seen = new Set<string>();
  const all: Row[] = ((sugg ?? []) as Suggestion[])
    .filter((s) => s.key && isActiveGroup(s) && !seen.has(s.key) && seen.add(s.key))
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
  const rank = (k: GroupKind) => GROUP_ORDER.indexOf(k) + 1 || 99;
  const sections = sortExchanges(me.exchanges).map((x) => ({
    x,
    groups: exchangeRows.filter((s) => s.exchange_id === x.id).sort((a, b) => rank(a.kind) - rank(b.kind)),
  }));
  // Najlepsze dopasowanie: pierwsza grupa najbliższej wymiany (wymiany przed wyjazdem są na początku listy)
  // Najlepsze dopasowanie tylko dla wymian przed nami i trwających — absolwentom nic nie polecamy
  // Grupy tylko na bieżący semestr i dwa kolejne; dalsze wymiany dostaną grupy bliżej wyjazdu
  const groupWindow = groupSemesters();
  const upcoming = sections.filter((sec) => groupWindow.includes(sec.x.semester));
  const later = sections.filter((sec) => sec.x.semester > groupWindow[groupWindow.length - 1]);
  const best = upcoming.find((sec) => sec.groups.length)?.groups[0];

  let faces: Mini[] = [];
  if (best?.institution_id) {
    let q = supabase.from("exchanges").select("profiles!inner(id, full_name, avatar_url)").eq("institution_id", best.institution_id).neq("user_id", userId).limit(4);
    if (best.semester) q = q.eq("semester", best.semester);
    faces = ((await q).data ?? []).map((r) => r.profiles as unknown as Mini);
  }

  const photos = await loadPlacePhotos(
    supabase,
    me.exchanges.map((x) => ({ cc: x.institution.country_code, city: x.institution.city })),
  );

  const sentTo = new Set((sent ?? []).map((r) => r.to_user));
  const unique = (rows: unknown[] | null) => [...new Map(((rows ?? []) as Person[]).map((p) => [p.id, p])).values()];
  // 🧸 tylko obecni studenci (absolwenci nie są buddy)
  const localBuddyList = unique(localRows0).filter((p) => personBadges(p).buddy).slice(0, 6);
  // 📋 tylko osoby po wymianie albo z wybraną wymianą; najpierw ci, którzy byli tam, dokąd jadę
  const wentWhereIGo = (p: Person) => Number(p.exchanges.some((x) => exInsts.includes(x.institution.id)));
  const helperList = unique(helperRows)
    .filter((p) => p.exchanges.length > 0 && !localBuddyList.some((b) => b.id === p.id))
    .sort((a, b) => wentWhereIGo(b) - wentWhereIGo(a))
    .slice(0, 6);

  const action = (s: Row, dark = false) =>
    s.is_member && s.group_id ? (
      <Link href={`/groups/${s.group_id}`} className={dark ? "btn-honey min-h-12 px-5" : "btn-outline shrink-0"}>
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

  const askBuddy = (id: string) =>
    sentTo.has(id) ? (
      <span className="rounded-xl border-2 border-ink px-3 py-2 text-xs font-bold">{t.swarm.buddySent}</span>
    ) : (
      <form action={requestBuddy}>
        <input type="hidden" name="user_id" value={id} />
        <button className="btn-honey min-h-10 bg-ink text-honey hover:bg-black">{t.swarm.askBuddy}</button>
      </form>
    );

  const discoverCard = (
    <Link href="/groups" className="panel flex items-center gap-3.5 p-4 hover:border-ink">
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

      {myStage === "been" && !(me.helps_departure && me.checks_housing) && (
        <Link href="/profile" className="block rounded-[26px] bg-ink p-5 text-cream">
          <p className="display text-xl">👑 {t.swarm.helpTitle}</p>
          <p className="mt-1 text-sm text-mist">{t.swarm.helpLead}</p>
          <span className="btn-honey mt-4 min-h-11">
            {t.swarm.helpCta} <ArrowRight size={16} />
          </span>
        </Link>
      )}

      {!me.exchanges.length && (
        <div className="honeycomb rounded-[28px] bg-honey p-6">
          <h2 className="display text-2xl">{t.swarm.noExchangeTitle}</h2>
          <p className="mt-2 max-w-md">{t.swarm.noExchangeLead}</p>
          <Link href="/profile" className="btn-primary mt-5">
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

      {upcoming.length > 0 && !best && (
        <EmptyState title={t.swarm.firstTitle} action={<CopyInvite label={t.swarm.invite} copiedLabel={t.swarm.copied} />}>
          {t.swarm.firstLead}
        </EmptyState>
      )}

      {later.map(({ x }) => (
        <p key={x.id} className="rounded-2xl bg-sand px-4 py-3 text-sm">
          {t.swarm.groupsLater(institutionName(x.institution), semesterLabel(x.semester, t))}
        </p>
      ))}

      {/* Zakończone wymiany nie dostają już propozycji grup — do starych grup wchodzi się przez Czaty */}
      {upcoming.map(({ x, groups: ordered }) => {
        const groups = ordered.filter((s) => s !== best);
        const shown = groups.slice(0, VISIBLE_PER_EXCHANGE);
        const more = groups.slice(VISIBLE_PER_EXCHANGE);
        const photo = photos.get(placeKey(x.institution.country_code, x.institution.city));
        const header = (
          <div className={`flex items-center gap-3 ${photo ? "p-3.5 pb-6 text-cream" : ""}`}>
            <InstBadge inst={x.institution} size={40} tone="honey" />
            <div className="min-w-0 flex-1">
              <p className="leading-tight font-bold">{institutionName(x.institution)}</p>
              <p className={`flex items-center gap-1.5 text-[13px] ${photo ? "text-sand" : "text-muted"}`}>
                <Flag code={x.institution.country_code} className="h-3 w-[18px]" />
                {cityName(x.institution.city, locale)} · {semesterLabel(x.semester, t)}
              </p>
            </div>
            <StatusBadge status={exchangeStage(x.semester)} t={t} />
          </div>
        );
        return (
          <section key={x.id} className="space-y-3 pt-3">
            {photo ? (
              <PhotoBanner src={photo.url} credit={photo} t={t} className="h-40 rounded-[22px]">
                {header}
              </PhotoBanner>
            ) : (
              header
            )}
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

      {localBuddyList.length > 0 && (
        <section className="space-y-3 rounded-[24px] bg-honey p-4">
          <div>
            <h3 className="display text-lg">🧸 {t.swarm.buddies}</h3>
            <p className="text-[13px]">{t.swarm.buddiesLead}</p>
          </div>
          {localBuddyList.map((p) => (
            <PersonCard key={p.id} p={p} locale={locale} t={t} viewerHomeIds={homeInsts} footer={askBuddy(p.id)} className="rounded-2xl bg-cream p-3" />
          ))}
        </section>
      )}

      {helperList.length > 0 && (
        <section className="space-y-3 rounded-[24px] bg-sand p-4">
          <div>
            <h3 className="display text-lg">📋 {t.swarm.helpers}</h3>
            <p className="text-[13px] text-muted">{t.swarm.helpersLead}</p>
          </div>
          {helperList.map((p) => (
            <PersonCard key={p.id} p={p} locale={locale} t={t} viewerHomeIds={homeInsts} className="rounded-2xl bg-cream p-3" />
          ))}
        </section>
      )}

      <Link href="/people" className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold underline">
        {t.swarm.browsePeople}
      </Link>
    </div>
  );
}
