import type { SupabaseClient } from "@supabase/supabase-js";

// Nasłuch nowych wierszy na żywo. Najpierw przekazuje token sesji do Realtime — bez niego
// kanał łączy się jako anonim i RLS po cichu blokuje wiadomości. Unikalna nazwa kanału chroni
// przed zamknięciem nowego kanału przez stary (podwójne montowanie w trybie deweloperskim).
export function listenForInserts<T>(
  supabase: SupabaseClient,
  opts: { table: string; filter: string; onInsert: (row: T) => void; onReady: () => void },
) {
  let cancelled = false;
  let channel: ReturnType<SupabaseClient["channel"]> | null = null;
  void (async () => {
    const { data } = await supabase.auth.getSession();
    if (cancelled) return;
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    if (cancelled) return;
    channel = supabase
      .channel(`${opts.table}:${opts.filter}:${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: opts.table, filter: opts.filter }, (payload) => opts.onInsert(payload.new as T))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") opts.onReady();
      });
  })();
  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
