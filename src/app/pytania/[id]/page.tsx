import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAnswer, toggleVote } from "@/app/actions";
import { Avatar, MentorBadge, StatusBadge } from "@/components/ui";
import { ReportButton } from "@/components/ReportButton";
import { getCurrentUser } from "@/lib/auth";
import type { Status } from "@/lib/constants";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Author = { id: string; full_name: string; avatar_url: string | null; status: Status; open_to_questions: boolean; home_university: string };
const AUTHOR = "profiles(id, full_name, avatar_url, status, open_to_questions, home_university)";

async function getQuestion(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("questions")
    .select(`*, cities(id, slug, name, country_flag), universities(slug, name), ${AUTHOR}`)
    .eq("id", parseInt(id, 10) || 0)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/pytania/[id]">): Promise<Metadata> {
  const q = await getQuestion((await params).id);
  return q ? { title: q.title, description: q.body?.slice(0, 160) || q.title } : {};
}

export default async function QuestionPage({ params }: PageProps<"/pytania/[id]">) {
  const q = await getQuestion((await params).id);
  if (!q) notFound();

  const { supabase, userId } = await getCurrentUser();
  const { data: answers } = await supabase
    .from("answers")
    .select(`id, body, created_at, ${AUTHOR}, answer_votes(user_id)`)
    .eq("question_id", q.id)
    .order("created_at");

  const sorted = (answers ?? [])
    .map((a) => {
      const votes = (a.answer_votes as { user_id: string }[]) ?? [];
      return { ...a, author: a.profiles as unknown as Author, votes: votes.length, voted: votes.some((v) => v.user_id === userId) };
    })
    .sort((a, b) => b.votes - a.votes);

  const author = q.profiles as Author;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link href={`/pytania?city=${q.cities.id}`} className="text-sm text-ink/60 hover:text-ink">
        ← Pytania: {q.cities.country_flag} {q.cities.name}
      </Link>

      <article className="card mt-3">
        <h1 className="text-2xl font-bold">{q.title}</h1>
        <p className="mt-1 text-sm text-ink/60">
          <Link href={`/destynacje/${q.cities.slug}`} className="hover:underline">
            {q.cities.name}
          </Link>
          {q.universities && (
            <>
              {" · "}
              <Link href={`/uczelnie/${q.universities.slug}`} className="hover:underline">
                {q.universities.name}
              </Link>
            </>
          )}
        </p>
        {q.body && <p className="mt-4 whitespace-pre-line">{q.body}</p>}
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Avatar name={author.full_name} url={author.avatar_url} size={28} />
          <Link href={`/profil/${author.id}`} className="font-medium hover:underline">
            {author.full_name}
          </Link>
          <span className="text-ink/50">· {formatRelative(q.created_at)}</span>
          <span className="ml-auto">
            <ReportButton type="question" id={q.id} />
          </span>
        </div>
      </article>

      <h2 className="h2 mb-3 mt-8">{sorted.length ? `Odpowiedzi (${sorted.length})` : "Brak odpowiedzi"}</h2>
      <div className="space-y-3">
        {sorted.map((a) => (
          <article key={a.id} className="card flex gap-4">
            <form action={toggleVote} className="flex flex-col items-center">
              <input type="hidden" name="question_id" value={q.id} />
              <input type="hidden" name="answer_id" value={a.id} />
              <button
                disabled={!userId}
                title={userId ? "Pomocna odpowiedź" : "Zaloguj się, żeby głosować"}
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg transition ${a.voted ? "bg-honey-400" : "bg-ink/5 hover:bg-honey-200"}`}
              >
                🍯
              </button>
              <span className="mt-1 text-sm font-bold">{a.votes}</span>
            </form>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line">{a.body}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <Avatar name={a.author.full_name} url={a.author.avatar_url} size={24} />
                <Link href={`/profil/${a.author.id}`} className="font-medium hover:underline">
                  {a.author.full_name}
                </Link>
                <StatusBadge status={a.author.status} />
                {a.author.open_to_questions && <MentorBadge />}
                <span className="text-ink/50">· {formatRelative(a.created_at)}</span>
                <span className="ml-auto">
                  <ReportButton type="answer" id={a.id} />
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="card mt-6">
        {userId ? (
          <form action={createAnswer} className="space-y-3">
            <input type="hidden" name="question_id" value={q.id} />
            <label className="block">
              <span className="label">Twoja odpowiedź</span>
              <textarea name="body" required rows={4} placeholder="Podziel się tym, co wiesz…" className="input" />
            </label>
            <button className="btn">Odpowiedz</button>
          </form>
        ) : (
          <p className="text-sm">
            <Link href={`/login?next=/pytania/${q.id}`} className="font-semibold text-honey-700 underline">
              Zaloguj się
            </Link>
            , żeby odpowiedzieć.
          </p>
        )}
      </div>
    </div>
  );
}
