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
  // Domyślny język to angielski; testy sprawdzają polską wersję
  await ctx.addCookies([...bot.cookies, { name: "lang", value: "pl" }].map((c) => ({ ...c, domain: "localhost", path: "/", sameSite: "Lax" as const })));
  return ctx;
}

export async function inst(name: string) {
  const { data } = await admin.from("institutions").select("id").eq("name", name).single();
  return data!.id as number;
}

// Profil ustawiony bezpośrednio w bazie (dla osób, które nie przechodzą onboardingu w teście)
export async function cleanup() {
  // Konta testowe; ich profile i wymiany usuwają się razem z kontem
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const bots = data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
  for (const b of bots) await admin.auth.admin.deleteUser(b.id);
  return bots.length;
}
