import type { Metadata } from "next";
import Link from "next/link";
import { Empty } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pytania o Erasmusa",
  description: "Pytania i odpowiedzi o Erasmusie: uczelnie, mieszkania, życie na miejscu. Odpowiadają osoby, które tam były.",
};

export default async function QuestionsPage({ searchParams }: PageProps<"/pytania">) {
  const sp = await searchParams;
  const cityId = typeof sp.city === "string" ? parseInt(sp.city, 10) : NaN;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const unanswered = sp.unanswered === "1";

  const supabase = await createClient();
  let query = supabase
    .from("questions")
    .select("id, title, body, created_at, cities(name, country_flag), universities(short_name, name), profiles(full_name), answers(count)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (Number.isFinite(cityId)) query = query.eq("city_id", cityId);
  if (q) query = query.ilike("title", `%${q.replace(/[%_]/g, "")}%`);

  const [{ data: questions }, { data: cities }] = await Promise.all([query, supabase.from("cities").select("id, name, country_flag").order("name")]);

  const rows = (questions ?? [])
    .map((x) => ({ ...x, answerCount: (x.answers as { count: number }[])?.[0]?.count ?? 0 }))
    .filter((x) => !unanswered || x.answerCount === 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Pytania</h1>
          <p className="mt-2 text-ink/70">Zapytaj tych, którzy już byli. Albo pomóż, jeśli sam(a) byłeś/aś.</p>
        </div>
        <Link href={`/pytania/nowe${Number.isFinite(cityId) ? `?city=${cityId}` : ""}`} className="btn-honey">
          + Zadaj pytanie
        </Link>
      </div>

      <form className="card mt-6 grid gap-3 p-4 sm:grid-cols-[2fr_1fr_auto_auto]">
        <input name="q" defaultValue={q} placeholder="Szukaj w pytaniach…" className="input" />
        <select name="city" defaultValue={Number.isFinite(cityId) ? String(cityId) : ""} className="input">
          <option value="">Wszystkie miasta</option>
          {cities?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.country_flag} {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="unanswered" value="1" defaultChecked={unanswered} className="accent-honey-500" /> Bez odpowiedzi
        </label>
        <button className="btn">Filtruj</button>
      </form>

      <div className="mt-6 space-y-3">
        {rows.map((x) => {
          const city = x.cities as unknown as { name: string; country_flag: string } | null;
          const uni = x.universities as unknown as { short_name: string | null; name: string } | null;
          return (
            <Link key={x.id} href={`/pytania/${x.id}`} className="card flex gap-4 p-4 transition hover:border-honey-500">
              <div
                className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center ${x.answerCount ? "bg-honey-400" : "bg-ink/5"}`}
              >
                <span className="text-lg font-bold leading-none">{x.answerCount}</span>
                <span className="text-[10px]">odp.</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{x.title}</p>
                {x.body && <p className="line-clamp-1 text-sm text-ink/60">{x.body}</p>}
                <p className="mt-1 text-xs text-ink/50">
                  {city?.country_flag} {city?.name}
                  {uni && ` · ${uni.short_name || uni.name}`} · {(x.profiles as unknown as { full_name: string } | null)?.full_name} ·{" "}
                  {formatRelative(x.created_at)}
                </p>
              </div>
            </Link>
          );
        })}
        {rows.length === 0 && <Empty action={{ href: "/pytania/nowe", label: "Zadaj pytanie" }}>Brak pytań.</Empty>}
      </div>
    </div>
  );
}
