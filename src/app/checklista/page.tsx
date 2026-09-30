import type { Metadata } from "next";
import Link from "next/link";
import { toggleChecklistItem } from "@/app/actions";
import { getCurrentUser } from "@/lib/auth";
import { CHECKLIST } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Checklista Erasmusa",
  description: "Wszystkie formalności przed, w trakcie i po Erasmusie: Learning Agreement, OLA, EKUZ, Transcript of Records.",
};

export default async function ChecklistPage() {
  const { supabase, userId } = await getCurrentUser();
  const { data: progress } = userId
    ? await supabase.from("checklist_progress").select("item_key").eq("user_id", userId)
    : { data: [] as { item_key: string }[] };
  const done = new Set((progress ?? []).map((p) => p.item_key));

  const total = CHECKLIST.reduce((n, phase) => n + phase.items.length, 0);
  const pct = Math.round((done.size / total) * 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="h1">Checklista Erasmusa ✅</h1>
      <p className="mt-2 text-ink/70">Wszystkie formalności w jednym miejscu. Odhaczaj kolejne kroki, a zapiszemy Twój postęp.</p>

      {userId ? (
        <div className="card mt-6">
          <div className="flex justify-between text-sm font-semibold">
            <span>Twój postęp</span>
            <span>
              {done.size}/{total}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-honey-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-honey-100 p-3 text-sm">
          <Link href="/login?next=/checklista" className="font-semibold underline">
            Zaloguj się
          </Link>
          , żeby zapisywać postęp.
        </p>
      )}

      <div className="mt-8 space-y-8">
        {CHECKLIST.map((phase) => (
          <section key={phase.phase}>
            <h2 className="h2 mb-3">{phase.phase}</h2>
            <div className="space-y-2">
              {phase.items.map((item) => {
                const isDone = done.has(item.key);
                return (
                  <form key={item.key} action={toggleChecklistItem} className={`card flex items-start gap-3 p-4 ${isDone ? "opacity-60" : ""}`}>
                    <input type="hidden" name="key" value={item.key} />
                    <input type="hidden" name="done" value={isDone ? "1" : "0"} />
                    <button
                      disabled={!userId}
                      aria-label={isDone ? "Odznacz" : "Oznacz jako zrobione"}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${
                        isDone ? "border-honey-500 bg-honey-400" : "border-ink/20 bg-white hover:border-honey-500"
                      }`}
                    >
                      {isDone && "✓"}
                    </button>
                    <div>
                      <p className={`font-semibold ${isDone ? "line-through" : ""}`}>{item.title}</p>
                      <p className="text-xs font-medium text-honey-700">{item.when}</p>
                      {item.details && <p className="mt-1 text-sm text-ink/70">{item.details}</p>}
                    </div>
                  </form>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="mt-8 text-xs text-ink/50">Terminy i wymagania różnią się między uczelniami. Zawsze sprawdzaj w swoim biurze Erasmusa.</p>
    </div>
  );
}
