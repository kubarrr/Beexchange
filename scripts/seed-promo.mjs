// Przykładowi użytkownicy do filmików promocyjnych: PoliMi → Barcelona/UPC (EN) i SGH → Bocconi (PL).
// Uruchom: node scripts/seed-promo.mjs           (ponowne uruchomienie podmienia dane)
//          node scripts/seed-promo.mjs --clear   (usuwa — koniecznie po nagraniu!)
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const PROMO_DOMAIN = "promo.beexchange.local";

const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
const old = list.users.filter((u) => u.email?.endsWith(`@${PROMO_DOMAIN}`));
for (const u of old) await admin.auth.admin.deleteUser(u.id);
console.log(`Usunięto ${old.length} kont promocyjnych.`);
if (process.argv.includes("--clear")) process.exit(0);

const byName = async (name) => {
  const { data, error } = await admin.from("institutions").select("id").eq("name", name).limit(1).single();
  if (error) throw new Error(`Brak uczelni „${name}”`);
  return data.id;
};
const U = {
  UPC: await byName("Universitat Politècnica de Catalunya"),
  CHU: await byName("Charles University"),
  LUND: await byName("Lund University"),
  POLIMI: await byName("Politecnico di Milano"),
  TUM: await byName("Technical University of Munich"),
  UPM: await byName("Universidad Politécnica de Madrid"),
  KUL: await byName("KU Leuven"),
  TUD: await byName("Delft University of Technology"),
  SGH: await byName("SGH Warsaw School of Economics"),
  BOC: await byName("Bocconi University"),
  MANN: await byName("University of Mannheim"),
  WU: await byName("Vienna University of Economics and Business"),
  CBS: await byName("Copenhagen Business School"),
  TIL: await byName("Tilburg University"),
  LIS: await byName("University of Lisbon"),
};

// [klucz, imię, uczelnia macierzysta, kontakty, wymiany [uczelnia, semestr], 🧸 buddy, 🏠 szuka mieszkania]
// Semestry względem października 2026: 2027S/2027W = jadą, 2026W = są teraz, wcześniejsze = byli
const PEOPLE = [
  // ---- Barcelona / UPC ----
  ["luca", "Luca", "POLIMI", { instagram: "luca.promo" }, [["UPC", "2027S"]], false, true],
  ["sofia", "Sofia R.", "POLIMI", { whatsapp: "+393330000001" }, [["UPC", "2027S"]], false, false],
  ["lukas", "Lukas", "TUM", { instagram: "lukas.promo" }, [["UPC", "2027S"]], false, true],
  ["tereza", "Tereza", "CHU", { instagram: "tereza.promo", whatsapp: "+420600000001" }, [["UPC", "2027S"]], false, false],
  ["emma", "Emma V.", "KUL", { facebook: "https://facebook.com/emma.promo" }, [["UPC", "2027W"]], false, false],
  ["marco", "Marco", "POLIMI", { instagram: "marco.promo" }, [["UPC", "2026W"]], false, false],
  ["daan", "Daan", "TUD", { whatsapp: "+31600000001" }, [["UPC", "2026W"]], false, false],
  ["chiara", "Chiara", "POLIMI", { instagram: "chiara.promo" }, [["UPC", "2026S"]], true, false],
  ["alessandro", "Alessandro", "POLIMI", { whatsapp: "+393330000003" }, [["LUND", "2025W"]], true, false],
  ["pau", "Pau", "UPC", { instagram: "pau.promo", whatsapp: "+34600000001" }, [["POLIMI", "2025W"]], true, false],
  ["laia", "Laia", "UPC", { instagram: "laia.promo" }, [], true, false],
  ["jordi", "Jordi", "UPC", { facebook: "https://facebook.com/jordi.promo" }, [], true, false],
  // ---- Mediolan / Bocconi ----
  ["kasia", "Kasia", "SGH", { instagram: "kasia.promo" }, [["BOC", "2027S"]], false, true],
  ["wiktor", "Wiktor", "SGH", { whatsapp: "+48600000002" }, [["BOC", "2027S"]], false, false],
  ["hannah", "Hannah", "MANN", { instagram: "hannah.promo" }, [["BOC", "2027S"]], false, true],
  ["felix", "Felix", "WU", { whatsapp: "+43660000001" }, [["BOC", "2027S"]], false, false],
  ["freja", "Freja", "CBS", { instagram: "freja.promo" }, [["BOC", "2027W"]], false, false],
  ["maja", "Maja", "SGH", { instagram: "maja.promo" }, [["BOC", "2026W"]], false, false],
  ["jonas", "Jonas", "TIL", { instagram: "jonas.promo" }, [["BOC", "2026W"]], false, false],
  ["antek", "Antek", "SGH", { instagram: "antek.promo", whatsapp: "+48600000003" }, [["BOC", "2026S"]], true, false],
  ["ines", "Inês", "LIS", { instagram: "ines.promo" }, [["BOC", "2025W"]], false, false],
  ["matteo", "Matteo", "BOC", { instagram: "matteo.promo" }, [], true, false],
  ["francesca", "Francesca", "BOC", { instagram: "francesca.promo", whatsapp: "+393330000002" }, [["SGH", "2025W"]], true, false],
  ["giorgio", "Giorgio", "BOC", { facebook: "https://facebook.com/giorgio.promo" }, [], true, false],
  ["weronika", "Weronika", "SGH", { instagram: "weronika.promo" }, [["CBS", "2025W"]], true, false],
];

for (const [key, name, home, contacts, exchanges, buddy, housing] of PEOPLE) {
  const { data, error } = await admin.auth.admin.createUser({ email: `${key}@${PROMO_DOMAIN}`, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  const id = data.user.id;
  const p = await admin.from("simple_people").insert({ user_id: id, display_name: name, home_institution_id: U[home], is_buddy: buddy, looking_for_housing: housing, ...contacts });
  if (p.error) throw new Error(`${key}: ${p.error.message}`);
  if (exchanges.length) {
    const kind = (s) => (s > "2026W" ? "going" : "been");
    const e = await admin.from("simple_entries").insert(exchanges.map(([uni, semester]) => ({ user_id: id, kind: kind(semester), institution_id: U[uni], semester })));
    if (e.error) throw new Error(`${key}: ${e.error.message}`);
  }
}
console.log(`✅ Utworzono ${PEOPLE.length} osób promocyjnych (Barcelona/UPC, Mediolan/Bocconi).`);
