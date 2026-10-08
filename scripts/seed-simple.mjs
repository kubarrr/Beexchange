// Dane pokazowe wersji prostej: osoby jadące, będące/byłe na wymianie i pomagające.
// Uruchom: npm run demo:seed          (ponowne uruchomienie podmienia dane)
//          npm run demo:seed -- --clear  (tylko usuwa dane pokazowe — przed publicznym startem!)
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const DOMAIN = "demo.beexchange.local";

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const old = list.users.filter((u) => u.email?.endsWith(`@${DOMAIN}`));
for (const u of old) await admin.auth.admin.deleteUser(u.id);
console.log(`Usunięto ${old.length} kont pokazowych.`);
if (process.argv.includes("--clear")) process.exit(0);

const byName = async (name) => {
  const { data, error } = await admin.from("institutions").select("id").eq("name", name).limit(1).single();
  if (error) throw new Error(`Brak uczelni „${name}”`);
  return data.id;
};
const U = {
  PW: await byName("Warsaw University of Technology"),
  UW: await byName("University of Warsaw"),
  SGH: await byName("SGH Warsaw School of Economics"),
  POLIMI: await byName("Politecnico di Milano"),
  BOC: await byName("Bocconi University"),
  UNIMI: await byName("University of Milan"),
  LIS: await byName("University of Lisbon"),
  TUM: await byName("Technical University of Munich"),
  UJ: await byName("Jagiellonian University"),
};

// [klucz, imię, uczelnia macierzysta, kontakty, wymiany [rodzaj, uczelnia, semestr]] — „helper” = 🧸 buddy na uczelni macierzystej
const PEOPLE = [
  ["kuba", "Kuba N.", "PW", { instagram: "kuba.erasmus" }, [["going", "POLIMI", "2027S"]]],
  ["michal", "Michał", "PW", { whatsapp: "+48600100200" }, [["going", "POLIMI", "2027S"]]],
  ["zuza", "Zuza", "SGH", { instagram: "zuza.goes.milan", facebook: "https://facebook.com/zuza.example" }, [["going", "BOC", "2027S"]]],
  ["ola", "Ola Mazur", "PW", { instagram: "ola.in.milan" }, [["been", "POLIMI", "2026W"], ["helper", "POLIMI", null]]],
  ["lucas", "Lucas", "TUM", { whatsapp: "+491701234567" }, [["been", "POLIMI", "2026W"]]],
  ["marta", "Marta Zielińska", "PW", { instagram: "marta.zielinska", facebook: "https://facebook.com/marta.example" }, [["been", "POLIMI", "2026S"], ["helper", "PW", null]]],
  ["kasia", "Kasia", "SGH", { instagram: "kasia.bocconi" }, [["been", "BOC", "2026S"], ["helper", "SGH", null]]],
  ["pawel", "Paweł", "UW", { whatsapp: "+48600300400" }, [["been", "UNIMI", "2026S"]]],
  ["giulia", "Giulia B.", "POLIMI", { instagram: "giulia.polimi", whatsapp: "+393331234567" }, [["helper", "POLIMI", null]]],
  ["marco", "Marco", "BOC", { instagram: "marco.bocconi" }, [["helper", "BOC", null]]],
  ["ines", "Inês", "LIS", { instagram: "ines.lisboa" }, [["helper", "LIS", null]]],
  ["tomek", "Tomek", "UJ", { facebook: "https://facebook.com/tomek.example" }, [["going", "LIS", "2027S"]]],
  ["ania", "Ania D.", "UW", { instagram: "ania.uw" }, [["helper", "UW", null]]],
];

for (const [key, name, home, contacts, entries] of PEOPLE) {
  const { data, error } = await admin.auth.admin.createUser({ email: `${key}@${DOMAIN}`, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  const id = data.user.id;
  const buddy = entries.some(([kind]) => kind === "helper");
  const exchanges = entries.filter(([kind]) => kind !== "helper");
  const p = await admin.from("simple_people").insert({ user_id: id, display_name: name, home_institution_id: U[home], is_buddy: buddy, looking_for_housing: key === "kuba" || key === "zuza", ...contacts });
  if (p.error) throw new Error(`${key}: ${p.error.message}`);
  if (exchanges.length) {
    const e = await admin.from("simple_entries").insert(exchanges.map(([kind, uni, semester]) => ({ user_id: id, kind, institution_id: U[uni], semester })));
    if (e.error) throw new Error(`${key}: ${e.error.message}`);
  }
}
console.log(`✅ Utworzono ${PEOPLE.length} osób pokazowych (Mediolan, Warszawa, Lizbona).`);
