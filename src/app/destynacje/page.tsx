import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";

export const metadata: Metadata = {
  title: "Destynacje Erasmusa",
  description: "Miasta i uczelnie na Erasmusa: koszty życia, opinie polskich studentów, uznawane przedmioty.",
};

const SORTS = {
  popular: "Najpopularniejsze",
  rating: "Najlepiej oceniane",
  cheap: "Najtańsze",
  name: "Alfabetycznie",
} as const;

export default async function DestinationsPage({ searchParams }: PageProps<"/destynacje">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const country = typeof sp.country === "string" ? sp.country : "";
  const budget = typeof sp.budget === "string" ? parseInt(sp.budget, 10) : NaN;
  const sort = (typeof sp.sort === "string" && sp.sort in SORTS ? sp.sort : "popular") as keyof typeof SORTS;

  const supabase = await createClient();
  const [{ data: cities }, { data: stats }, { data: unis }] = await Promise.all([
    supabase.from("cities").select("id, slug, name, country, country_flag, description, avg_rent, avg_monthly_cost"),
    supabase.from("city_stats").select("city_id, review_count, avg_overall, avg_rent_paid, people_count"),
    supabase.from("universities").select("id, city_id, name, short_name"),
  ]);

  const countries = [...new Set((cities ?? []).map((c) => c.country))].sort();
  const needle = q.toLowerCase();

  const rows = (cities ?? [])
    .map((c) => {
      const s = stats?.find((st) => st.city_id === c.id);
      const cityUnis = (unis ?? []).filter((u) => u.city_id === c.id);
      return { ...c, stats: s, unis: cityUnis };
    })
    .filter((c) => !country || c.country === country)
    .filter((c) => !Number.isFinite(budget) || (c.avg_monthly_cost ?? 0) <= budget)
    .filter(
      (c) =>
        !needle ||
        c.name.toLowerCase().includes(needle) ||
        c.country.toLowerCase().includes(needle) ||
        c.unis.some((u) => u.name.toLowerCase().includes(needle) || u.short_name?.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      if (sort === "rating") return (Number(b.stats?.avg_overall) || 0) - (Number(a.stats?.avg_overall) || 0);
      if (sort === "cheap") return (a.avg_monthly_cost ?? 9999) - (b.avg_monthly_cost ?? 9999);
      if (sort === "name") return a.name.localeCompare(b.name, "pl");
      return (b.stats?.people_count ?? 0) + (b.stats?.review_count ?? 0) - ((a.stats?.people_count ?? 0) + (a.stats?.review_count ?? 0));
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="h1">Destynacje</h1>
      <p className="mt-2 text-ink/70">Wybierz miasto, sprawdź uczelnie, koszty i opinie osób, które już tam były.</p>

      <form className="card mt-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <input name="q" defaultValue={q} placeholder="Szukaj miasta lub uczelni, np. Polimi" className="input" />
        <select name="country" defaultValue={country} className="input">
          <option value="">Wszystkie kraje</option>
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select name="budget" defaultValue={Number.isFinite(budget) ? String(budget) : ""} className="input">
          <option value="">Dowolny budżet</option>
          <option value="800">do 800 €/mies.</option>
          <option value="1000">do 1000 €/mies.</option>
          <option value="1200">do 1200 €/mies.</option>
        </select>
        <select name="sort" defaultValue={sort} className="input">
          {Object.entries(SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <button className="btn">Filtruj</button>
      </form>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {rows.map((c) => (
          <Link key={c.id} href={`/destynacje/${c.slug}`} className="card group transition hover:border-honey-500">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold group-hover:text-honey-700">
                  {c.country_flag} {c.name}
                </h2>
                <p className="text-sm text-ink/60">{c.country}</p>
              </div>
              {c.stats?.avg_overall && (
                <span className="rounded-xl bg-honey-400 px-2.5 py-1 text-sm font-bold">★ {Number(c.stats.avg_overall).toFixed(1)}</span>
              )}
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-ink/70">{c.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="chip">💶 ~{c.avg_monthly_cost} €/mies.</span>
              <span className="chip">🏠 pokój ~{c.stats?.avg_rent_paid ?? c.avg_rent} €</span>
              <span className="chip">🎓 {c.unis.length} uczelni</span>
              <span className="chip">👥 {c.stats?.people_count ?? 0} osób</span>
              <span className="chip">💬 {c.stats?.review_count ?? 0} opinii</span>
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 && (
        <div className="mt-6">
          <Empty>Nie znaleźliśmy takiej destynacji. Spróbuj zmienić filtry.</Empty>
        </div>
      )}
    </div>
  );
}
