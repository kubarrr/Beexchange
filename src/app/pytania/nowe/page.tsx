import type { Metadata } from "next";
import { createQuestion } from "@/app/actions";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Zadaj pytanie" };

export default async function NewQuestionPage({ searchParams }: PageProps<"/pytania/nowe">) {
  const sp = await searchParams;
  const { supabase } = await requireUser("/pytania/nowe");
  const [{ data: cities }, { data: unis }] = await Promise.all([
    supabase.from("cities").select("id, name, country_flag").order("name"),
    supabase.from("universities").select("id, city_id, name").order("name"),
  ]);

  const defaultTarget =
    typeof sp.university === "string" ? `u:${sp.university}` : typeof sp.city === "string" ? `c:${sp.city}` : "";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="h1">Zadaj pytanie 🐝</h1>
      <p className="mt-2 text-ink/70">Odpowiedzą osoby, które były lub są na miejscu. Pytanie zostaje publicznie, więc pomoże też następnym.</p>

      <form action={createQuestion} className="card mt-6 space-y-4">
        <label className="block">
          <span className="label">Czego dotyczy?</span>
          <select name="target" required defaultValue={defaultTarget} className="input">
            <option value="" disabled>
              Wybierz miasto lub uczelnię
            </option>
            {cities?.map((c) => (
              <optgroup key={c.id} label={`${c.country_flag} ${c.name}`}>
                <option value={`c:${c.id}`}>{c.name} (ogólnie o mieście)</option>
                {unis
                  ?.filter((u) => u.city_id === c.id)
                  .map((u) => (
                    <option key={u.id} value={`u:${u.id}`}>
                      {u.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Pytanie</span>
          <input name="title" required maxLength={200} placeholder="np. Jak wygląda sesja na Polimi? Da się zdać bez włoskiego?" className="input" />
        </label>
        <label className="block">
          <span className="label">Szczegóły (opcjonalnie)</span>
          <textarea name="body" rows={5} placeholder="Kierunek, semestr, co już wiesz…" className="input" />
        </label>
        <button className="btn">Opublikuj pytanie</button>
      </form>
    </div>
  );
}
