import Link from "next/link";
import { answerBuddy, answerCheck } from "@/app/actions/bx";
import { cityName } from "@/lib/cities";
import { Avatar, EmptyState, PageTitle } from "@/components/bx";
import { GroupFlag, GroupKindIcon } from "@/components/GroupKindIcon";
import { requireProfile } from "@/lib/auth";
import { INSTITUTION_FIELDS, formatRelative, type Institution } from "@/lib/domain";
import { groupTitle, type GroupKind } from "@/lib/groups";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";

export const generateMetadata = localizedTitle((t) => t.nav.chats);

type Person = { id: string; full_name: string; avatar_url: string | null };

export default async function ChatsPage() {
  const { supabase, userId } = await requireProfile("/chats");
  const { t, locale } = await getDictionary();

  const [{ data: requests }, { data: checks }, { data: memberships }, { data: conversations }, { data: unreadRows }] = await Promise.all([
    supabase.from("buddy_requests").select("id, created_at, from:profiles!buddy_requests_from_user_fkey(id, full_name, avatar_url)").eq("to_user", userId).eq("status", "pending"),
    // 🕵️ prośby o sprawdzenie mieszkania (nowe i przyjęte, żeby po obejrzeniu oznaczyć „sprawdzone”)
    supabase
      .from("check_requests")
      .select("id, city, details, status, from:profiles!check_requests_requester_id_fkey(id, full_name, avatar_url)")
      .eq("checker_id", userId)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false }),
    supabase
      .from("group_members")
      .select(
        `groups(id, kind, city, country_code, nat_cc, semester, home:institutions!groups_home_institution_id_fkey(${INSTITUTION_FIELDS}), exchange:institutions!groups_exchange_institution_id_fkey(${INSTITUTION_FIELDS}),
         group_messages(body, created_at))`,
      )
      .eq("user_id", userId)
      .order("created_at", { referencedTable: "groups.group_messages", ascending: false })
      .limit(1, { referencedTable: "groups.group_messages" }),
    supabase
      .from("conversations")
      .select("id, last_message_at, a:profiles!conversations_user_a_fkey(id, full_name, avatar_url), b:profiles!conversations_user_b_fkey(id, full_name, avatar_url), messages(body, sender_id, created_at)")
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" }),
    supabase.rpc("unread_threads"),
  ]);
  const unread = new Map(((unreadRows ?? []) as { kind: string; thread_id: string; unread: number }[]).map((r) => [`${r.kind}:${r.thread_id}`, r.unread]));
  const dot = (n: number | undefined) =>
    n ? <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-honey px-1.5 text-xs font-extrabold ring-2 ring-ink">{n > 99 ? "99+" : n}</span> : null;

  type G = { id: number; kind: GroupKind; city: string | null; country_code: string | null; nat_cc: string | null; semester: string | null; home: Institution | null; exchange: Institution | null; group_messages: { body: string; created_at: string }[] };
  const groups = (memberships ?? [])
    .map((m) => m.groups as unknown as G)
    .filter(Boolean)
    .sort((a, b) => (b.group_messages[0]?.created_at ?? "").localeCompare(a.group_messages[0]?.created_at ?? ""));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <PageTitle title={t.chats.title} />

      {!!requests?.length && (
        <section className="space-y-2">
          <h2 className="label-caps">{t.chats.requests}</h2>
          {requests.map((r) => {
            const from = r.from as unknown as Person;
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-3xl bg-honey p-3.5">
                <Link href={`/u/${from.id}`}>
                  <Avatar name={from.full_name} url={from.avatar_url} size={44} />
                </Link>
                <p className="min-w-0 flex-1 text-sm">
                  <Link href={`/u/${from.id}`} className="font-bold hover:underline">
                    {from.full_name}
                  </Link>{" "}
                  {t.chats.wantsBuddy}
                </p>
                <div className="flex gap-2">
                  <form action={answerBuddy}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="accept" value="0" />
                    <button className="btn-outline min-h-10 px-3">{t.chats.decline}</button>
                  </form>
                  <form action={answerBuddy}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="accept" value="1" />
                    <button className="btn-honey min-h-10 bg-ink text-honey hover:bg-black">{t.chats.accept}</button>
                  </form>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {!!checks?.length && (
        <section className="space-y-2">
          <h2 className="label-caps">{t.chats.checkRequests}</h2>
          {checks.map((r) => {
            const from = r.from as unknown as Person;
            return (
              <div key={r.id} className="space-y-2.5 rounded-3xl bg-sand p-3.5">
                <div className="flex items-center gap-3">
                  <Link href={`/u/${from.id}`}>
                    <Avatar name={from.full_name} url={from.avatar_url} size={44} />
                  </Link>
                  <p className="min-w-0 flex-1 text-sm">
                    <Link href={`/u/${from.id}`} className="font-bold hover:underline">
                      {from.full_name}
                    </Link>{" "}
                    {t.chats.wantsCheck(cityName(r.city, locale))}
                  </p>
                </div>
                <p className="rounded-2xl bg-white px-3 py-2 text-sm break-words whitespace-pre-line">{r.details}</p>
                <div className="flex justify-end gap-2">
                  {r.status === "pending" ? (
                    <>
                      <form action={answerCheck}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="declined" />
                        <button className="btn-outline min-h-10 px-3">{t.chats.decline}</button>
                      </form>
                      <form action={answerCheck}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value="accepted" />
                        <button className="btn-honey min-h-10 bg-ink text-honey hover:bg-black">{t.chats.accept}</button>
                      </form>
                    </>
                  ) : (
                    <form action={answerCheck}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="done" />
                      <button className="btn-honey min-h-10 bg-ink text-honey hover:bg-black">✓ {t.chats.markChecked}</button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="label-caps">{t.chats.groups}</h2>
        {groups.length ? (
          <div className="panel divide-y divide-sand overflow-hidden">
            {groups.map((g) => {
              const { title, subtitle } = groupTitle(g, t, locale);
              const last = g.group_messages[0];
              const n = unread.get(`group:${g.id}`);
              return (
                <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 p-3.5 hover:bg-cream">
                  <GroupKindIcon kind={g.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="flex min-w-0 items-center gap-2 font-bold">
                        <GroupFlag kind={g.kind} country_code={g.country_code} nat_cc={g.nat_cc} className="h-3 w-[18px]" />
                        <span className="truncate">{title}</span>
                      </p>
                      {last && <span className="shrink-0 text-xs text-muted">{formatRelative(last.created_at, locale)}</span>}
                    </div>
                    <p className={`truncate text-[13px] ${n ? "font-semibold text-ink" : "text-muted"}`}>{last ? last.body : subtitle}</p>
                  </div>
                  {dot(n)}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            action={
              <Link href="/swarm" className="btn-primary">
                {t.nav.swarm}
              </Link>
            }
          >
            {t.chats.noGroups}
          </EmptyState>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="label-caps">{t.chats.direct}</h2>
        {conversations?.length ? (
          <div className="panel divide-y divide-sand overflow-hidden">
            {conversations.map((c) => {
              const a = c.a as unknown as Person;
              const b = c.b as unknown as Person;
              const other = a.id === userId ? b : a;
              const last = (c.messages as { body: string; sender_id: string }[])[0];
              const n = unread.get(`direct:${c.id}`);
              return (
                <Link key={c.id} href={`/messages/${c.id}`} className="flex items-center gap-3 p-3.5 hover:bg-cream">
                  <Avatar name={other.full_name} url={other.avatar_url} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-bold">{other.full_name}</p>
                      <span className="shrink-0 text-xs text-muted">{formatRelative(c.last_message_at, locale)}</span>
                    </div>
                    <p className={`truncate text-[13px] ${n ? "font-semibold text-ink" : "text-muted"}`}>
                      {last ? `${last.sender_id === userId ? `${t.chats.you}: ` : ""}${last.body}` : t.chats.newConversation}
                    </p>
                  </div>
                  {dot(n)}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState>{t.chats.noDirect}</EmptyState>
        )}
      </section>
    </div>
  );
}
