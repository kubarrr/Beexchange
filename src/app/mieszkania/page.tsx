import type { Metadata } from "next";
import Link from "next/link";
import { closeListing, startConversation } from "@/app/actions";
import { Avatar, Empty } from "@/components/ui";
import { ReportButton } from "@/components/ReportButton";
import { getCurrentUser } from "@/lib/auth";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = {
  title: "Mieszkania na Erasmusa",
  description: "Pokoje, współlokatorzy i mieszkania do przejęcia od osób wracających z Erasmusa.",
};

export default async function ListingsPage({ searchParams }: PageProps<"/mieszkania">) {
  const sp = await searchParams;
  const cityId = typeof sp.city === "string" ? parseInt(sp.city, 10) : NaN;
  const maxPrice = typeof sp.max === "string" ? parseInt(sp.max, 10) : NaN;

  const { supabase, userId } = await getCurrentUser();
  let query = supabase
    .from("listings")
    .select("id, title, price, description, created_at, author_id, cities(name, country_flag), profiles(id, full_name, avatar_url)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(100);
  if (Number.isFinite(cityId)) query = query.eq("city_id", cityId);
  if (Number.isFinite(maxPrice)) query = query.lte("price", maxPrice);

  const [{ data: listings }, { data: cities }] = await Promise.all([query, supabase.from("cities").select("id, name, country_flag").order("name")]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h1">Mieszkania</h1>
          <p className="mt-2 text-ink/70">Wolne pokoje, szukanie współlokatorów, mieszkania do przejęcia po powrocie.</p>
        </div>
        <Link href={`/mieszkania/nowe${Number.isFinite(cityId) ? `?city=${cityId}` : ""}`} className="btn-honey">
          + Dodaj ogłoszenie
        </Link>
      </div>

      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        ⚠️ <b>Uważaj na oszustów:</b> nigdy nie wpłacaj kaucji ani czynszu przed obejrzeniem mieszkania (choćby przez wideo) i podpisaniem umowy.
        Podejrzane ogłoszenie? Kliknij „Zgłoś”.
      </div>

      <form className="card mt-4 grid gap-3 p-4 sm:grid-cols-[2fr_1fr_auto]">
        <select name="city" defaultValue={Number.isFinite(cityId) ? String(cityId) : ""} className="input">
          <option value="">Wszystkie miasta</option>
          {cities?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.country_flag} {c.name}
            </option>
          ))}
        </select>
        <input name="max" type="number" min="0" defaultValue={Number.isFinite(maxPrice) ? maxPrice : ""} placeholder="Maks. cena €" className="input" />
        <button className="btn">Filtruj</button>
      </form>

      <div className="mt-6 space-y-3">
        {listings?.map((l) => {
          const city = l.cities as unknown as { name: string; country_flag: string };
          const author = l.profiles as unknown as { id: string; full_name: string; avatar_url: string | null };
          const mine = l.author_id === userId;
          return (
            <article key={l.id} id={`l${l.id}`} className="card scroll-mt-24">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">{l.title}</h2>
                  <p className="text-sm text-ink/60">
                    📍 {city.country_flag} {city.name} · {formatRelative(l.created_at)}
                  </p>
                </div>
                {l.price !== null && <span className="rounded-xl bg-honey-400 px-3 py-1 text-lg font-black">{l.price} €</span>}
              </div>
              {l.description && <p className="mt-3 whitespace-pre-line text-sm">{l.description}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/5 pt-3">
                <Link href={`/profil/${author.id}`} className="flex items-center gap-2 text-sm font-medium hover:underline">
                  <Avatar name={author.full_name} url={author.avatar_url} size={28} />
                  {author.full_name}
                </Link>
                <div className="ml-auto flex items-center gap-3">
                  {mine ? (
                    <form action={closeListing}>
                      <input type="hidden" name="id" value={l.id} />
                      <button className="btn-ghost !py-1.5 text-xs">Zakończ ogłoszenie</button>
                    </form>
                  ) : (
                    <>
                      <ReportButton type="listing" id={l.id} />
                      {userId ? (
                        <form action={startConversation}>
                          <input type="hidden" name="user_id" value={author.id} />
                          <button className="btn !py-1.5">💬 Napisz</button>
                        </form>
                      ) : (
                        <Link href="/login?next=/mieszkania" className="btn !py-1.5">
                          Zaloguj się, żeby napisać
                        </Link>
                      )}
                    </>
                  )}
                </div>
              </div>
            </article>
          );
        })}
        {!listings?.length && <Empty action={{ href: "/mieszkania/nowe", label: "Dodaj pierwsze ogłoszenie" }}>Brak ogłoszeń.</Empty>}
      </div>
    </div>
  );
}
