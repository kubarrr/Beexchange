// Test obciążenia: wgrywa N fikcyjnych osób (domyślnie 5000) z wymianami, grupami i wiadomościami,
// mierzy czas najważniejszych zapytań i stron, a na końcu wszystko usuwa.
// Uruchom: npm run test:load            (N=5000)
//          npm run test:load -- 1000    (inna liczba)
//          npm run test:load -- --clear (tylko sprzątanie po przerwanym teście)
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const APP = process.env.TEST_APP_URL ?? "http://localhost:3000";
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const DOMAIN = "load.beexchange.local";
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5000);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const sample = (arr, k) => [...arr].sort(() => Math.random() - 0.5).slice(0, k);
const t0 = () => performance.now();
const secs = (start) => ((performance.now() - start) / 1000).toFixed(1) + " s";

async function pool(items, size, fn) {
  let i = 0;
  const workers = Array.from({ length: size }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function listLoadUsers() {
  const ids = [];
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    ids.push(...data.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`)).map((u) => u.id));
    if (data.users.length < 1000) break;
  }
  return ids;
}

async function cleanup() {
  const start = t0();
  const ids = await listLoadUsers();
  await pool(ids, 25, (id) => admin.auth.admin.deleteUser(id));
  const { data: groups } = await admin.from("groups").select("id, group_members(count)");
  const empty = (groups ?? []).filter((g) => !g.group_members?.[0]?.count).map((g) => g.id);
  for (let i = 0; i < empty.length; i += 500) await admin.from("groups").delete().in("id", empty.slice(i, i + 500));
  console.log(`🧹 Usunięto ${ids.length} kont testowych i ${empty.length} pustych grup (${secs(start)})`);
}

if (process.argv.includes("--clear")) {
  await cleanup();
  process.exit(0);
}
await cleanup();

// ---------- dane ----------
console.log(`\n▶ Wgrywanie ${N} osób`);
const { data: plUnis } = await admin.from("institutions").select("id").eq("country_code", "PL").not("acronym", "is", null).limit(40);
const hostCountries = ["IT", "ES", "PT", "DE", "FR", "NL", "BE", "SE", "CZ", "AT", "FI", "DK", "IE", "GR", "TR"];
const { data: hostUnis } = await admin.from("institutions").select("id, city, country_code").in("country_code", hostCountries).not("acronym", "is", null).limit(200);
const semesters = ["2025W", "2026S", "2026W", "2027S", "2027W", "2024W"];
const passions = ["travel", "photography", "volleyball", "football", "cooking", "parties", "music", "mountains", "coffee", "art", "startups", "languages", "running", "gym"];

let start = t0();
const users = new Array(N);
const probes = [];
await pool([...Array(N).keys()], 25, async (i) => {
  const probe = i < 3;
  const password = randomBytes(16).toString("base64url");
  const email = `u${i}@${DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `Test ${i}` } });
  if (error) throw new Error(`createUser ${i}: ${error.message}`);
  users[i] = data.user.id;
  if (probe) probes.push({ id: data.user.id, email, password });
  if (i % 1000 === 999) console.log(`  konta: ${i + 1}/${N} (${secs(start)})`);
});
console.log(`  ✓ ${N} kont (${secs(start)})`);

start = t0();
const homes = [];
const exchanges = [];
const profiles = users.map((id) => {
  const home = pick(plUnis).id;
  const n = Math.random() < 0.15 ? 2 : Math.random() < 0.8 ? 1 : 0;
  const mine = sample(hostUnis, n).map((u, k) => {
    const semester = pick(semesters);
    const status = semester <= "2026S" ? "been" : "going";
    exchanges.push({ user_id: id, institution_id: u.id, semester, status: k === 0 ? status : "been" });
    return { u, semester, status };
  });
  homes.push({ user_id: id, institution_id: home, field_of_study: pick(["Finanse", "Informatyka", "Prawo", "Architektura", "Psychologia"]), study: "bachelor:2", position: 0 });
  const main = mine[0];
  return {
    id,
    onboarded: true,
    home_institution_id: home,
    exchange_institution_id: main?.u.id ?? null,
    semester: main?.semester ?? null,
    status: main ? main.status : "searching",
    passions: sample(passions, 3),
    languages: ["pl:native", "en:B2"],
    open_to_questions: Math.random() < 0.6,
    wants_buddy: main?.status === "been" && Math.random() < 0.3,
  };
});
const batch = async (table, rows, opts) => {
  for (let i = 0; i < rows.length; i += 500) {
    const q = opts?.upsert ? admin.from(table).upsert(rows.slice(i, i + 500), { onConflict: opts.upsert }) : admin.from(table).insert(rows.slice(i, i + 500));
    const { error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
  }
};
await batch("profiles", profiles, { upsert: "id" });
await batch("profile_homes", homes);
await batch("exchanges", exchanges, { upsert: "user_id,institution_id,semester" });
console.log(`  ✓ profile, ${homes.length} uczelni macierzystych, ${exchanges.length} wymian (${secs(start)})`);

// Grupy semestralne uczelni (najczęstsze) z członkami i wiadomościami
start = t0();
const bySem = new Map();
for (const x of exchanges) {
  const k = `semester:${x.institution_id}:${x.semester}`;
  if (!bySem.has(k)) bySem.set(k, { inst: x.institution_id, sem: x.semester, users: [] });
  bySem.get(k).users.push(x.user_id);
}
const groupsToMake = [...bySem.entries()].filter(([, g]) => g.users.length >= 3).slice(0, 400);
const hostById = new Map(hostUnis.map((u) => [u.id, u]));
const { data: madeGroups, error: gErr } = await admin
  .from("groups")
  .upsert(groupsToMake.map(([key, g]) => ({ kind: "semester", key, exchange_institution_id: g.inst, country_code: hostById.get(g.inst).country_code, semester: g.sem })), { onConflict: "key" })
  .select("id, key");
if (gErr) throw new Error(gErr.message);
const gid = new Map(madeGroups.map((g) => [g.key, g.id]));
const members = [];
const gmsgs = [];
for (const [key, g] of groupsToMake) {
  for (const u of g.users) members.push({ group_id: gid.get(key), user_id: u });
  for (let m = 0; m < 50; m++) gmsgs.push({ group_id: gid.get(key), sender_id: pick(g.users), body: `Wiadomość testowa ${m}` });
}
await batch("group_members", members, { upsert: "group_id,user_id" });
await batch("group_messages", gmsgs);
console.log(`  ✓ ${groupsToMake.length} grup, ${members.length} członkostw, ${gmsgs.length} wiadomości w grupach (${secs(start)})`);

// Rozmowy prywatne
start = t0();
const convs = [];
const seen = new Set();
while (convs.length < Math.min(3000, N)) {
  const [a, b] = [pick(users), pick(users)];
  if (a === b) continue;
  const [ua, ub] = a < b ? [a, b] : [b, a];
  if (seen.has(ua + ub)) continue;
  seen.add(ua + ub);
  convs.push({ user_a: ua, user_b: ub });
}
const madeConvs = [];
for (let i = 0; i < convs.length; i += 500) {
  const { data, error } = await admin.from("conversations").insert(convs.slice(i, i + 500)).select("id, user_a, user_b");
  if (error) throw new Error(error.message);
  madeConvs.push(...data);
}
const dms = madeConvs.flatMap((c) => Array.from({ length: 5 }, (_, k) => ({ conversation_id: c.id, sender_id: k % 2 ? c.user_a : c.user_b, body: `Hej ${k}` })));
await batch("messages", dms);
console.log(`  ✓ ${madeConvs.length} rozmów, ${dms.length} wiadomości prywatnych (${secs(start)})`);

// ---------- pomiary ----------
console.log("\n▶ Pomiary (jako zalogowany użytkownik, średnia z 10 powtórzeń)");
const probe = probes[0];
// osoba testowa z wymianą, żeby Rój miał co liczyć
const probeEx = exchanges.find((x) => x.user_id === probe.id) ?? exchanges[0];
if (!exchanges.some((x) => x.user_id === probe.id)) await admin.from("exchanges").insert({ user_id: probe.id, institution_id: probeEx.institution_id, semester: probeEx.semester, status: "going" });
const db = createClient(URL_, PUB, { auth: { persistSession: false, autoRefreshToken: false } });
await db.auth.signInWithPassword({ email: probe.email, password: probe.password });

const results = [];
async function measure(name, fn, limitMs) {
  await fn(); // rozgrzewka
  const times = [];
  for (let i = 0; i < 10; i++) {
    const s = t0();
    const r = await fn();
    if (r?.error) throw new Error(`${name}: ${r.error.message}`);
    times.push(performance.now() - s);
  }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const ok = times[8] <= limitMs;
  results.push({ name, ok });
  console.log(`  ${ok ? "✅" : "⚠️ "} ${name.padEnd(52)} śr. ${avg.toFixed(0).padStart(5)} ms   p90 ${times[8].toFixed(0).padStart(5)} ms   (limit ${limitMs} ms)`);
}
const host = hostById.get(probeEx.institution_id);
await measure("Rój: group_suggestions()", () => db.rpc("group_suggestions"), 800);
await measure("Ludzie: wszyscy", () => db.rpc("search_people", { lim: 60 }), 800);
await measure("Ludzie: kraj + miasto + semestr", () => db.rpc("search_people", { p_cc: host.country_code, p_city: host.city, p_sem: probeEx.semester }), 800);
await measure("Ludzie: z mojej uczelni + pasja + buddy", () => db.rpc("search_people", { p_home_only: true, p_passion: "coffee", p_buddy: true }), 800);
await measure("Ludzie: wyszukiwanie po imieniu", () => db.rpc("search_people", { p_q: "Test 12" }), 800);
await measure("Odkrywaj grupy: wszystkie", () => db.rpc("discover_groups", {}), 800);
await measure("Odkrywaj grupy: kraj", () => db.rpc("discover_groups", { p_cc: host.country_code }), 800);
await measure("Licznik nieprzeczytanych: unread_threads()", () => db.rpc("unread_threads"), 500);
await measure("Wyszukiwarka uczelni: „uni”", () => db.rpc("search_institutions", { q: "uni", prefer_cc: "PL", lim: 8 }), 500);
const someGroup = madeGroups[0].id;
await measure("Czat grupy: 200 ostatnich wiadomości", () => admin.from("group_messages").select("id, body").eq("group_id", someGroup).order("created_at", { ascending: false }).limit(200), 500);

// strony aplikacji (serwer deweloperski jest wolniejszy niż produkcyjny)
const jar = new Map();
const ssr = createServerClient(URL_, PUB, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
await ssr.auth.signInWithPassword({ email: probe.email, password: probe.password });
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
for (const path of ["/roj", "/ludzie", "/grupy", "/czaty"]) {
  await measure(`Strona ${path} (serwer deweloperski)`, async () => {
    const res = await fetch(APP + path, { headers: { cookie, "accept-language": "pl" } });
    await res.text();
    return res.ok ? null : { error: { message: `HTTP ${res.status}` } };
  }, 3000);
}

const slow = results.filter((r) => !r.ok);
console.log(`\n${slow.length ? "⚠️" : "✅"} ${results.length - slow.length}/${results.length} pomiarów w limicie przy ${N} osobach`);
await cleanup();
