import Link from "next/link";
import { GroupFlag } from "@/components/GroupKindIcon";
import { notFound } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { joinGroup, joinGroupById, leaveGroup } from "@/app/actions/bx";
import { requireProfile } from "@/lib/auth";
import { INSTITUTION_FIELDS, type Institution } from "@/lib/domain";
import { groupTitle, type GroupKind, type Suggestion } from "@/lib/groups";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { GroupChat, type GroupMessage, type Member } from "./GroupChat";

export const generateMetadata = localizedTitle((t) => t.nav.chats);

export default async function GroupPage({ params }: PageProps<"/grupy/[id]">) {
  const id = Number((await params).id);
  const { supabase, userId } = await requireProfile(`/grupy/${id}`);
  const { t, locale } = await getDictionary();

  const { data: group } = await supabase
    .from("groups")
    .select(`id, kind, key, city, country_code, nat_cc, semester, home:institutions!groups_home_institution_id_fkey(${INSTITUTION_FIELDS}), exchange:institutions!groups_exchange_institution_id_fkey(${INSTITUTION_FIELDS})`)
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: memberRows } = await supabase
    .from("group_members")
    .select("user_id, is_guest, is_local, profiles(id, full_name, avatar_url, wants_buddy, status)")
    .eq("group_id", id)
    .order("joined_at");
  const members: Record<string, Member> = {};
  const list = (memberRows ?? []).map((r) => ({
    ...(r.profiles as unknown as { id: string; full_name: string; avatar_url: string | null; wants_buddy: boolean; status: string }),
    guest: r.is_guest,
    local: r.is_local,
  }));
  for (const m of list) members[m.id] = { id: m.id, full_name: m.full_name, buddy: m.wants_buddy, guest: m.guest, local: m.local };
  const isMember = !!members[userId];
  // Do grupy pasującej do mojej wymiany dołączam normalnie, do każdej innej jako gość
  const match = isMember ? null : (((await supabase.rpc("group_suggestions")).data ?? []) as Suggestion[]).find((s) => s.key === group.key);

  if (isMember) await supabase.rpc("mark_group_read", { p_group: id });

  const { data: messages } = isMember
    ? await supabase.from("group_messages").select("id, sender_id, body, created_at").eq("group_id", id).order("created_at", { ascending: false }).limit(200)
    : { data: [] };

  const { title, subtitle } = groupTitle(
    {
      kind: group.kind as GroupKind,
      home: group.home as unknown as Institution | null,
      exchange: group.exchange as unknown as Institution | null,
      city: group.city,
      country_code: group.country_code,
      nat_cc: group.nat_cc,
      semester: group.semester,
    },
    t,
    locale,
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px-96px)] max-w-2xl flex-col md:h-[calc(100dvh-64px-24px)]">
      <div className="rounded-b-[28px] bg-ink px-4 pt-3 pb-4 text-cream">
        <div className="flex items-center gap-3">
          <Link href="/czaty" aria-label={t.common.back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-soft">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="display flex min-w-0 items-center gap-2 text-lg">
              <GroupFlag kind={group.kind} country_code={group.country_code} nat_cc={group.nat_cc} />
              <span className="truncate">{title}</span>
            </p>
            <p className="truncate text-[13px] text-mist">
              {subtitle} · {t.common.people(list.length)}
            </p>
          </div>
          {isMember && (
            <form action={leaveGroup}>
              <input type="hidden" name="group_id" value={id} />
              <button aria-label={t.group.leave} title={t.group.leave} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-soft text-mist hover:text-honey">
                <LogOut size={18} />
              </button>
            </form>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {list.map((m) => (
            <Link
              key={m.id}
              href={`/u/${m.id}`}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${members[m.id].buddy ? "bg-honey text-ink" : "bg-ink-soft text-cream hover:text-honey"}`}
            >
              {m.id === userId ? t.chats.you : m.full_name.split(" ")[0]}
              {members[m.id].buddy && " · 🧸 buddy"}
              {members[m.id].guest && ` · ${t.group.guest}`}
              {members[m.id].local && ` · ${t.groups.local}`}
            </Link>
          ))}
        </div>
      </div>

      {isMember ? (
        <GroupChat locale={locale} groupId={id} userId={userId} members={members} initialMessages={((messages ?? []) as GroupMessage[]).reverse()} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-muted">{match ? t.group.joinToChat : t.group.guestNote}</p>
          {match ? (
            <form action={joinGroup}>
              <input type="hidden" name="kind" value={match.kind} />
              {match.exchange_id && <input type="hidden" name="exchange_id" value={match.exchange_id} />}
              {match.home_id && <input type="hidden" name="home_id" value={match.home_id} />}
              <button className="btn-primary">{t.common.join}</button>
            </form>
          ) : (
            <form action={joinGroupById}>
              <input type="hidden" name="group_id" value={id} />
              <button className="btn-primary">{t.discover.joinGuest}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
