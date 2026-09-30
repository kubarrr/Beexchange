import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createCourseMatch, createReview, deleteCourseMatch } from "@/app/actions";
import { Avatar, Empty, PERSON_SELECT, PersonCard, Rating, type PersonRow } from "@/components/ui";
import { ReportButton } from "@/components/ReportButton";
import { getCurrentUser } from "@/lib/auth";
import { RATING_LABELS, semesterOptions } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

async function getUniversity(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("universities").select("*, cities(id, slug, name, country_flag)").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/uczelnie/[slug]">): Promise<Metadata> {
  const uni = await getUniversity((await params).slug);
  if (!uni) return {};
  return {
    title: `${uni.name}: opinie, uznawane przedmioty, Erasmus`,
    description: `Erasmus na ${uni.name}: opinie polskich studentów, przedmioty uznane na polskich uczelniach, koszty i mieszkania.`,
  };
}

export default async function UniversityPage({ params, searchParams }: PageProps<"/uczelnie/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const home = typeof sp.home === "string" ? sp.home.trim() : "";

  const uni = await getUniversity(slug);
  if (!uni) notFound();
  const city = uni.cities as { id: number; slug: string; name: string; country_flag: string };

  const { supabase, userId } = await getCurrentUser();
  let coursesQuery = supabase
    .from("course_matches")
    .select("id, foreign_course, ects, home_university, home_course, field_of_study, note, author_id, created_at")
    .eq("university_id", uni.id)
    .order("created_at", { ascending: false });
  if (home) coursesQuery = coursesQuery.or(`home_university.ilike.%${home.replace(/[%,()]/g, "")}%,field_of_study.ilike.%${home.replace(/[%,()]/g, "")}%`);

  const [{ data: stats }, { data: reviews }, { data: courses }, { data: people }, { data: me }] = await Promise.all([
    supabase.from("university_stats").select("*").eq("university_id", uni.id).maybeSingle(),
    supabase
      .from("reviews")
      .select("*, profiles(id, full_name, avatar_url, home_university)")
      .eq("university_id", uni.id)
      .order("created_at", { ascending: false }),
    coursesQuery,
    supabase.from("profiles").select(PERSON_SELECT).eq("destination_university_id", uni.id).order("open_to_questions", { ascending: false }).limit(4),
    userId ? supabase.from("profiles").select("home_university, field_of_study, semester").eq("id", userId).single() : Promise.resolve({ data: null }),
  ]);

  const myReview = reviews?.find((r) => r.author_id === userId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href={`/destynacje/${city.slug}`} className="text-sm text-ink/60 hover:text-ink">
        ← {city.country_flag} {city.name}
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">{uni.name}</h1>
          <p className="text-ink/60">
            {uni.short_name && `${uni.short_name} · `}
            {city.name}
            {uni.website && (
              <>
                {" · "}
                <a href={uni.website} target="_blank" rel="noopener noreferrer" className="text-honey-700 hover:underline">
                  strona uczelni ↗
                </a>
              </>
            )}
          </p>
        </div>
        <Link href={`/pytania/nowe?city=${city.id}&university=${uni.id}`} className="btn-honey">
          Zadaj pytanie o {uni.short_name || "uczelnię"}
        </Link>
      </div>
      {uni.description && <p className="mt-4 max-w-3xl text-ink/80">{uni.description}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-10">
          {/* OPINIE */}
          <section id="opinie">
            <h2 className="h2 mb-3">💬 Opinie ({stats?.review_count ?? 0})</h2>
            <div className="card mb-4 space-y-2">
              {(Object.keys(RATING_LABELS) as (keyof typeof RATING_LABELS)[]).map((k) => (
                <Rating key={k} label={RATING_LABELS[k]} value={stats?.[k.replace("rating_", "avg_")]} />
              ))}
              {stats?.avg_rent_paid && <p className="pt-2 text-sm text-ink/70">🏠 Średni czynsz wg opinii: <b>{stats.avg_rent_paid} €/mies.</b></p>}
            </div>

            <div className="space-y-3">
              {reviews?.map((r) => (
                <article key={r.id} className="card">
                  <div className="flex items-center gap-3">
                    <Avatar name={r.profiles?.full_name ?? ""} url={r.profiles?.avatar_url} size={36} />
                    <div className="flex-1">
                      <Link href={`/profil/${r.profiles?.id}`} className="font-semibold hover:underline">
                        {r.profiles?.full_name}
                      </Link>
                      <p className="text-xs text-ink/50">
                        {r.profiles?.home_university} {r.semester && `· ${r.semester}`}
                      </p>
                    </div>
                    <span className="rounded-lg bg-honey-400 px-2 py-0.5 text-sm font-bold">
                      ★ {((r.rating_university + r.rating_city + r.rating_social + r.rating_housing + r.rating_exams) / 5).toFixed(1)}
                    </span>
                  </div>
                  {r.body && <p className="mt-3 whitespace-pre-line text-sm">{r.body}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    {r.rent_paid && <span className="chip">🏠 {r.rent_paid} €/mies.</span>}
                    {r.neighborhood && <span className="chip">📍 {r.neighborhood}</span>}
                    <span className="text-ink/40">{formatDate(r.created_at)}</span>
                    <span className="ml-auto">
                      <ReportButton type="review" id={r.id} />
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <details className="card mt-4" open={!reviews?.length && !!userId}>
              <summary className="cursor-pointer font-semibold">{myReview ? "✏️ Edytuj swoją opinię" : "✍️ Byłeś/aś tu? Dodaj opinię"}</summary>
              {userId ? (
                <form action={createReview} className="mt-4 space-y-4">
                  <input type="hidden" name="university_id" value={uni.id} />
                  <input type="hidden" name="slug" value={uni.slug} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(Object.keys(RATING_LABELS) as (keyof typeof RATING_LABELS)[]).map((k) => (
                      <label key={k}>
                        <span className="label">{RATING_LABELS[k]}</span>
                        <select name={k} required defaultValue={myReview?.[k] ?? ""} className="input">
                          <option value="" disabled>
                            Oceń 1–5
                          </option>
                          {[5, 4, 3, 2, 1].map((n) => (
                            <option key={n} value={n}>
                              {"★".repeat(n)} ({n})
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                    <label>
                      <span className="label">Semestr</span>
                      <select name="semester" defaultValue={myReview?.semester ?? me?.semester ?? ""} className="input">
                        <option value="">—</option>
                        {semesterOptions().map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="label">Ile płaciłeś/aś za pokój? (€/mies.)</span>
                      <input name="rent_paid" type="number" min="0" max="5000" defaultValue={myReview?.rent_paid ?? ""} className="input" />
                    </label>
                    <label>
                      <span className="label">Dzielnica</span>
                      <input name="neighborhood" defaultValue={myReview?.neighborhood ?? ""} placeholder="np. Città Studi" className="input" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="label">Twoja opinia</span>
                    <textarea
                      name="body"
                      rows={5}
                      defaultValue={myReview?.body ?? ""}
                      placeholder="Jak wyglądały zajęcia i egzaminy? Co warto wiedzieć przed przyjazdem? Czego żałujesz?"
                      className="input"
                    />
                  </label>
                  <button className="btn">Zapisz opinię</button>
                </form>
              ) : (
                <p className="mt-3 text-sm">
                  <Link href={`/login?next=/uczelnie/${uni.slug}`} className="font-semibold text-honey-700 underline">
                    Zaloguj się
                  </Link>
                  , żeby dodać opinię.
                </p>
              )}
            </details>
          </section>

          {/* PRZEDMIOTY */}
          <section id="przedmioty">
            <h2 className="h2">📚 Uznane przedmioty</h2>
            <p className="mb-3 mt-1 text-sm text-ink/60">Co realnie zaliczono Polakom na ich uczelniach. Najlepsza ściąga do Learning Agreement.</p>
            <form className="mb-3 flex gap-2">
              <input name="home" defaultValue={home} placeholder="Filtruj po swojej uczelni lub kierunku, np. PW, SGH, informatyka" className="input" />
              <button className="btn">Szukaj</button>
            </form>
            {courses?.length ? (
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-left text-sm">
                  <thead className="bg-honey-100 text-xs uppercase text-ink/60">
                    <tr>
                      <th className="px-4 py-2">Przedmiot tutaj</th>
                      <th className="px-4 py-2">ECTS</th>
                      <th className="px-4 py-2">Uznany jako</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {courses.map((c) => (
                      <tr key={c.id} className="align-top">
                        <td className="px-4 py-3 font-medium">
                          {c.foreign_course}
                          {c.note && <p className="mt-1 text-xs font-normal text-ink/60">{c.note}</p>}
                        </td>
                        <td className="px-4 py-3">{c.ects ?? "—"}</td>
                        <td className="px-4 py-3">
                          {c.home_course}
                          <p className="text-xs text-ink/60">
                            {c.home_university}
                            {c.field_of_study && ` · ${c.field_of_study}`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {c.author_id === userId ? (
                            <form action={deleteCourseMatch}>
                              <input type="hidden" name="id" value={c.id} />
                              <input type="hidden" name="slug" value={uni.slug} />
                              <button className="text-xs text-ink/40 hover:text-red-600">Usuń</button>
                            </form>
                          ) : (
                            <ReportButton type="course" id={c.id} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty>{home ? "Brak przedmiotów pasujących do filtra." : "Nikt jeszcze nie dodał uznanych przedmiotów. Bądź pierwszy/a!"}</Empty>
            )}

            <details className="card mt-4">
              <summary className="cursor-pointer font-semibold">➕ Dodaj uznany przedmiot</summary>
              {userId ? (
                <form action={createCourseMatch} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="university_id" value={uni.id} />
                  <input type="hidden" name="slug" value={uni.slug} />
                  <label className="sm:col-span-2">
                    <span className="label">Przedmiot na {uni.short_name || uni.name}</span>
                    <input name="foreign_course" required placeholder="np. Machine Learning" className="input" />
                  </label>
                  <label>
                    <span className="label">ECTS</span>
                    <input name="ects" inputMode="decimal" placeholder="np. 6" className="input" />
                  </label>
                  <label>
                    <span className="label">Twoja uczelnia</span>
                    <input name="home_university" required defaultValue={me?.home_university ?? ""} className="input" />
                  </label>
                  <label>
                    <span className="label">Uznany u Ciebie jako</span>
                    <input name="home_course" required placeholder="np. Uczenie maszynowe" className="input" />
                  </label>
                  <label>
                    <span className="label">Kierunek</span>
                    <input name="field_of_study" defaultValue={me?.field_of_study ?? ""} className="input" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="label">Uwagi (opcjonalnie)</span>
                    <input name="note" placeholder="np. trudny egzamin, ale świetny prowadzący" className="input" />
                  </label>
                  <div>
                    <button className="btn">Dodaj przedmiot</button>
                  </div>
                </form>
              ) : (
                <p className="mt-3 text-sm">
                  <Link href={`/login?next=/uczelnie/${uni.slug}`} className="font-semibold text-honey-700 underline">
                    Zaloguj się
                  </Link>
                  , żeby dodać przedmiot.
                </p>
              )}
            </details>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-bold">👥 Studenci tej uczelni</h2>
            <Link href={`/ludzie?university=${uni.id}`} className="text-sm font-semibold text-honey-700 hover:underline">
              Wszyscy →
            </Link>
          </div>
          {people?.length ? (
            (people as unknown as PersonRow[]).map((p) => <PersonCard key={p.id} person={p} />)
          ) : (
            <p className="text-sm text-ink/60">Nikt jeszcze nie dodał tej uczelni do profilu.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
