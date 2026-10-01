import { randomBytes } from "node:crypto";
import type { Browser, BrowserContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
export const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
export const DOMAIN = "pw.beexchange.local";

export type Bot = { id: string; name: string; db: SupabaseClient; cookies: { name: string; value: string }[] };

export async function makeBot(key: string, name: string): Promise<Bot> {
  const email = `${key}@${DOMAIN}`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  const db = createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  await db.auth.signInWithPassword({ email, password });
  // ciasteczka sesji dokładnie takie, jakie ustawia aplikacja w przeglądarce
  const jar = new Map<string, string>();
  const ssr = createServerClient(URL_, PUB, {
    cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (list) => list.forEach(({ name: n, value }) => jar.set(n, value)) },
  });
  await ssr.auth.signInWithPassword({ email, password });
  return { id: data.user.id, name, db, cookies: [...jar].map(([n, value]) => ({ name: n, value })) };
}

export async function contextFor(browser: Browser, bot: Bot, baseURL: string): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "pl-PL", timezoneId: "Europe/Warsaw" });
  await ctx.addCookies(bot.cookies.map((c) => ({ ...c, domain: "localhost", path: "/", sameSite: "Lax" as const })));
  return ctx;
}

export async function inst(name: string) {
  const { data } = await admin.from("institutions").select("id").eq("name", name).single();
  return data!.id as number;
}

// Profil ustawiony bezpośrednio w bazie (dla osób, które nie przechodzą onboardingu w teście)
export async function setProfile(bot: Bot, p: { home: number; ex: number; semester: string; status: "going" | "been"; buddy?: boolean; open?: boolean }) {
  await admin
    .from("profiles")
    .update({
      onboarded: true,
      status: p.status,
      home_institution_id: p.home,
      exchange_institution_id: p.ex,
      semester: p.semester,
      field_of_study: "Finanse",
      study_year: "bachelor:3",
      wants_buddy: !!p.buddy,
      open_to_questions: p.open ?? true,
      passions: ["coffee", "travel"],
      languages: ["pl:native", "en:C1"],
    })
    .eq("id", bot.id);
  await admin.from("profile_homes").insert({ user_id: bot.id, institution_id: p.home, field_of_study: "Finanse", study: "bachelor:3", position: 0 });
  await admin.from("exchanges").insert({ user_id: bot.id, institution_id: p.ex, semester: p.semester, status: p.status });
}

export async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 500 });
  const bots = data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
  for (const b of bots) {
    for (const bucket of ["avatars", "events"]) {
      const { data: files } = await admin.storage.from(bucket).list(b.id);
      if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${b.id}/${f.name}`));
    }
    await admin.auth.admin.deleteUser(b.id);
  }
  const { data: groups } = await admin.from("groups").select("id, group_members(count)");
  const empty = (groups ?? []).filter((g) => !(g.group_members as { count: number }[])?.[0]?.count).map((g) => g.id);
  if (empty.length) await admin.from("groups").delete().in("id", empty);
  return bots.length;
}
