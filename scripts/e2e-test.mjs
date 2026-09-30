// Test całej aplikacji na prawdziwej bazie Supabase przy pomocy testowych użytkowników („botów”).
// Sprawdza logikę bazy (dopasowania, grupy, czat, buddy, wydarzenia, zabezpieczenia RLS)
// oraz czy strony aplikacji renderują się bez błędów (wymaga działającego `npm run dev`).
//
// Uruchom: npm run test:e2e            (sprząta po sobie)
//          npm run test:e2e -- --keep  (zostawia boty, żeby obejrzeć je w aplikacji)
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const APP = process.env.TEST_APP_URL ?? "http://localhost:3000";
const KEEP = process.argv.includes("--keep");
if (!URL_ || !PUB || !SECRET) throw new Error("Brak zmiennych Supabase w .env.local");

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
const DOMAIN = "test.beexchange.local";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "  ✅" : "  ❌"} ${name}${!ok && detail ? `  →  ${detail}` : ""}`);
};
const section = (t) => console.log(`\n▶ ${t}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- przygotowanie ----------
async function cleanup() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const bots = data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
  for (const b of bots) {
    const { data: files } = await admin.storage.from("avatars").list(b.id);
    if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${b.id}/${f.name}`));
    await admin.from("institutions").delete().eq("added_by", b.id).eq("status", "pending");
    await admin.auth.admin.deleteUser(b.id);
  }
  // grupy bez członków (po testach)
  const { data: groups } = await admin.from("groups").select("id, group_members(count)");
  const empty = (groups ?? []).filter((g) => !g.group_members?.[0]?.count).map((g) => g.id);
  if (empty.length) await admin.from("groups").delete().in("id", empty);
  return bots.length;
}

async function makeBot(key, fullName) {
  const email = `${key}@${DOMAIN}`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (error) throw new Error(`createUser ${key}: ${error.message}`);
  const client = createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`login ${key}: ${e2.message}`);

  // ciasteczka sesji dla testów stron (tak samo jak w przeglądarce)
  const jar = new Map();
  const ssr = createServerClient(URL_, PUB, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await ssr.auth.signInWithPassword({ email, password });
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  return { key, id: data.user.id, name: fullName, db: client, cookie };
}

async function inst(db, q, expectName) {
  const { data, error } = await db.rpc("search_institutions", { q, prefer_cc: "PL", lim: 5 });
  if (error) throw new Error(`search ${q}: ${error.message}`);
  const hit = data.find((i) => i.name === expectName);
  check(`Wyszukiwarka: „${q}” znajduje ${expectName}`, data[0]?.name === expectName, `pierwszy wynik: ${data[0]?.name ?? "brak"}`);
  return hit ?? data[0];
}

// ---------- testy ----------
// Wymaga migracji 0003 (tabele profile_homes i exchanges)
{
  const { error } = await admin.from("profile_homes").select("user_id").limit(1);
  if (error) {
    console.error("❌ Najpierw uruchom supabase/migrations/0003_multi_exchange.sql w Supabase → SQL Editor.");
    process.exit(1);
  }
}
const removedBefore = await cleanup();
if (removedBefore) console.log(`(usunięto ${removedBefore} botów z poprzedniego testu)`);

section("Konta testowe");
const bots = {};
for (const [k, n] of [
  ["zuza", "Bot Zuza"],
  ["adam", "Bot Adam"],
  ["kasia", "Bot Kasia"],
  ["ania", "Bot Ania"],
  ["michal", "Bot Michał"],
  ["obcy", "Bot Obcy"],
]) {
  bots[k] = await makeBot(k, n);
}
check("6 botów utworzonych i zalogowanych", Object.keys(bots).length === 6);
const { data: prof } = await bots.zuza.db.from("profiles").select("full_name").eq("id", bots.zuza.id).single();
check("Profil tworzy się automatycznie przy rejestracji", prof?.full_name === "Bot Zuza");

section("Wyszukiwarka uczelni");
const { zuza, adam, kasia, ania, michal, obcy } = bots;
const SGH = await inst(zuza.db, "sgh", "SGH Warsaw School of Economics");
const BOC = await inst(zuza.db, "bocconi", "Bocconi University");
const POLIMI = await inst(zuza.db, "polimi", "Politecnico di Milano");
const UW = await inst(zuza.db, "uw", "University of Warsaw");
const PW = await inst(zuza.db, "politechnika warszawska", "Warsaw University of Technology");
const UJ = await inst(zuza.db, "uniwersytet jagiellonski", "Jagiellonian University");
{
  const { data } = await zuza.db.rpc("search_institutions", { q: "Kraków", prefer_cc: "PL", lim: 8 });
  check("Wyszukiwarka: polskie znaki („Kraków”) działają", data.some((i) => i.city === "Krakow"), `${data.length} wyników`);
}

section("Profile (wiele uczelni i wymian)");
async function setProfile(b, { homes, exchanges, ...p }) {
  const main = exchanges.find((x) => x.status === "going") ?? exchanges[0];
  const status = exchanges.some((x) => x.status === "going") ? "going" : exchanges.length ? "been" : "searching";
  const up = await b.db
    .from("profiles")
    .update({
      onboarded: true,
      open_to_questions: true,
      status,
      home_institution_id: homes[0].institution_id,
      field_of_study: homes[0].field_of_study,
      study_year: homes[0].study,
      exchange_institution_id: main?.institution_id ?? null,
      semester: main?.semester ?? null,
      languages: ["pl:native", "en:C1"],
      ...p,
    })
    .eq("id", b.id)
    .select("id");
  const h = await b.db.from("profile_homes").insert(homes.map((x, position) => ({ user_id: b.id, position, ...x })));
  const e = exchanges.length ? await b.db.from("exchanges").insert(exchanges.map((x) => ({ user_id: b.id, ...x }))) : { error: null };
  const error = up.error ?? h.error ?? e.error;
  check(`${b.name}: zapis profilu (${homes.length} uczelnie, ${exchanges.length} wymiany)`, !error && up.data?.length === 1, error?.message);
}
const LIS = await inst(zuza.db, "university of lisbon", "University of Lisbon");
const home = (i, study = "bachelor:3") => ({ institution_id: i.id, field_of_study: "Finanse", study });
await setProfile(zuza, { homes: [home(SGH)], exchanges: [{ institution_id: BOC.id, semester: "2026W", status: "going" }], passions: ["travel", "coffee", "volleyball"] });
await setProfile(adam, { homes: [home(SGH)], exchanges: [{ institution_id: BOC.id, semester: "2026W", status: "going" }], passions: ["gym", "travel"] });
await setProfile(kasia, {
  homes: [home(SGH, "master:1"), home(UW, "bachelor:3")],
  exchanges: [
    { institution_id: BOC.id, semester: "2025W", status: "been" },
    { institution_id: LIS.id, semester: "2027S", status: "going" },
  ],
  passions: ["coffee", "mountains"],
  wants_buddy: true,
});
await setProfile(ania, { homes: [home(UW)], exchanges: [{ institution_id: BOC.id, semester: "2026W", status: "going" }], passions: ["art"] });
await setProfile(michal, { homes: [home(PW, "engineer:4")], exchanges: [{ institution_id: POLIMI.id, semester: "2026W", status: "going" }], passions: ["gaming"] });
await setProfile(obcy, { homes: [home(UJ)], exchanges: [], open_to_questions: false });
{
  const { data } = await obcy.db.from("profiles").update({ full_name: "HACK" }).eq("id", zuza.id).select("id");
  check("Bezpieczeństwo: nie da się edytować cudzego profilu", (data ?? []).length === 0);
  const { error } = await obcy.db.from("exchanges").insert({ user_id: zuza.id, institution_id: BOC.id, semester: "2027S", status: "going" });
  check("Bezpieczeństwo: nie da się dopisać wymiany komuś innemu", !!error);
}

section("Dopasowania (Rój)");
const botIds = new Set(Object.values(bots).map((b) => b.id));
const { data: allEx } = await admin.from("exchanges").select("user_id, institution_id, semester, status, institutions(city, country_code)");
const { data: allHomes } = await admin.from("profile_homes").select("user_id, institution_id");
const homeOf = (u, instId) => allHomes.some((h) => h.user_id === u && h.institution_id === instId);
const outside = (pred) => new Set(allEx.filter((x) => !botIds.has(x.user_id) && pred(x)).map((x) => x.user_id)).size;
const extra = {
  route: outside((x) => x.institution_id === BOC.id && x.semester === "2026W" && homeOf(x.user_id, SGH.id)),
  semester: outside((x) => x.institution_id === BOC.id && x.semester === "2026W"),
  alumni: outside((x) => x.institution_id === BOC.id && x.status === "been" && homeOf(x.user_id, SGH.id)),
  city: outside((x) => x.institutions?.country_code === "IT" && x.institutions?.city?.toLowerCase() === "milan" && x.semester === "2026W"),
  country: outside((x) => x.institutions?.country_code === "IT" && x.semester === "2026W"),
};
const also = (k) => (extra[k] ? ` (+${extra[k]} spoza testu)` : "");
const { data: sugg, error: suggErr } = await zuza.db.rpc("group_suggestions");
const byKind = Object.fromEntries((sugg ?? []).map((s) => [s.kind, s]));
check("group_suggestions działa (5 rodzajów grup)", !suggErr && sugg?.length === 5, suggErr?.message ?? `${sugg?.length} propozycji`);
check(`Trasa SGH → Bocconi · zima 26/27: 2 osoby (Zuza, Adam)${also("route")}`, byKind.route?.candidates === 2 + extra.route, `jest ${byKind.route?.candidates}`);
check(`Semestr Bocconi · zima 26/27: 3 osoby (+ Ania z UW)${also("semester")}`, byKind.semester?.candidates === 3 + extra.semester, `jest ${byKind.semester?.candidates}`);
check(`Absolwenci Bocconi z SGH: 1 osoba (Kasia)${also("alumni")}`, byKind.alumni?.candidates === 1 + extra.alumni, `jest ${byKind.alumni?.candidates}`);
check(`Miasto Mediolan · zima 26/27: 4 osoby (+ Michał z Polimi)${also("city")}`, byKind.city?.candidates === 4 + extra.city, `jest ${byKind.city?.candidates}`);
check(`Kraj Włochy · zima 26/27: 4 osoby${also("country")}`, byKind.country?.candidates === 4 + extra.country, `jest ${byKind.country?.candidates}`);
{
  const { data } = await kasia.db.rpc("group_suggestions");
  const exIds = new Set((data ?? []).map((s) => s.exchange_id));
  check("Kasia (2 wymiany, 2 uczelnie): propozycje dla obu wymian", exIds.size === 2, `${exIds.size} wymian`);
  check("Kasia: grupy trasy dla obu uczelni macierzystych", (data ?? []).filter((s) => s.kind === "route").length === 4);
  const { data: none } = await obcy.db.rpc("group_suggestions");
  check("Osoba bez wymiany nie dostaje propozycji grup", (none ?? []).length === 0);
}

section("Wyszukiwarka ludzi i filtry");
const people = async (b, params) => ((await b.db.rpc("search_people", params)).data ?? []).map((p) => p.full_name).filter((n) => n.startsWith("Bot ")).sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
{
  const r = await people(obcy, { p_city: "Milan" });
  check("Miasto: Milan → 5 osób", r.length === 5, r.join(", "));
}
check("Kraj: Portugalia → Kasia (jej druga wymiana)", same(await people(zuza, { p_cc: "PT" }), ["Bot Kasia"]));
check("Byli (absolwenci) → Kasia", same(await people(zuza, { p_seg: "been" }), ["Bot Kasia"]));
check("Tylko z mojej uczelni (SGH) → Adam, Kasia", same(await people(zuza, { p_home_only: true }), ["Bot Adam", "Bot Kasia"]));
check("Tylko z mojej uczelni działa dla drugiej uczelni Kasi (UW)", (await people(ania, { p_home_only: true })).includes("Bot Kasia"));
check("Pasja: kawa → Kasia", same(await people(zuza, { p_passion: "coffee" }), ["Bot Kasia"]));
check("Bocconi + zima 26/27 → Adam, Ania", same(await people(zuza, { p_inst: BOC.id, p_sem: "2026W" }), ["Bot Adam", "Bot Ania"]));
check("Chcą być buddy → Kasia", same(await people(zuza, { p_buddy: true }), ["Bot Kasia"]));

section("Grupy i czat grupowy");
const { data: gid, error: jErr } = await zuza.db.rpc("join_group", { p_kind: "route", p_exchange_id: byKind.route.exchange_id, p_home_id: byKind.route.home_id });
check("Zuza dołącza do grupy trasy (grupa się tworzy)", !jErr && gid, jErr?.message);
const adamRoute = ((await adam.db.rpc("group_suggestions")).data ?? []).find((s) => s.kind === "route");
const { data: gid2 } = await adam.db.rpc("join_group", { p_kind: "route", p_exchange_id: adamRoute.exchange_id, p_home_id: adamRoute.home_id });
check("Adam trafia do tej samej grupy", gid2 === gid, `${gid2} ≠ ${gid}`);
{
  const { error } = await obcy.db.rpc("join_group", { p_kind: "route", p_exchange_id: byKind.route.exchange_id, p_home_id: byKind.route.home_id });
  check("Nie da się dołączyć cudzą wymianą (podszywanie)", !!error);
  const aniaKeys = ((await ania.db.rpc("group_suggestions")).data ?? []).map((s) => s.key);
  const { data: g } = await admin.from("groups").select("key").eq("id", gid).single();
  check("Ania (UW) nie dostaje grupy trasy SGH", !aniaKeys.includes(g.key));
}
// czat na żywo: Adam słucha, Zuza pisze
let realtimeGot = null;
const channel = adam.db
  .channel(`test-group-${gid}`)
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${gid}` }, (p) => (realtimeGot = p.new.body))
  .subscribe();
await adam.db.realtime.setAuth((await adam.db.auth.getSession()).data.session.access_token);
await sleep(2500);
{
  const { error } = await zuza.db.from("group_messages").insert({ group_id: gid, sender_id: zuza.id, body: "Hej, szukamy razem mieszkania?" });
  check("Członek grupy wysyła wiadomość", !error, error?.message);
}
for (let i = 0; i < 20 && !realtimeGot; i++) await sleep(250);
check("Czat na żywo: druga osoba dostaje wiadomość natychmiast", realtimeGot === "Hej, szukamy razem mieszkania?", realtimeGot ?? "brak w 5 s");
await adam.db.removeChannel(channel);
{
  const { data } = await adam.db.from("group_messages").select("body").eq("group_id", gid);
  check("Członek widzi historię czatu", data?.length === 1);
  const { data: spy } = await obcy.db.from("group_messages").select("body").eq("group_id", gid);
  check("Bezpieczeństwo: obcy nie czyta czatu grupy", (spy ?? []).length === 0);
  const { error } = await obcy.db.from("group_messages").insert({ group_id: gid, sender_id: obcy.id, body: "spam" });
  check("Bezpieczeństwo: obcy nie pisze do grupy", !!error);
  const { error: e2 } = await zuza.db.from("group_messages").insert({ group_id: gid, sender_id: adam.id, body: "podszywam się" });
  check("Bezpieczeństwo: nie da się pisać jako ktoś inny", !!e2);
}
{
  const mSugg = ((await michal.db.rpc("group_suggestions")).data ?? []).find((s) => s.kind === "country");
  const { data: cg, error } = await michal.db.rpc("join_group", { p_kind: "country", p_exchange_id: mSugg.exchange_id });
  check("Grupa krajowa (Włochy · zima 26/27) tworzy się", !error && cg, error?.message);
  const zCountry = ((await zuza.db.rpc("group_suggestions")).data ?? []).find((s) => s.kind === "country");
  check("Zuza (Bocconi) widzi tę samą grupę krajową co Michał (Polimi)", zCountry?.group_id === cg && zCountry?.members === 1);
}
{
  const { data } = await zuza.db.rpc("group_suggestions");
  const route = data.find((s) => s.kind === "route");
  check("Po dołączeniu: grupa trasy ma 2 członków, Zuza jest członkiem", route?.members === 2 && route?.is_member);
}

section("Odkrywanie grup, goście, zakładanie grup");
{
  const { data: found, error } = await obcy.db.rpc("discover_groups", { p_cc: "IT" });
  check("Osoba bez wymiany widzi grupy we Włoszech", !error && found?.some((g) => g.id === gid), error?.message);
  const r = found?.find((g) => g.id === gid);
  check("Lista pokazuje liczbę członków i ostatnią aktywność (także dla nie-członków)", r?.members === 2 && !!r?.last_message_at);
  const { error: jErr2 } = await obcy.db.rpc("join_group_by_id", { p_group_id: gid });
  check("Obcy dołącza do grupy jako gość", !jErr2, jErr2?.message);
  const { data: m } = await admin.from("group_members").select("is_guest").eq("group_id", gid).eq("user_id", obcy.id).single();
  check("…i jest oznaczony jako gość", m?.is_guest === true);
  const { data: msgs } = await obcy.db.from("group_messages").select("body").eq("group_id", gid);
  check("Gość widzi rozmowę po dołączeniu", msgs?.length >= 1);
  await obcy.db.from("group_members").delete().eq("group_id", gid).eq("user_id", obcy.id);

  const { data: c1, error: cErr1 } = await obcy.db.rpc("create_group", { p_kind: "city", p_sem: "2027S", p_cc: "ES", p_city: "Barcelona" });
  check("Zakładanie brakującej grupy: Barcelona · lato 26/27", !cErr1 && c1, cErr1?.message);
  const { data: c2 } = await zuza.db.rpc("create_group", { p_kind: "city", p_sem: "2027S", p_cc: "ES", p_city: "barcelona" });
  check("Druga osoba „zakładająca” tę samą grupę trafia do istniejącej", c2 === c1);
  const { data: g } = await admin.from("groups").select("key, city").eq("id", c1).single();
  check("Klucz grupy jest zgodny z automatycznym dopasowaniem", g?.key === "city:ES:barcelona:2027S" && g?.city === "Barcelona", g?.key);
  const { error: bad } = await obcy.db.rpc("create_group", { p_kind: "city", p_sem: "2027S", p_cc: "ES", p_city: "Atlantyda" });
  check("Nie da się założyć grupy dla nieistniejącego miasta", !!bad);
  const { data: c3, error: cErr3 } = await obcy.db.rpc("create_group", { p_kind: "semester", p_sem: "2027S", p_inst: BOC.id });
  check("Zakładanie grupy uczelni: Bocconi · lato 26/27", !cErr3 && c3, cErr3?.message);
  const { data: c4, error: cErr4 } = await obcy.db.rpc("create_group", { p_kind: "country", p_sem: "2027S", p_cc: "PT" });
  check("Zakładanie grupy kraju: Portugalia · lato 26/27", !cErr4 && c4, cErr4?.message);
  const kCountry = ((await kasia.db.rpc("group_suggestions")).data ?? []).find((s) => s.kind === "country" && s.country_code === "PT");
  check("Kasia (leci do Lizbony latem) dostaje tę grupę w swoich dopasowaniach", kCountry?.group_id === c4 && kCountry?.members === 1);
}

section("Buddy");
{
  const { error } = await zuza.db.from("buddy_requests").insert({ from_user: zuza.id, to_user: kasia.id });
  check("Zuza prosi Kasię (absolwentkę) o bycie buddy", !error, error?.message);
  const { error: e2 } = await zuza.db.from("buddy_requests").insert({ from_user: zuza.id, to_user: adam.id });
  check("Nie da się prosić kogoś, kto nie chce być buddy", !!e2);
  const { data: seen } = await obcy.db.from("buddy_requests").select("id");
  check("Bezpieczeństwo: obcy nie widzi cudzych próśb", (seen ?? []).length === 0);
  const { data: incoming } = await kasia.db.from("buddy_requests").select("id, status").eq("to_user", kasia.id);
  check("Kasia widzi prośbę", incoming?.length === 1 && incoming[0].status === "pending");
  const { data: upd } = await kasia.db.from("buddy_requests").update({ status: "accepted" }).eq("id", incoming[0].id).select("status");
  check("Kasia akceptuje prośbę", upd?.[0]?.status === "accepted");
  const { data: hack } = await zuza.db.from("buddy_requests").update({ status: "accepted" }).eq("to_user", kasia.id).select("id");
  check("Bezpieczeństwo: proszący nie może sam zaakceptować", (hack ?? []).length === 0);
}

section("Wiadomości prywatne");
const { data: conv, error: cErr } = await kasia.db.rpc("get_or_create_conversation", { other_user: zuza.id });
check("Kasia otwiera rozmowę z Zuzą", !cErr && conv, cErr?.message);
{
  const { data: again } = await zuza.db.rpc("get_or_create_conversation", { other_user: kasia.id });
  check("Druga strona trafia do tej samej rozmowy", again === conv);
  const { error } = await kasia.db.from("messages").insert({ conversation_id: conv, sender_id: kasia.id, body: "Cześć! Chętnie pomogę z Bocconi" });
  check("Wysyłanie wiadomości", !error, error?.message);
  const { data } = await zuza.db.from("messages").select("body").eq("conversation_id", conv);
  check("Odbiorca widzi wiadomość", data?.length === 1);
  const { data: spy } = await obcy.db.from("messages").select("body").eq("conversation_id", conv);
  check("Bezpieczeństwo: obcy nie czyta cudzej rozmowy", (spy ?? []).length === 0);
  const { error: e2 } = await obcy.db.from("messages").insert({ conversation_id: conv, sender_id: obcy.id, body: "hej" });
  check("Bezpieczeństwo: obcy nie pisze do cudzej rozmowy", !!e2);
}

section("Nieprzeczytane i prywatność");
{
  const count = async (b, kind, id) => ((await b.db.rpc("unread_threads")).data ?? []).find((r) => r.kind === kind && (!id || r.thread_id === String(id)))?.unread ?? 0;
  check("Zuza ma 1 nieprzeczytaną wiadomość od Kasi", (await count(zuza, "direct", conv)) === 1);
  await zuza.db.rpc("mark_conversation_read", { p_conversation: conv });
  check("Po otwarciu rozmowy licznik spada do 0", (await count(zuza, "direct", conv)) === 0);
  check("Adam ma nieprzeczytaną wiadomość w grupie", (await count(adam, "group", gid)) >= 1);
  await adam.db.rpc("mark_group_read", { p_group: gid });
  check("Po otwarciu grupy licznik spada do 0", (await count(adam, "group", gid)) === 0);
  await obcy.db.rpc("mark_conversation_read", { p_conversation: conv });
  const { data: spyRead } = await admin.from("conversation_reads").select("user_id").eq("conversation_id", conv).eq("user_id", obcy.id);
  check("Bezpieczeństwo: obcy nie może oznaczać cudzej rozmowy", (spyRead ?? []).length === 0);
  const anon = createClient(URL_, PUB, { auth: { persistSession: false } });
  const { data: anonProfiles } = await anon.from("profiles").select("id").limit(5);
  check("Prywatność: niezalogowany nie odczyta profili przez API", (anonProfiles ?? []).length === 0);
  const { data: anonEx } = await anon.from("exchanges").select("id").limit(5);
  check("Prywatność: niezalogowany nie odczyta wymian przez API", (anonEx ?? []).length === 0);
}

section("Usuwanie konta");
{
  const temp = await makeBot("usun", "Bot Do Usunięcia");
  await temp.db.from("profiles").update({ home_institution_id: SGH.id }).eq("id", temp.id);
  await temp.db.from("exchanges").insert({ user_id: temp.id, institution_id: BOC.id, semester: "2026W", status: "going" });
  const { data: c } = await temp.db.rpc("get_or_create_conversation", { other_user: zuza.id });
  await temp.db.from("messages").insert({ conversation_id: c, sender_id: temp.id, body: "do usunięcia" });
  const { error } = await temp.db.rpc("delete_my_account");
  check("Użytkownik usuwa swoje konto", !error, error?.message);
  const { data: u } = await admin.auth.admin.getUserById(temp.id);
  check("Konto logowania zniknęło", !u?.user);
  const { count: left } = await admin.from("exchanges").select("id", { count: "exact", head: true }).eq("user_id", temp.id);
  const { count: msgs } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", c);
  check("Wymiany i wiadomości usunięte razem z kontem", left === 0 && msgs === 0, `wymiany ${left}, wiadomości ${msgs}`);
}

section("Wydarzenia");
const future = new Date(Date.now() + 7 * 86400000).toISOString();
const { data: ev, error: evErr } = await kasia.db
  .from("events")
  .insert({ title: "Zjazd testowy absolwentów", starts_at: future, city: "Warszawa", country_code: "PL", audience: "alumni", created_by: kasia.id })
  .select("id")
  .single();
check("Tworzenie wydarzenia", !evErr && ev, evErr?.message);
{
  const { error } = await zuza.db.from("event_attendees").insert({ event_id: ev.id, user_id: zuza.id });
  check("Zapis „Idę”", !error, error?.message);
  const { data } = await obcy.db.from("events").select("id, event_attendees(user_id)").eq("id", ev.id).single();
  check("Wydarzenie i liczba chętnych widoczne dla wszystkich", data?.event_attendees?.length === 1);
  const { data: del } = await obcy.db.from("events").delete().eq("id", ev.id).select("id");
  check("Bezpieczeństwo: nie da się usunąć cudzego wydarzenia", (del ?? []).length === 0);
  const { error: e2 } = await obcy.db.from("events").insert({ title: "Podszyte", starts_at: future, created_by: kasia.id });
  check("Bezpieczeństwo: nie da się utworzyć wydarzenia jako ktoś inny", !!e2);
}

section("Dodawanie uczelni");
{
  const { data, error } = await obcy.db
    .from("institutions")
    .insert({ name: "Testowa Akademia Pszczelarstwa", country_code: "PL", city: "Ul", search_text: "testowa akademia pszczelarstwa | ul", status: "pending", added_by: obcy.id })
    .select("id")
    .single();
  check("Użytkownik dodaje brakującą uczelnię (do zatwierdzenia)", !error && data, error?.message);
  const { data: mine } = await obcy.db.rpc("search_institutions", { q: "pszczelarstwa" });
  check("Dodający od razu ją widzi", mine?.length === 1);
  const { data: others } = await zuza.db.rpc("search_institutions", { q: "pszczelarstwa" });
  check("Inni nie widzą jej przed zatwierdzeniem", (others ?? []).length === 0);
  const { error: e2 } = await obcy.db.from("institutions").insert({ name: "Fałszywa zatwierdzona", country_code: "PL", status: "approved", added_by: obcy.id });
  check("Bezpieczeństwo: nie da się dodać od razu zatwierdzonej uczelni", !!e2);
}

section("Zdjęcia profilowe");
{
  // 1×1 px JPEG
  const jpg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
  const { error } = await zuza.db.storage.from("avatars").upload(`${zuza.id}/test.jpg`, jpg, { contentType: "image/jpeg", upsert: true });
  check("Wgrywanie zdjęcia do własnego folderu", !error, error?.message);
  const url = zuza.db.storage.from("avatars").getPublicUrl(`${zuza.id}/test.jpg`).data.publicUrl;
  const res = await fetch(url);
  check("Zdjęcie jest publicznie dostępne", res.ok, `HTTP ${res.status}`);
  await zuza.db.from("profiles").update({ avatar_url: url }).eq("id", zuza.id);
  const { error: e2 } = await obcy.db.storage.from("avatars").upload(`${zuza.id}/hack.jpg`, jpg, { contentType: "image/jpeg" });
  check("Bezpieczeństwo: nie da się podmienić cudzego zdjęcia", !!e2);
}

section("Ekrany aplikacji (renderowanie na serwerze)");
async function page(bot, path, expect) {
  try {
    const res = await fetch(APP + path, { headers: { cookie: bot.cookie, "accept-language": "pl-PL,pl;q=0.9" }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    const broken = /Application error|Unhandled Runtime Error|__next_error__/.test(html);
    const lacking = (expect ?? []).filter((e) => !html.includes(e));
    const why = res.status !== 200 ? `HTTP ${res.status} → ${res.headers.get("location") ?? ""}` : broken ? "błąd renderowania" : `brak: ${lacking.join(", ")}`;
    check(`${path} (${bot.name})`, res.status === 200 && !broken && lacking.length === 0, why);
  } catch (e) {
    check(`${path} (${bot.name})`, false, `serwer nie odpowiada (${e.message}); czy działa npm run dev?`);
  }
}
await page(zuza, "/roj", ["SGH → Bocconi"]);
await page(obcy, "/roj");
await page(zuza, "/ludzie", ["Bot Kasia"]);
await page(zuza, "/ludzie?seg=been&home=1", ["Bot Kasia"]);
await page(zuza, "/ludzie?ex=all&cc=IT&city=Milan", ["Bot Michał"]);
await page(kasia, "/roj", ["Bocconi", "Lisbon"]);
await page(zuza, `/ludzie?ex=all&passion=coffee`, ["Bot Kasia"]);
await page(zuza, `/u/${kasia.id}`, ["Bot Kasia"]);
await page(zuza, `/grupy/${gid}`, ["Hej, szukamy razem mieszkania?"]);
await page(obcy, `/grupy/${gid}`);
await page(zuza, "/wydarzenia", ["Zjazd testowy absolwentów"]);
await page(zuza, "/wydarzenia?tab=online");
await page(zuza, "/wydarzenia/nowe");
await page(obcy, "/grupy");
await page(obcy, "/grupy?tab=city&cc=ES&city=Madrid&sem=2027S", ["Utwórz grupę i dołącz"]);
await page(obcy, `/grupy/${gid}`, ["Dołącz jako gość"]);
await page(zuza, "/czaty", ["Bot Kasia"]);
await page(kasia, "/czaty");
await page(zuza, `/wiadomosci/${conv}`, ["Chętnie pomogę z Bocconi"]);
await page(zuza, "/profil", ["Bot Zuza"]);
await page(zuza, "/onboarding");
{
  const res = await fetch(`${APP}/api/institutions?q=bocconi`, { headers: { cookie: zuza.cookie } });
  const json = res.ok ? await res.json() : [];
  check("/api/institutions?q=bocconi (wyszukiwarka w aplikacji)", json[0]?.name === "Bocconi University", `HTTP ${res.status}`);
}
{
  const res = await fetch(`${APP}/roj`, { redirect: "manual" });
  check("Niezalogowany jest przekierowany do logowania", [302, 303, 307].includes(res.status) && (res.headers.get("location") ?? "").includes("/login"), `HTTP ${res.status}`);
}


section("Wersja angielska (czy nic nie zostało po polsku)");
{
  const dict = readFileSync("src/lib/i18n/dictionaries.ts", "utf8");
  const plBlock = dict.slice(dict.indexOf("const pl = {"), dict.indexOf("export type Dictionary"));
  const enBlock = dict.slice(dict.indexOf("const en: Dictionary = {"), dict.indexOf("export const dictionaries"));
  const lits = (b) => new Set([...b.matchAll(/"([^"\\]{5,})"/g)].map((m) => m[1]));
  const enSet = lits(enBlock);
  const polish = [...lits(plBlock)].filter((x) => !enSet.has(x) && /[a-ząćęłńóśźż]/i.test(x));
  check(`Słownik: ${polish.length} polskich tekstów do wyszukania`, polish.length > 100);
  const visible = (html) => {
    const attrs = [...html.matchAll(/(?:placeholder|aria-label|title|alt)="([^"]*)"/g)].map((m) => m[1]).join(" ");
    const body = html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ");
    return `${body} ${attrs}`.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  };
  const pageEn = async (bot, path) => {
    const res = await fetch(APP + path, { headers: { cookie: `${bot ? bot.cookie + "; " : ""}lang=en`, "accept-language": "pl-PL" }, redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    const text = visible(html);
    const leaks = polish.filter((x) => text.includes(x));
    check(`EN ${path}`, res.status === 200 && html.includes('lang="en"') && leaks.length === 0, res.status !== 200 ? `HTTP ${res.status}` : leaks.slice(0, 4).join(" | ") || "brak lang=en");
  };
  for (const path of ["/", "/login", "/regulamin", "/prywatnosc"]) await pageEn(null, path);
  for (const path of ["/roj", "/ludzie", "/ludzie?seg=been&buddy=1", "/grupy", "/grupy?tab=city&cc=ES&city=Madrid&sem=2027S", "/wydarzenia", "/wydarzenia/nowe", "/czaty", "/profil", "/onboarding"])
    await pageEn(zuza, path);
  await pageEn(zuza, `/u/${kasia.id}`);
  await pageEn(zuza, `/grupy/${gid}`);
  await pageEn(obcy, `/grupy/${gid}`);
  await pageEn(zuza, `/wiadomosci/${conv}`);
  await pageEn(kasia, "/roj");
  await pageEn(kasia, "/czaty");
}

// ---------- podsumowanie ----------
const failed = results.filter((r) => !r.ok);
console.log(`\n${failed.length ? "❌" : "✅"} Wynik: ${results.length - failed.length}/${results.length} testów zaliczonych`);
if (KEEP) console.log(`Boty zostały w bazie (${Object.keys(bots).length}). Usuniesz je: npm run test:e2e:cleanup`);
else console.log(`Sprzątanie: usunięto ${await cleanup()} botów i ich dane.`);
process.exit(failed.length ? 1 : 0);
