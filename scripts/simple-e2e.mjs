// Testy wersji prostej: uprawnienia (RLS), wyszukiwanie, licznik dla niezalogowanych i strony.
// Wymaga migracji 0012_simple.sql i działającej aplikacji (npm run dev). Uruchom: npm run test:e2e
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const APP = process.env.TEST_APP_URL ?? "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(URL_, PUB, { auth: { persistSession: false } });
const DOMAIN = "simple-test.beexchange.local";

let ok = 0;
let bad = 0;
const check = (name, cond, info = "") => {
  if (cond) ok++;
  else bad++;
  console.log(`  ${cond ? "✅" : "❌"} ${name}${!cond && info ? `  →  ${info}` : ""}`);
};
const section = (s) => console.log(`\n${s}`);

async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`))) await admin.auth.admin.deleteUser(u.id);
}
async function bot(key, name) {
  const email = `${key}@${DOMAIN}`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  const db = createClient(URL_, PUB, { auth: { persistSession: false } });
  await db.auth.signInWithPassword({ email, password });
  const jar = new Map();
  const ssr = createServerClient(URL_, PUB, { cookies: { getAll: () => [...jar].map(([n, v]) => ({ name: n, value: v })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.signInWithPassword({ email, password });
  return { id: data.user.id, name, db, cookie: [...jar].map(([n, v]) => `${n}=${v}`).join("; ") };
}
const inst = async (name) => (await admin.from("institutions").select("id").eq("name", name).limit(1).single()).data.id;

await cleanup();
const [PW, POLIMI, BOC, SGH] = await Promise.all([inst("Warsaw University of Technology"), inst("Politecnico di Milano"), inst("Bocconi University"), inst("SGH Warsaw School of Economics")]);
const zosia = await bot("zosia", "Bot Zosia");
const giulia = await bot("giulia", "Bot Giulia");
const ola = await bot("ola", "Bot Ola");

section("Zapis własnego wpisu");
{
  const p = await zosia.db.from("simple_people").insert({ user_id: zosia.id, display_name: "Bot Zosia", home_institution_id: PW, instagram: "bot.zosia" });
  check("Zosia zapisuje swój wpis", !p.error, p.error?.message);
  const e = await zosia.db.from("simple_entries").insert({ user_id: zosia.id, kind: "going", institution_id: POLIMI, semester: "2027S" });
  check("…i wpis „jadę na PoliMi, lato 2026/27”", !e.error, e.error?.message);
  const fake = await zosia.db.from("simple_people").insert({ user_id: giulia.id, display_name: "Podszywka" });
  check("Nie da się założyć wpisu za kogoś innego", !!fake.error);
  await giulia.db.from("simple_people").insert({ user_id: giulia.id, display_name: "Bot Giulia", home_institution_id: POLIMI, whatsapp: "+393331234567" });
  await giulia.db.from("simple_entries").insert({ user_id: giulia.id, kind: "helper", institution_id: POLIMI });
  await ola.db.from("simple_people").insert({ user_id: ola.id, display_name: "Bot Ola", home_institution_id: PW, facebook: "https://facebook.com/bot.ola" });
  await ola.db.from("simple_entries").insert([
    { user_id: ola.id, kind: "been", institution_id: POLIMI, semester: "2026W" },
    { user_id: ola.id, kind: "helper", institution_id: PW },
  ]);
  const hack = await zosia.db.from("simple_people").update({ display_name: "Zmienione" }).eq("user_id", giulia.id).select("user_id");
  check("Nie da się zmienić cudzego wpisu", !hack.data?.length);
  const bogus = await zosia.db.from("simple_entries").insert({ user_id: zosia.id, kind: "party", institution_id: POLIMI });
  check("Baza odrzuca nieznany rodzaj wpisu", !!bogus.error);
  const badWa = await zosia.db.from("simple_people").update({ whatsapp: "zadzwoń do mnie" }).eq("user_id", zosia.id);
  check("Baza odrzuca numer WhatsApp, który nie jest numerem", !!badWa.error);
}

section("Wyszukiwanie (zalogowani)");
const names = (rows) => (rows ?? []).map((r) => r.display_name).filter((n) => n.startsWith("Bot ")).sort();
const search = (b, kind, cc, city, inst = null) => b.db.rpc("simple_search", { p_kind: kind, p_cc: cc, p_city: city, p_inst: inst });
{
  const going = await search(giulia, "going", "IT", "Milan");
  check("Jadą do Mediolanu → Zosia (z linkiem do Instagrama)", names(going.data).includes("Bot Zosia") && going.data.find((r) => r.display_name === "Bot Zosia")?.instagram === "bot.zosia", going.error?.message);
  check("Wielkość liter w mieście nie ma znaczenia („milan”)", names((await search(giulia, "going", "IT", "milan")).data).includes("Bot Zosia"));
  check("Jadą na Bocconi → nie Zosia (ona jedzie na PoliMi)", !names((await search(giulia, "going", "IT", "Milan", BOC)).data).includes("Bot Zosia"));
  check("Są lub byli w Mediolanie → Ola", names((await search(zosia, "been", "IT", "Milan")).data).includes("Bot Ola"));
  const helpers = await search(zosia, "helper", "IT", "Milan");
  check("Pomogą w Mediolanie → Giulia (z numerem WhatsApp)", names(helpers.data).includes("Bot Giulia") && helpers.data.find((r) => r.display_name === "Bot Giulia")?.whatsapp === "+393331234567");
  const waw = await search(zosia, "helper", "PL", "Warsaw");
  check("Pomogą w Warszawie → Ola (pomaga na PW) z uczelnią macierzystą", names(waw.data).includes("Bot Ola") && waw.data.find((r) => r.display_name === "Bot Ola")?.home_id === PW);
  check("Pomogą na SGH → nie Ola (ona pomaga na PW)", !names((await search(zosia, "helper", "PL", "Warsaw", SGH)).data).includes("Bot Ola"));
}

section("Niezalogowani widzą tylko liczbę");
{
  const { data: people } = await anon.from("simple_people").select("display_name, instagram");
  check("Bez logowania nie da się odczytać wpisów", !people?.length);
  const { data: entries } = await anon.from("simple_entries").select("id");
  check("…ani listy wymian", !entries?.length);
  const s = await anon.rpc("simple_search", { p_kind: "going", p_cc: "IT", p_city: "Milan", p_inst: null });
  check("…ani użyć wyszukiwarki z kontaktami", !!s.error || !s.data?.length, JSON.stringify(s.data)?.slice(0, 80));
  const c = await anon.rpc("simple_count", { p_kind: "going", p_cc: "IT", p_city: "Milan", p_inst: null });
  check("Licznik dla niezalogowanych działa (co najmniej Zosia)", !c.error && c.data >= 1, c.error?.message);
  const cities = await anon.rpc("cities_in_country", { p_cc: "IT" });
  check("Lista miast działa bez logowania", !cities.error && (cities.data ?? []).some((r) => r.city === "Milan"), cities.error?.message);
}

section("Strony");
async function page(path, expect = [], who = null, lang = "pl") {
  const res = await fetch(APP + path, { headers: { cookie: `${who ? `${who.cookie}; ` : ""}lang=${lang}` }, redirect: "manual" });
  const html = res.status === 200 ? await res.text() : "";
  const missing = expect.filter((x) => !html.includes(x));
  check(`${path}${who ? ` (${who.name})` : " (niezalogowany)"}`, res.status === 200 && !missing.length, res.status !== 200 ? `HTTP ${res.status} ${res.headers.get("location") ?? ""}` : `brak: ${missing.join(", ")}`);
  return html;
}
await page("/", ["Znajdź ludzi z wymiany", "Jadą", "Pomogą Ci"]);
{
  const html = await page("/?tab=going&cc=IT&city=Milan", ["Zaloguj się przez Google"]);
  check("Niezalogowany nie widzi imion ani kontaktów", !html.includes("Bot Zosia") && !html.includes("bot.zosia"));
}
await page("/?tab=going&cc=IT&city=Milan", ["Bot Zosia", "instagram.com/bot.zosia"], giulia);
{
  const html = await page("/?tab=helper&cc=PL&city=Warsaw", ["Bot Ola", "Studiuje na"], zosia);
  check("Przy „Pomogą Ci” widać uczelnię macierzystą", html.includes("Politechnika Warszawska"));
}
{
  const html = await page("/?tab=going&cc=IT&city=Milan", ["Bot Zosia"], giulia);
  check("Przy „Jadą” nie pokazujemy uczelni macierzystej", !html.includes("Studiuje na"));
}
await page("/me", ["Twój wpis", "Bot Zosia"], zosia);
await page("/?tab=going&cc=IT&city=Milan", ["Find exchange people", "Going"], giulia, "en");
{
  const res = await fetch(`${APP}/me`, { redirect: "manual" });
  check("„Mój wpis” bez logowania → logowanie", [302, 303, 307].includes(res.status) && (res.headers.get("location") ?? "").includes("/login"));
  const old = await fetch(`${APP}/swarm`, { redirect: "manual" });
  check("Stare adresy pełnej wersji przekierowują na wyszukiwarkę", [307, 308].includes(old.status) && (old.headers.get("location") ?? "").endsWith("/"));
}

section("Usunięcie konta");
{
  await admin.auth.admin.deleteUser(ola.id);
  const { data } = await admin.from("simple_entries").select("id").eq("user_id", ola.id);
  check("Po usunięciu konta znikają też wpisy i kontakty", !data?.length);
}

await cleanup();
console.log(`\n${bad ? "❌" : "✅"} Wynik: ${ok}/${ok + bad} testów zaliczonych`);
process.exit(bad ? 1 : 0);
