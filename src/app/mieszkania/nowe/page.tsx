import type { Metadata } from "next";
import { createListing } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nowe ogłoszenie" };

export default async function NewListingPage({ searchParams }: PageProps<"/mieszkania/nowe">) {
  const sp = await searchParams;
  const { supabase } = await requireUser("/mieszkania/nowe");
  const { data: cities } = await supabase.from("cities").select("id, name, country_flag").order("name");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="h1">Nowe ogłoszenie 🏠</h1>
      <p className="mt-2 text-ink/70">Masz wolny pokój, szukasz współlokatora albo zostawiasz mieszkanie po powrocie? Napisz tu.</p>

      <form action={createListing} className="card mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <label>
            <span className="label">Miasto</span>
            <select name="city_id" required defaultValue={typeof sp.city === "string" ? sp.city : ""} className="input">
              <option value="" disabled>
                Wybierz miasto
              </option>
              {cities?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.country_flag} {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Cena (€/mies.)</span>
            <input name="price" type="number" min="0" max="10000" placeholder="np. 650" className="input" />
          </label>
        </div>
        <label className="block">
          <span className="label">Tytuł</span>
          <input name="title" required maxLength={150} placeholder="np. Pokój w Città Studi od lutego, przejmę po mnie umowę" className="input" />
        </label>
        <label className="block">
          <span className="label">Opis</span>
          <textarea
            name="description"
            rows={6}
            placeholder="Dzielnica, od kiedy do kiedy, ile osób w mieszkaniu, co jest w cenie, kogo szukasz…"
            className="input"
          />
        </label>
        <button className="btn">Opublikuj ogłoszenie</button>
      </form>
    </div>
  );
}
