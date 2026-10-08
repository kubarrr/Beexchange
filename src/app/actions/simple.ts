"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { INSTITUTION_FIELDS, semesterPhase, type Institution } from "@/lib/domain";

const clip = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

// W formularzu: wymiana (uczelnia + semestr) albo pomoc (sama uczelnia)
export type EntryKind = "exchange" | "helper";
export type MeInput = {
  display_name: string;
  home_institution_id: number | null;
  instagram: string;
  facebook: string;
  whatsapp: string;
  looking_for_housing: boolean;
  entries: { kind: EntryKind; institution_id: number; semester: string | null }[];
};

// Kontakty: z linków i „@nick” zostawiamy samą nazwę / numer, żeby przyciski zawsze działały
function normalizeContacts(input: { instagram: string; facebook: string; whatsapp: string }) {
  const ig = clip(input.instagram, 200)
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  const fbRaw = clip(input.facebook, 200);
  const fbPath = fbRaw.replace(/^https?:\/\/(www\.|m\.)?(facebook|fb)\.com\//i, "").replace(/^@/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
  const wa = clip(input.whatsapp, 30).replace(/[^\d+]/g, "");
  return {
    instagram: /^[A-Za-z0-9._]{1,30}$/.test(ig) ? ig : null,
    facebook: /^[A-Za-z0-9.\-_/=]{1,150}$/.test(fbPath) ? `https://facebook.com/${fbPath}` : null,
    whatsapp: /^\+?\d{6,20}$/.test(wa) ? wa : null,
  };
}

export async function saveMe(input: MeInput): Promise<{ ok: true } | { ok: false; error: "name" | "contact" | "entries" | string }> {
  const { supabase, userId } = await requireUser("/me");
  const name = clip(input.display_name, 60);
  if (name.length < 2) return { ok: false, error: "name" };
  const contacts = normalizeContacts(input);
  if (!contacts.instagram && !contacts.facebook && !contacts.whatsapp) return { ok: false, error: "contact" };

  const seen = new Set<string>();
  const entries = (input.entries ?? [])
    // wymiana musi mieć semestr — z niego wynika, czy osoba jedzie, czy już jest lub była
    .filter((e) => Number.isInteger(e.institution_id) && (e.kind === "helper" || (e.kind === "exchange" && /^\d{4}[WS]$/.test(e.semester ?? ""))))
    .map((e) => ({
      user_id: userId,
      kind: e.kind === "helper" ? "helper" : semesterPhase(e.semester) === "upcoming" ? "going" : "been",
      institution_id: e.institution_id,
      semester: e.kind === "helper" ? null : e.semester,
    }))
    .filter((e) => {
      const k = `${e.kind}:${e.institution_id}:${e.semester ?? ""}`;
      return !seen.has(k) && seen.add(k);
    })
    .slice(0, 10);
  if (!entries.length) return { ok: false, error: "entries" };

  const { error } = await supabase.from("simple_people").upsert({
    user_id: userId,
    display_name: name,
    home_institution_id: Number.isInteger(input.home_institution_id) ? input.home_institution_id : null,
    ...contacts,
    looking_for_housing: !!input.looking_for_housing,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  // Wpisy zapisujemy w całości
  const del = await supabase.from("simple_entries").delete().eq("user_id", userId);
  if (del.error) return { ok: false, error: del.error.message };
  const ins = await supabase.from("simple_entries").insert(entries);
  if (ins.error) return { ok: false, error: ins.error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function addInstitution(input: { name: string; country_code: string; city: string; website: string }): Promise<Institution> {
  const { supabase, userId } = await requireUser("/me");
  const name = clip(input.name, 200);
  const cc = clip(input.country_code, 2).toUpperCase();
  if (name.length < 4 || !/^[A-Z]{2}$/.test(cc)) throw new Error("invalid institution");
  const city = clip(input.city, 80) || null;
  const fold = (s: string) => s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const { data, error } = await supabase
    .from("institutions")
    .insert({
      name,
      country_code: cc,
      city,
      website: clip(input.website, 200) || null,
      search_text: fold([name, city].filter(Boolean).join(" | ")),
      status: "pending",
      added_by: userId,
    })
    .select(INSTITUTION_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return data as Institution;
}

// RODO: usunięcie konta razem z wpisem i kontaktami
export async function deleteAccount(formData: FormData) {
  const { supabase } = await requireUser("/me");
  const word = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (word !== "USUŃ" && word !== "DELETE") return;
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
