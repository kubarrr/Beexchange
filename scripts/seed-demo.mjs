// Dane pokazowe wokół Twojego profilu: ludzie na każdym etapie (szuka / jedzie / na wymianie / był),
// grupy z rozmowami, wiadomości do Ciebie, prośba o buddy i wydarzenia.
//
// Uruchom:  npm run demo:seed            (tworzy od nowa)
//           npm run demo:seed -- --clear (tylko usuwa)
// Konto „właściciela” = pierwszy użytkownik spoza botów albo OWNER_EMAIL z .env.local.
// ⚠️ Przed publicznym startem usuń dane pokazowe: npm run demo:seed -- --clear
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const DOMAIN = "demo.beexchange.local";
const fail = (msg) => {
  console.error("❌", msg);
  process.exit(1);
};
const must = async (promise, what) => {
  const { data, error } = await promise;
  if (error) fail(`${what}: ${error.message}`);
  return data;
};

// ---------- sprzątanie ----------
// Wymaga migracji 0003 (tabele profile_homes i exchanges)
{
  const { error } = await admin.from("profile_homes").select("user_id").limit(1);
  if (error) {
    console.error("❌ Najpierw uruchom supabase/migrations/0003_multi_exchange.sql w Supabase → SQL Editor.");
    process.exit(1);
  }
}
const { data: list } = await admin.auth.admin.listUsers({ perPage: 500 });
const old = list.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`) || u.email?.endsWith("@demo.beerasmus.local"));
for (const u of old) await admin.auth.admin.deleteUser(u.id);
{
  const groups = await must(admin.from("groups").select("id, group_members(count)"), "grupy");
  const empty = groups.filter((g) => !g.group_members?.[0]?.count).map((g) => g.id);
  if (empty.length) await admin.from("groups").delete().in("id", empty);
}
console.log(`Usunięto ${old.length} starych kont pokazowych.`);
if (process.argv.includes("--clear")) process.exit(0);

// ---------- właściciel ----------
const ownerEmail = process.env.OWNER_EMAIL;
const owner = list.users.find((u) => (ownerEmail ? u.email === ownerEmail : !u.email?.endsWith(".local")));
if (!owner) fail("Nie znalazłem Twojego konta. Zaloguj się raz w aplikacji albo ustaw OWNER_EMAIL w .env.local.");
const ownerProfile = await must(admin.from("profiles").select("full_name, home_institution_id").eq("id", owner.id).single(), "profil właściciela");
if (!ownerProfile.home_institution_id) fail("Najpierw przejdź onboarding w aplikacji (uczelnia i wymiana).");

// ---------- uczelnie ----------
const byName = async (name) => (await must(admin.from("institutions").select("id, city, country_code").eq("name", name).limit(1).single(), `uczelnia ${name}`));
const I = {
  PW: await byName("Warsaw University of Technology"),
  POLIMI: await byName("Politecnico di Milano"),
  UW: await byName("University of Warsaw"),
  SGH: await byName("SGH Warsaw School of Economics"),
  BOC: await byName("Bocconi University"),
  UJ: await byName("Jagiellonian University"),
  SAP: await byName("Sapienza University of Rome"),
  AGH: await byName("AGH University of Krakow"),
  DELFT: await byName("Delft University of Technology"),
  TUM: await byName("Technical University of Munich"),
};

// ---------- ludzie ----------
const PEOPLE = [
  { key: "marta", name: "Marta Zielińska", homes: [["PW", "Data Science", "master:2"]], ex: [["POLIMI", "2026S", "been"]], passions: ["travel", "running", "coffee"], langs: ["pl:native", "en:C1", "it:B1"], buddy: true, helper: true,
    bio: "Semestr na Polimi to był sztos. Chętnie pomogę z Learning Agreement i mieszkaniem w Città Studi." },
  { key: "julia", name: "Julia Wójcik", homes: [["PW", "Architektura", "master:1"], ["SGH", "Zarządzanie", "bachelor:3"]], ex: [["POLIMI", "2026S", "been"], ["DELFT", "2025W", "been"]], passions: ["art", "photography", "travel"], langs: ["pl:native", "en:C2", "nl:A2"], buddy: false, helper: true,
    bio: "Dwie uczelnie, dwie wymiany: Delft i Mediolan. Pytajcie o porównanie!" },
  { key: "pawel", name: "Paweł Lewandowski", homes: [["UW", "Informatyka", "master:1"]], ex: [["POLIMI", "2026S", "been"]], passions: ["gaming", "football", "tech"], langs: ["pl:native", "en:C1"], buddy: false,
    bio: "Z UW na Polimi, kursy z ML były świetne." },
  { key: "kasia", name: "Kasia Nowak", homes: [["SGH", "Finanse i rachunkowość", "master:2"]], ex: [["BOC", "2026S", "been"]], passions: ["coffee", "dance", "travel"], langs: ["pl:native", "en:C1", "it:B2"], buddy: false, helper: true,
    bio: "Bocconi, lato 2025/26. Mediolan to moje drugie miasto." },
  { key: "tomek", name: "Tomek Kamiński", homes: [["UJ", "Historia sztuki", "bachelor:3"]], ex: [["SAP", "2026S", "been"]], passions: ["art", "books", "cooking"], langs: ["pl:native", "it:B2", "en:B2"], buddy: false,
    bio: "Rzym i Sapienza. Chętnie wpadnę na włoskie spotkania w Polsce." },
  { key: "ola", name: "Ola Mazur", homes: [["PW", "Data Science", "master:1"]], ex: [["POLIMI", "2026W", "going"]], passions: ["running", "music", "coffee"], langs: ["pl:native", "en:C1"], buddy: false, helper: true,
    bio: "Właśnie jestem w Mediolanie! Szukam ekipy na bieganie w Parco Lambro." },
  { key: "kuba", name: "Kuba Nowicki", homes: [["PW", "Data Science", "bachelor:3"]], ex: [["POLIMI", "2027S", "going"]], passions: ["football", "travel", "gym"], langs: ["pl:native", "en:B2"], buddy: false, housing: true,
    bio: "Lecę na Polimi w lutym. Szukam buddy'ego i mieszkania!" },
  { key: "michal", name: "Michał Szymański", homes: [["AGH", "Automatyka i robotyka", "engineer:4"]], ex: [["POLIMI", "2027S", "going"]], passions: ["mountains", "skiing", "tech"], langs: ["pl:native", "en:C1"], buddy: false, housing: true,
    bio: "AGH → Polimi, lato 2026/27." },
  { key: "giulia", name: "Giulia Bianchi", homes: [["POLIMI", "Ingegneria Informatica", "master:2"]], ex: [], passions: ["coffee", "art", "travel"], langs: ["it:native", "en:C1", "pl:A1"], buddy: true,
    bio: "Ciao! Studiuję na Polimi i pomagam przyjezdnym. Pokażę Ci Città Studi i najlepsze aperitivo." },
  { key: "lucas", name: "Lucas Müller", homes: [["TUM", "Informatik", "master:1"]], ex: [["POLIMI", "2026W", "going"]], passions: ["football", "mountains", "music"], langs: ["de:native", "en:C1", "it:A2"], buddy: false, housing: true,
    bio: "Erasmus at Polimi this winter. Looking for people to explore Milan with!" },
  { key: "ania", name: "Ania Dąbrowska", homes: [["PW", "Data Science", "bachelor:2"]], ex: [], passions: ["languages", "travel", "dance"], langs: ["pl:native", "en:B2", "es:A2"], buddy: true,
    bio: "Waham się między Mediolanem a Barceloną. Pomożecie wybrać?" },
];

const ids = {};
for (const p of PEOPLE) {
  const { data, error } = await admin.auth.admin.createUser({ email: `${p.key}@${DOMAIN}`, email_confirm: true, user_metadata: { full_name: p.name } });
  if (error) fail(`konto ${p.key}: ${error.message}`);
  const id = (ids[p.key] = data.user.id);
  const going = p.ex.filter((x) => x[2] === "going");
  const main = going[0] ?? p.ex[0];
  await must(
    admin
      .from("profiles")
      .update({
        onboarded: true,
        status: going.length ? "going" : p.ex.length ? "been" : "searching",
        home_institution_id: I[p.homes[0][0]].id,
        field_of_study: p.homes[0][1],
        study_year: p.homes[0][2],
        exchange_institution_id: main ? I[main[0]].id : null,
        semester: main ? main[1] : null,
        passions: p.passions,
        languages: p.langs,
        bio: p.bio,
        open_to_questions: true,
        wants_buddy: p.buddy,
        looking_for_housing: !!p.housing,
        helps_departure: !!p.helper,
      })
      .eq("id", id),
    `profil ${p.key}`,
  );
  await must(admin.from("profile_homes").insert(p.homes.map(([k, field, study], position) => ({ user_id: id, institution_id: I[k].id, field_of_study: field, study, position }))), `uczelnie ${p.key}`);
  if (p.ex.length) await must(admin.from("exchanges").insert(p.ex.map(([k, semester, status]) => ({ user_id: id, institution_id: I[k].id, semester, status }))), `wymiany ${p.key}`);
}
console.log(`Utworzono ${PEOPLE.length} osób pokazowych.`);

// ---------- grupy z rozmowami (klucze jak w funkcji group_key_for) ----------
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
async function group(kind, key, fields, members, messages, { locals = [], guests = [] } = {}) {
  const g = await must(admin.from("groups").upsert({ kind, key, ...fields }, { onConflict: "key" }).select("id").single(), `grupa ${key}`);
  await must(
    admin.from("group_members").upsert(members.map((m) => ({ group_id: g.id, user_id: ids[m], is_local: locals.includes(m), is_guest: guests.includes(m) })), { onConflict: "group_id,user_id" }),
    `członkowie ${key}`,
  );
  if (messages.length) await must(admin.from("group_messages").insert(messages.map(([who, body, min]) => ({ group_id: g.id, sender_id: ids[who], body, created_at: ago(min) }))), `wiadomości ${key}`);
}
const { POLIMI, BOC } = I;
// Grupy zawsze na dany semestr: Polacy · uczelnia/miasto/kraj, Wszyscy · uczelnia/miasto
await group("nat_uni", `nat_uni:PL:${POLIMI.id}:2026S`, { exchange_institution_id: POLIMI.id, country_code: "IT", nat_cc: "PL", semester: "2026S" }, ["marta", "julia", "pawel"], [
  ["marta", "Tęsknicie za Mediolanem? 😅", 2900],
  ["julia", "Codziennie. Ktoś jeszcze ma zaległe uznanie przedmiotów?", 2880],
  ["marta", "Ja! Dziekanat wymaga jeszcze sylabusów po angielsku.", 2860],
  ["julia", "Polacy na Polimi z lata, kto wpada na aperitivo w Warszawie?", 1300],
]);
await group("nat_uni", `nat_uni:PL:${POLIMI.id}:2027S`, { exchange_institution_id: POLIMI.id, country_code: "IT", nat_cc: "PL", semester: "2027S" }, ["kuba", "michal", "marta", "julia", "ola"], [
  ["kuba", "Cześć! Lecę na Polimi w lutym. Jak z mieszkaniami w Città Studi?", 600],
  ["marta", "Szukaj od razu, najlepiej przez grupy uczelniane i sprawdzone agencje. Nie płać przed obejrzeniem!", 560],
  ["ola", "Potwierdzam, jestem teraz na miejscu i ceny pokoi to ok. 650–750 €.", 540],
  ["julia", "A Learning Agreement zrób od razu z listą zapasowych kursów, bo plany często się zmieniają.", 500],
  ["michal", "Kuba, szukamy razem? Też potrzebuję pokoju od lutego 🏠", 120],
], { guests: ["marta", "julia", "ola"] });
await group("nat_city", `nat_city:PL:IT:milan:2026W`, { city: "Milan", country_code: "IT", nat_cc: "PL", semester: "2026W" }, ["ola"], [
  ["ola", "Polacy w Mediolanie tej zimy: kto biega w Parco Lambro? 🏃", 900],
]);
await group("nat_country", `nat_country:PL:IT:2026S`, { country_code: "IT", nat_cc: "PL", semester: "2026S" }, ["tomek", "kasia"], [
  ["tomek", "Włochy lato 25/26: robimy wieczór włoski w Krakowie?", 4000],
]);
await group("semester", `semester:${POLIMI.id}:2026W`, { exchange_institution_id: POLIMI.id, country_code: "IT", semester: "2026W" }, ["ola", "lucas", "giulia"], [
  ["giulia", "Welcome to Polimi! I'm a local student, ask me anything about Milan 🙂", 400],
  ["lucas", "Thanks Giulia! Where do people usually meet for aperitivo?", 380],
  ["ola", "Navigli! We're going out on Saturday, Lucas you're in 🙂", 360],
], { locals: ["giulia"] });
await group("city", `city:IT:milan:2026S`, { city: "Milan", country_code: "IT", semester: "2026S" }, ["kasia", "pawel"], [
  ["kasia", "Mediolańska ekipa z lata, jak tam po powrocie?", 3000],
]);
await group("city", `city:PL:warsaw:2026W`, { city: "Warsaw", country_code: "PL", semester: "2026W" }, ["kasia", "pawel", "marta"], [
  ["kasia", "Anyone back from Italy or Italians in Warsaw: aperitivo on Friday? 🇮🇹", 700],
  ["pawel", "I'm in! Hala Koszyki?", 680],
], { locals: ["kasia", "pawel", "marta"] });
await group("semester", `semester:${BOC.id}:2026S`, { exchange_institution_id: BOC.id, country_code: "IT", semester: "2026S" }, ["kasia"], []);
console.log("Utworzono grupy z rozmowami.");

// ---------- wiadomości do Ciebie i prośba o buddy ----------
async function dm(fromKey, messages) {
  const a = ids[fromKey] < owner.id ? ids[fromKey] : owner.id;
  const b = ids[fromKey] < owner.id ? owner.id : ids[fromKey];
  const conv = await must(admin.from("conversations").insert({ user_a: a, user_b: b }).select("id").single(), `rozmowa ${fromKey}`);
  await must(admin.from("messages").insert(messages.map(([body, min]) => ({ conversation_id: conv.id, sender_id: ids[fromKey], body, created_at: ago(min) }))), `wiadomości ${fromKey}`);
}
await dm("kuba", [
  ["Cześć Jakub! Widzę, że byłeś na Polimi z PW. Mogę zapytać o kursy z Data Science?", 90],
  ["Szczególnie ciekawi mnie, które przedmioty dało się uznać na PW.", 88],
]);
await dm("ania", [["Hej! Waham się między Mediolanem a Barceloną. Jak oceniasz Mediolan dla studenta?", 30]]);
await must(admin.from("buddy_requests").insert({ from_user: ids.kuba, to_user: owner.id, message: "Będziesz moim buddy na Polimi?" }), "prośba o buddy");

// ---------- wydarzenia ----------
const inDays = (d, h) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};
const events = await must(
  admin
    .from("events")
    .insert([
      { title: "Italian aperitivo in Warsaw 🍝", description: "Byłeś/aś na wymianie we Włoszech, jedziesz tam albo jesteś Włochem/Włoszką w Warszawie? Wpadnij, każdy jest mile widziany!\n\nBeen on exchange in Italy, going there, or an Italian living in Warsaw? Come along, everyone is welcome!", starts_at: inDays(10, 19), is_online: false, city: "Warsaw", country_code: "PL", location: "Hala Koszyki", audience: "all", created_by: ids.marta },
      { title: "Q&A online: Milan from the inside (PL/EN)", description: "Absolwenci Polimi i Bocconi odpowiadają na pytania o mieszkania, kursy i życie w Mediolanie.\n\nPolimi and Bocconi alumni answer your questions about housing, courses and life in Milan.", starts_at: inDays(5, 20), is_online: true, link: "https://meet.example.com/beexchange", audience: "going", created_by: ids.julia },
      { title: "Aperitivo on the Navigli 🍹", description: "Everyone on exchange in Milan this semester: let's meet! Local students welcome too.", starts_at: inDays(3, 18), is_online: false, city: "Milan", country_code: "IT", location: "Navigli, Alzaia Naviglio Grande", audience: "all", created_by: ids.ola },
      { title: "Italian night in Kraków", description: "Dla wszystkich po wymianie we Włoszech i dla Włochów w Krakowie.\n\nFor everyone back from an exchange in Italy and for Italians living in Kraków.", starts_at: inDays(21, 19), is_online: false, city: "Krakow", country_code: "PL", location: "Kazimierz", audience: "all", created_by: ids.tomek },
    ])
    .select("id, created_by"),
  "wydarzenia",
);
const attend = [
  [0, ["pawel", "julia", "kasia"]],
  [1, ["kuba", "michal", "ania"]],
  [2, ["ola"]],
  [3, ["kasia"]],
];
await must(admin.from("event_attendees").insert(attend.flatMap(([i, who]) => who.map((w) => ({ event_id: events[i].id, user_id: ids[w] })))), "uczestnicy");
console.log("Utworzono wiadomości, prośbę o buddy i wydarzenia.");

// ---------- mieszkania: pokoje do przejęcia i osoby gotowe sprawdzić mieszkanie ----------
await must(admin.from("profiles").update({ checks_housing: true }).in("id", [ids.ola, ids.giulia]), "sprawdzający");
const iso = (d) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
await must(
  admin.from("rooms").insert([
    {
      author_id: ids.ola, country_code: "IT", city: "Milan", kind: "room", price: 690, currency: "EUR",
      title: "Room in Città Studi from February",
      description: "Finishing my exchange in February, looking for someone to take my room. 10 min walk to PoliMi, 3 flatmates (an Italian and two Spanish girls), bills included.",
      available_from: iso(120), available_to: iso(270), area: "Città Studi, metro Piola", taken: false,
    },
    {
      author_id: ids.giulia, country_code: "IT", city: "Milan", kind: "shared", price: 420, currency: "EUR",
      title: "Shared room near Bocconi",
      description: "My flatmate is leaving for her own Erasmus, the bed in our double room is free for the spring semester. Quiet building, 5 min to Bocconi.",
      available_from: iso(110), available_to: null, area: "Porta Romana", taken: false,
    },
    {
      author_id: ids.marta, country_code: "IT", city: "Milan", kind: "room", price: 650, currency: "EUR",
      title: "Pokój na Navigli (już oddany)", description: "Dzięki BeeXchange znalazłam następczynię 🙂",
      available_from: iso(-60), available_to: null, taken: true, area: "Navigli",
    },
  ]),
  "pokoje",
);
console.log("Utworzono pokoje do przejęcia.");
console.log(`\n✅ Gotowe. Zaloguj się jako ${ownerProfile.full_name} i otwórz http://localhost:3000/swarm`);
