// Wgrywa data/institutions.json do tabeli public.institutions w Supabase.
// Wymaga w .env.local: NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SECRET_KEY (klucz secret, NIGDY z NEXT_PUBLIC_).
// Uruchom: npm run import:institutions
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SECRET_KEY w .env.local");
  process.exit(1);
}

// Potoczne skróty, których nie ma w ROR, a studenci ich szukają
const EXTRA_ACRONYMS = {
  "Politecnico di Milano": "PoliMi",
  "Politecnico di Torino": "PoliTo",
  "Bocconi University": "Bocconi",
  "University of Bologna": "UniBo",
  "University of Padua": "UniPd",
  "University of Milan": "UniMi",
  "University of Florence": "UniFi",
  "University of Turin": "UniTo",
  "Sapienza University of Rome": "Sapienza",
  "Warsaw University of Technology": "PW",
  "University of Warsaw": "UW",
  "Jagiellonian University": "UJ",
  "AGH University of Krakow": "AGH",
  "Wrocław University of Science and Technology": "PWr",
  "Gdańsk University of Technology": "PG",
  "Lodz University of Technology": "PŁ",
  "Adam Mickiewicz University in Poznań": "UAM",
  "Kozminski University": "ALK",
  "Poznań University of Economics and Business": "UEP",
  "Krakow University of Economics": "UEK",
  "Wroclaw University of Economics and Business": "UEW",
  "University of Economics in Katowice": "UE Katowice",
};

const fold = (s) =>
  (s ?? "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const CITY_PL = JSON.parse(readFileSync("src/lib/cities-pl.json", "utf8"));
const data = JSON.parse(readFileSync("data/institutions.json", "utf8"));
const rows = data.map((r) => {
  const extra = EXTRA_ACRONYMS[r.name];
  const acronyms = extra ? [extra, ...r.acronyms] : r.acronyms;
  return {
    ror_id: r.ror,
    name: r.name,
    name_en: r.name_en,
    name_pl: r.name_pl,
    acronym: acronyms[0] ?? null,
    search_text: fold([r.name, ...r.labels, ...acronyms, ...r.aliases, r.city, CITY_PL[(r.city ?? "").toLowerCase()]].filter(Boolean).join(" | ")),
    country_code: r.cc,
    city: r.city,
    website: r.website,
    status: "approved",
  };
});

const supabase = createClient(url, key, { auth: { persistSession: false } });
const BATCH = 500;
for (let i = 0; i < rows.length; i += BATCH) {
  const { error } = await supabase.from("institutions").upsert(rows.slice(i, i + BATCH), { onConflict: "ror_id" });
  if (error) {
    console.error("Błąd przy partii", i / BATCH + 1, error.message);
    process.exit(1);
  }
  console.log(`Wgrano ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
}
console.log("Gotowe!");
