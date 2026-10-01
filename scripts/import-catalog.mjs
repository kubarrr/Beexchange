// Wgrywa oficjalne wydziały i kierunki z data/catalog.json do tabeli institution_catalog.
// Uruchom: npm run import:catalog   (wymaga SUPABASE_SECRET_KEY w .env.local i migracji 0006)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const catalog = JSON.parse(readFileSync("data/catalog.json", "utf8"));

let total = 0;
for (const [uniName, { faculties = [], fields = [] }] of Object.entries(catalog)) {
  if (uniName.startsWith("_")) continue;
  const { data: inst, error } = await admin.from("institutions").select("id").eq("name", uniName).limit(1).maybeSingle();
  if (error || !inst) {
    console.error(`❌ Nie znaleziono uczelni „${uniName}”`);
    process.exitCode = 1;
    continue;
  }
  const rows = [
    ...faculties.map((name) => ({ institution_id: inst.id, kind: "faculty", name })),
    ...fields.map((name) => ({ institution_id: inst.id, kind: "field", name })),
  ];
  // Pełna podmiana listy dla uczelni, żeby usunąć nazwy, których już nie ma w pliku
  await admin.from("institution_catalog").delete().eq("institution_id", inst.id);
  const { error: e2 } = await admin.from("institution_catalog").insert(rows);
  if (e2) {
    console.error(`❌ ${uniName}: ${e2.message}`);
    process.exitCode = 1;
    continue;
  }
  total += rows.length;
  console.log(`✓ ${uniName}: ${faculties.length} wydziałów, ${fields.length} kierunków`);
}
console.log(`Gotowe: ${total} wpisów.`);
