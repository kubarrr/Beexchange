import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Avatar } from "@/components/bx";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { Chat, type Message } from "./Chat";

export const generateMetadata = localizedTitle((t) => t.nav.chats);

type Person = { id: string; full_name: string; avatar_url: string | null; field_of_study: string };

export default async function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const { supabase, userId } = await requireUser(`/messages/${id}`);
  const { t, locale } = await getDictionary();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, a:profiles!conversations_user_a_fkey(id, full_name, avatar_url, field_of_study), b:profiles!conversations_user_b_fkey(id, full_name, avatar_url, field_of_study)")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const { data: messages } = await supabase.from("messages").select("id, sender_id, body, created_at").eq("conversation_id", id).order("created_at", { ascending: false }).limit(200);

  await supabase.rpc("mark_conversation_read", { p_conversation: id });

  const a = conv.a as unknown as Person;
  const b = conv.b as unknown as Person;
  const other = a.id === userId ? b : a;

  return (
    <div className="mx-auto flex h-[calc(100dvh-64px-96px)] max-w-2xl flex-col md:h-[calc(100dvh-64px-24px)]">
      <div className="flex items-center gap-3 rounded-b-[28px] bg-ink px-4 py-3 text-cream">
        <Link href="/chats" aria-label={t.common.back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-soft">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </Link>
        <Link href={`/u/${other.id}`} className="flex min-w-0 items-center gap-3">
          <Avatar name={other.full_name} url={other.avatar_url} size={40} />
          <span className="min-w-0">
            <span className="display block truncate text-lg">{other.full_name}</span>
            {other.field_of_study && <span className="block truncate text-[13px] text-mist">{other.field_of_study}</span>}
          </span>
        </Link>
      </div>
      <Chat locale={locale} conversationId={id} userId={userId} initialMessages={((messages ?? []) as Message[]).reverse()} />
    </div>
  );
}
