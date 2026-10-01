"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { listenForInserts } from "@/lib/supabase/live";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export type GroupMessage = { id: number; sender_id: string; body: string; created_at: string };
export type Member = { id: string; full_name: string; buddy: boolean; guest: boolean; local: boolean };

export function GroupChat({
  locale,
  groupId,
  userId,
  members,
  initialMessages,
}: {
  locale: Locale;
  groupId: number;
  userId: string;
  members: Record<string, Member>;
  initialMessages: GroupMessage[];
}) {
  const t = dictionaries[locale];
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const catchUp = async () => {
      const { data } = await supabase.from("group_messages").select("id, sender_id, body, created_at").eq("group_id", groupId).order("created_at", { ascending: false }).limit(50);
      if (!data) return;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const fresh = (data as GroupMessage[]).filter((m) => !known.has(m.id));
        return fresh.length ? [...prev, ...fresh].sort((x, y) => x.created_at.localeCompare(y.created_at)) : prev;
      });
    };
    const onVisible = () => document.visibilityState === "visible" && catchUp();
    document.addEventListener("visibilitychange", onVisible);
    const stop = listenForInserts<GroupMessage>(supabase, {
      table: "group_messages",
      filter: `group_id=eq.${groupId}`,
      onInsert: (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        if (m.sender_id !== userId) void supabase.rpc("mark_group_read", { p_group: groupId }).then(() => undefined);
      },
      onReady: catchUp,
    });
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, [groupId, userId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("group_messages").insert({ group_id: groupId, sender_id: userId, body }).select("id, sender_id, body, created_at").single();
    setSending(false);
    if (error) {
      alert(t.group.sendFailed);
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">{t.group.empty}</p>}
        {messages.map((m, i) => {
          const mine = m.sender_id === userId;
          const author = members[m.sender_id];
          const showAuthor = !mine && messages[i - 1]?.sender_id !== m.sender_id;
          const tone = mine ? "bg-ink text-cream rounded-br-md" : author?.buddy ? "bg-honey rounded-bl-md" : "bg-white border-[1.5px] border-line rounded-bl-md";
          return (
            <div key={m.id} className={`flex max-w-[82%] min-w-0 flex-col gap-1 ${mine ? "items-end self-end" : "self-start"}`}>
              {showAuthor && (
                <span className="px-1.5 text-xs font-semibold text-muted">
                  {author?.full_name ?? "?"}
                  {author?.buddy && " · 🧸 buddy"}
                  {author?.guest && ` · ${t.group.guest}`}
                  {author?.local && ` · ${t.groups.local}`}
                </span>
              )}
              <div className={`rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug break-words whitespace-pre-line ${tone}`} title={new Date(m.created_at).toLocaleString(locale)}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="mx-3 mb-3 flex items-center gap-2 rounded-[20px] border-2 border-ink bg-white py-1.5 pr-1.5 pl-4 shadow-[0_4px_0_#17140f]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.group.placeholder}
          aria-label={t.group.placeholder}
          maxLength={4000}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-[#8a8170]"
        />
        <button aria-label={t.common.send} disabled={sending || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-honey disabled:opacity-50">
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      </form>
    </>
  );
}
