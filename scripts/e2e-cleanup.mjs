// Usuwa boty testowe (…@test.beexchange.local) zostawione przez `npm run test:e2e -- --keep`.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
const bots = data.users.filter((u) => u.email?.endsWith("@test.beexchange.local"));
for (const b of bots) {
  const { data: files } = await admin.storage.from("avatars").list(b.id);
  if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${b.id}/${f.name}`));
  await admin.from("institutions").delete().eq("added_by", b.id).eq("status", "pending");
  await admin.auth.admin.deleteUser(b.id);
}
const { data: groups } = await admin.from("groups").select("id, group_members(count)");
const empty = (groups ?? []).filter((g) => !g.group_members?.[0]?.count).map((g) => g.id);
if (empty.length) await admin.from("groups").delete().in("id", empty);
console.log(`Usunięto ${bots.length} botów i ${empty.length} pustych grup.`);
