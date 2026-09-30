"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export type Message = { id: number; sender_id: string; body: string; created_at: string };

export function Chat({ locale, conversationId, userId, initialMessages }: { locale: Locale; conversationId: string; userId: string; initialMessages: Message[] }) {
  const t = dictionaries[locale];
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    const catchUp = async () => {
      const { data } = await supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(50);
      if (!data) return;
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        const fresh = (data as Message[]).filter((m) => !known.has(m.id));
        return fresh.length ? [...prev, ...fresh].sort((x, y) => x.created_at.localeCompare(y.created_at)) : prev;
      });
    };
    const onVisible = () => document.visibilityState === "visible" && catchUp();
    document.addEventListener("visibilitychange", onVisible);
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.sender_id !== userId) void supabase.rpc("mark_conversation_read", { p_conversation: conversationId }).then(() => undefined);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") catchUp();
      });
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: userId, body }).select("id, sender_id, body, created_at").single();
    setSending(false);
    if (error) {
      alert(t.group.sendFailed);
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">{t.group.empty}</p>}
        {messages.map((m) => {
          const mine = m.sender_id === userId;
          return (
            <div
              key={m.id}
              title={new Date(m.created_at).toLocaleString(locale)}
              className={`max-w-[82%] rounded-[18px] px-3.5 py-2.5 text-[15px] leading-snug break-words whitespace-pre-line ${
                mine ? "self-end rounded-br-md bg-ink text-cream" : "self-start rounded-bl-md border-[1.5px] border-line bg-white"
              }`}
            >
              {m.body}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="mx-3 mb-3 flex items-center gap-2 rounded-[20px] border-2 border-ink bg-white py-1.5 pr-1.5 pl-4 shadow-[0_4px_0_#17140f]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          placeholder={t.group.placeholder}
          aria-label={t.group.placeholder}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-[#8a8170]"
        />
        <button aria-label={t.common.send} disabled={sending || !draft.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-honey disabled:opacity-50">
          <ArrowRight size={20} strokeWidth={2.5} />
        </button>
      </form>
    </>
  );
}
