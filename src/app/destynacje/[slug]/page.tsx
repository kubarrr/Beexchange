import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Empty, PERSON_SELECT, PersonCard, type PersonRow } from "@/components/ui";
import { formatRelative } from "@/lib/format";

async function getCity(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("cities").select("*").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/destynacje/[slug]">): Promise<Metadata> {
  const city = await getCity((await params).slug);
  if (!city) return {};
  return {
    title: `Erasmus ${city.name}: uczelnie, mieszkania, opinie`,
    description: `Erasmus ${city.name} (${city.country}): koszty życia, opinie polskich studentów, mieszkania i pytania do osób, które tam były.`,
  };
}

export default async function CityPage({ params }: PageProps<"/destynacje/[slug]">) {
  const { slug } = await params;
  const city = await getCity(slug);
  if (!city) notFound();

  const supabase = await createClient();
  const { data: unis } = await supabase.from("universities").select("id, slug, name, short_name, description").eq("city_id", city.id).order("name");
  const uniIds = (unis ?? []).map((u) => u.id);

  const [{ data: uniStats }, { data: people }, { data: questions }, { data: listings }, { data: cityStats }] = await Promise.all([
    supabase.from("university_stats").select("*").in("university_id", uniIds),
    supabase.from("profiles").select(PERSON_SELECT).in("destination_university_id", uniIds).order("open_to_questions", { ascending: false }).limit(6),
    supabase.from("questions").select("id, title, created_at, answers(count)").eq("city_id", city.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("listings").select("id, title, price, created_at").eq("city_id", city.id).eq("active", true).order("created_at", { ascending: false }).limit(4),
    supabase.from("city_stats").select("*").eq("city_id", city.id).maybeSingle(),
  ]);

  const tips = city.tips.split("\n").filter((t: string) => t.trim());

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/destynacje" className="text-sm text-ink/60 hover:text-ink">
        ← Wszystkie destynacje
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">
            {city.country_flag} {city.name}
          </h1>
          <p className="text-ink/60">{city.country}</p>
        </div>
        <Link href={`/pytania/nowe?city=${city.id}`} className="btn-honey">
          Zadaj pytanie
        </Link>
      </div>
      <p className="mt-4 max-w-3xl text-lg text-ink/80">{city.description}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section>
            <h2 className="h2 mb-3">🎓 Uczelnie</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {unis?.map((u) => {
                const s = uniStats?.find((st) => st.university_id === u.id);
                return (
                  <Link key={u.id} href={`/uczelnie/${u.slug}`} className="card p-4 transition hover:border-honey-500">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold">{u.name}</p>
                      {s?.avg_overall && <span className="shrink-0 text-sm font-bold">★ {Number(s.avg_overall).toFixed(1)}</span>}
                    </div>
                    {u.description && <p className="mt-1 line-clamp-2 text-sm text-ink/60">{u.description}</p>}
                    <p className="mt-2 text-xs text-ink/50">{s?.review_count ?? 0} opinii</p>
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="h2">❓ Pytania</h2>
              <Link href={`/pytania?city=${city.id}`} className="text-sm font-semibold text-honey-700 hover:underline">
                Wszystkie →
              </Link>
            </div>
            {questions?.length ? (
              <div className="card divide-y divide-ink/5 p-0">
                {questions.map((q) => (
                  <Link key={q.id} href={`/pytania/${q.id}`} className="block px-4 py-3 hover:bg-honey-50">
                    <p className="font-medium">{q.title}</p>
                    <p className="text-xs text-ink/50">
                      {(q.answers as { count: number }[])?.[0]?.count ?? 0} odp. · {formatRelative(q.created_at)}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty action={{ href: `/pytania/nowe?city=${city.id}`, label: "Zadaj pierwsze pytanie" }}>Nikt jeszcze nie zadał tu pytania.</Empty>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="h2">👥 Kto tu jedzie lub był</h2>
              <Link href={`/ludzie?city=${city.slug}`} className="text-sm font-semibold text-honey-700 hover:underline">
                Wszyscy →
              </Link>
            </div>
            {people?.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {(people as unknown as PersonRow[]).map((p) => (
                  <PersonCard key={p.id} person={p} />
                ))}
              </div>
            ) : (
              <Empty action={{ href: "/profil/edytuj", label: "Dodaj swoją trasę" }}>Jeszcze nikt tu nie jedzie. Będziesz pierwszy/a?</Empty>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <div className="card">
            <h2 className="font-bold">💶 Koszty (orientacyjnie)</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink/70">Pokój</dt>
                <dd className="font-semibold">~{city.avg_rent} €/mies.</dd>
              </div>
              {cityStats?.avg_rent_paid && (
                <div className="flex justify-between">
                  <dt className="text-ink/70">Pokój wg opinii</dt>
                  <dd className="font-semibold">~{cityStats.avg_rent_paid} €/mies.</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink/70">Całość z pokojem</dt>
                <dd className="font-semibold">~{city.avg_monthly_cost} €/mies.</dd>
              </div>
            </dl>
          </div>

          {tips.length > 0 && (
            <div className="card bg-honey-100">
              <h2 className="font-bold">💡 Warto wiedzieć</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {tips.map((t: string) => (
                  <li key={t} className="flex gap-2">
                    <span>🐝</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">🏠 Mieszkania</h2>
              <Link href={`/mieszkania?city=${city.id}`} className="text-sm font-semibold text-honey-700 hover:underline">
                Wszystkie →
              </Link>
            </div>
            {listings?.length ? (
              <ul className="mt-3 space-y-2">
                {listings.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2 text-sm">
                    <Link href={`/mieszkania?city=${city.id}#l${l.id}`} className="truncate hover:underline">
                      {l.title}
                    </Link>
                    {l.price && <span className="shrink-0 font-semibold">{l.price} €</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink/60">Brak ogłoszeń.</p>
            )}
            <Link href={`/mieszkania/nowe?city=${city.id}`} className="btn-ghost mt-4 w-full">
              + Dodaj ogłoszenie
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
