import Link from "next/link";
import { ArrowRight, Compass, Plus } from "lucide-react";
import { joinGroup, requestBuddy } from "@/app/actions/bx";
import { Avatar, EmptyState, Flag, InstBadge, StatusBadge } from "@/components/bx";
import { CopyInvite } from "@/components/CopyInvite";
import { GroupKindIcon } from "@/components/GroupKindIcon";
import { requireProfile } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { institutionShort, semesterLabel, stageOf, type Institution } from "@/lib/domain";
import { groupTitle, groupWhy, type Suggestion } from "@/lib/groups";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";

export const generateMetadata = localizedTitle((t) => t.nav.swarm);

type Mini = { id: string; full_name: string; avatar_url: string | null };
type Buddy = Mini & { home: Institution | null; local: boolean; semester: string | null };
type Row = Suggestion & { others: number };

export default async function SwarmPage() {
  const { supabase, userId, profile: me } = await requireProfile("/roj");
  const { t, locale } = await getDictionary();
  const firstName = me.full_name.split(" ")[0] || "";

  const exInsts = me.exchanges.map((x) => x.institution_id);
  const BUDDY_FIELDS = "id, full_name, avatar_url, wants_buddy, home:institutions!profiles_home_institution_id_fkey(id, name, name_en, name_pl, acronym, country_code, city)";

  const [{ data: sugg }, { data: alumniBuddies }, { data: localBuddies }, { data: sent }] = await Promise.all([
    supabase.rpc("group_suggestions"),
    // Absolwenci moich uczelni zagranicznych
    exInsts.length
      ? supabase.from("exchanges").select(`semester, profiles!inner(${BUDDY_FIELDS})`).in("institution_id", exInsts).eq("status", "been").eq("profiles.wants_buddy", true).neq("user_id", userId).limit(6)
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
  // Najlepsze dopasowanie: najbardziej konkretna grupa z najbliższej wymiany
  const best = exchangeRows.find((s) => s.kind === "route") ?? exchangeRows.find((s) => s.kind === "nat_uni") ?? exchangeRows.find((s) => s.kind === "semester") ?? exchangeRows[0];

  let faces: Mini[] = [];
  if (best) {
    let q = supabase.from("exchanges").select("profiles!inner(id, full_name, avatar_url)").eq("institution_id", best.institution_id).neq("user_id", userId).limit(4);
    if (best.kind === "alumni") q = q.eq("status", "been");
    else if (best.semester) q = q.eq("semester", best.semester);
    faces = ((await q).data ?? []).map((r) => r.profiles as unknown as Mini);
  }

  const sentTo = new Set((sent ?? []).map((r) => r.to_user));
  const buddies = new Map<string, Buddy>();
  for (const r of localBuddies ?? []) {
    const p = r.profiles as unknown as Mini & { home: Institution | null };
    buddies.set(p.id, { ...p, local: true, semester: null });
  }
  for (const r of alumniBuddies ?? []) {
    const p = r.profiles as unknown as Mini & { home: Institution | null };
    if (!buddies.has(p.id)) buddies.set(p.id, { ...p, local: false, semester: r.semester });
  }

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
            <Flag code={s.country_code} className="h-3.5 w-5" />
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
            <Flag code={best.country_code} className="h-5 w-[30px]" />
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

      {me.exchanges.map((x) => {
        const groups = exchangeRows.filter((s) => s.exchange_id === x.id && s !== best);
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
            {groups.length ? groups.map(row) : <p className="rounded-2xl bg-sand px-4 py-3 text-sm">{t.swarm.noGroupsYet}</p>}
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

      {discoverCard}

      <Link href="/profil" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line text-sm font-semibold">
        <Plus size={16} /> {t.profile.addExchange}
      </Link>

      {buddies.size > 0 && (
        <section className="space-y-3 rounded-[24px] bg-honey p-4">
          <h3 className="display text-lg">🧸 {t.swarm.buddies}</h3>
          {[...buddies.values()].map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <Link href={`/u/${b.id}`} className="rounded-full ring-2 ring-ink">
                <Avatar name={b.full_name} url={b.avatar_url} size={48} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${b.id}`} className="block truncate font-bold hover:underline">
                  {b.full_name}
                </Link>
                <p className="flex min-w-0 items-center gap-1.5 truncate text-[13px]">
                  {b.local ? (
                    <>
                      <Flag code={b.home?.country_code} className="h-3 w-[18px]" />
                      <span className="truncate">
                        {t.groups.local} · {b.home ? institutionShort(b.home, locale) : ""}
                      </span>
                    </>
                  ) : (
                    <span className="truncate">
                      {b.home ? institutionShort(b.home, locale) : ""} · {semesterLabel(b.semester, t)}
                    </span>
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
          ))}
        </section>
      )}

      <Link href="/ludzie" className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold underline">
        {t.swarm.browsePeople}
      </Link>
    </div>
  );
}
