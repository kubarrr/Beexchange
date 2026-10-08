// Sprzątanie przed startem wersji prostej (po migracji 0013):
//  • usuwa foldery ze zdjęciami pełnej wersji (avatars, events, rooms, places) razem z plikami,
//  • usuwa konta pokazowe i testowe (*.beexchange.local).
// Uruchom: node scripts/cleanup-full-version.mjs   (najpierw bez --yes pokazuje, co usunie)
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const YES = process.argv.includes("--yes");

const BUCKETS = ["avatars", "events", "rooms", "places"];
const { data: buckets } = await admin.storage.listBuckets();
const existing = (buckets ?? []).map((b) => b.id).filter((id) => BUCKETS.includes(id));

const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
const fake = users.users.filter((u) => u.email?.endsWith(".beexchange.local"));

console.log(`Foldery do usunięcia: ${existing.join(", ") || "brak"}`);
console.log(`Konta pokazowe/testowe do usunięcia: ${fake.length}`);
console.log(`Prawdziwe konta, które zostają: ${users.users.length - fake.length}`);
if (!YES) {
  console.log("\nTo był podgląd. Żeby usunąć, uruchom ponownie z --yes");
  process.exit(0);
}

for (const id of existing) {
  const empty = await admin.storage.emptyBucket(id);
  const del = await admin.storage.deleteBucket(id);
  console.log(`${del.error || empty.error ? "❌" : "✓"} folder ${id}${del.error ? `: ${del.error.message}` : ""}`);
}
for (const u of fake) await admin.auth.admin.deleteUser(u.id);
console.log(`✓ usunięto ${fake.length} kont pokazowych/testowych`);
