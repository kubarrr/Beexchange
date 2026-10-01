"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { INSTITUTION_FIELDS, type Institution } from "@/lib/domain";
import { PASSION_KEYS } from "@/lib/i18n/dictionaries";

export type HomeInput = { institution_id: number; field_of_study: string; study: string; faculty?: string };
export type ExchangeInput = { institution_id: number; semester: string; status: "going" | "been" };

export type ProfileInput = {
  full_name: string;
  avatar_url?: string | null;
  homes: HomeInput[];
  exchanges: ExchangeInput[];
  passions: string[];
  languages: string[];
  bio: string;
  open_to_questions: boolean;
  wants_buddy: boolean;
};

const clip = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);
const STUDY = /^(bachelor|engineer|master|long|phd|graduate)(:\d)?$/;
const LANG = /^[a-z]{2}:(native|C2|C1|B2|B1|A2|A1)$/;

export async function saveProfile(input: ProfileInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, userId } = await requireUser("/profil");

  const homes = (input.homes ?? [])
    .filter((h) => Number.isInteger(h.institution_id))
    .filter((h, i, all) => all.findIndex((x) => x.institution_id === h.institution_id) === i)
    .slice(0, 4)
    .map((h, position) => ({
      user_id: userId,
      institution_id: h.institution_id,
      field_of_study: clip(h.field_of_study, 120),
      faculty: clip(h.faculty, 120) || null,
      study: STUDY.test(h.study ?? "") ? h.study : null,
      position,
    }));
  const exchanges = (input.exchanges ?? [])
    .filter((x) => Number.isInteger(x.institution_id) && /^\d{4}[WS]$/.test(x.semester ?? ""))
    .filter((x, i, all) => all.findIndex((y) => y.institution_id === x.institution_id && y.semester === x.semester) === i)
    .slice(0, 6)
    .map((x) => ({ user_id: userId, institution_id: x.institution_id, semester: x.semester, status: x.status === "been" ? "been" : "going" }));

  const fullName = clip(input.full_name, 80);
  if (!fullName) return { ok: false, error: "name" };
  if (!homes.length) return { ok: false, error: "home" };

  // Główna wymiana w profilu: najbliższa nadchodząca/trwająca, a jeśli brak, ostatnia zakończona
  const going = exchanges.filter((x) => x.status === "going").sort((a, b) => a.semester.localeCompare(b.semester));
  const been = exchanges.filter((x) => x.status === "been").sort((a, b) => b.semester.localeCompare(a.semester));
  const main = going[0] ?? been[0] ?? null;
  const status = going.length ? "going" : been.length ? "been" : "searching";

  const update: Record<string, unknown> = {
    full_name: fullName,
    status,
    home_institution_id: homes[0].institution_id,
    field_of_study: homes[0].field_of_study,
    study_year: homes[0].study,
    exchange_institution_id: main?.institution_id ?? null,
    semester: main?.semester ?? null,
    passions: (input.passions ?? []).filter((p) => (PASSION_KEYS as readonly string[]).includes(p)),
    languages: (input.languages ?? []).filter((l) => LANG.test(l)).slice(0, 8),
    bio: clip(input.bio, 1000),
    open_to_questions: !!input.open_to_questions,
    wants_buddy: !!input.wants_buddy,
    onboarded: true,
  };
  if (input.avatar_url !== undefined) update.avatar_url = input.avatar_url;

  const { error } = await supabase.from("profiles").update(update).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  // Listy uczelni i wymian zapisujemy w całości
  const e1 = (await supabase.from("profile_homes").delete().eq("user_id", userId)).error;
  const e2 = e1 ?? (await supabase.from("profile_homes").insert(homes)).error;
  const e3 = e2 ?? (await supabase.from("exchanges").delete().eq("user_id", userId)).error;
  const e4 = e3 ?? (exchanges.length ? (await supabase.from("exchanges").insert(exchanges)).error : null);
  if (e4) return { ok: false, error: e4.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addInstitution(input: { name: string; country_code: string; city: string; website: string }): Promise<Institution> {
  const { supabase, userId } = await requireUser("/profil");
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

export async function joinGroup(formData: FormData) {
  const kind = String(formData.get("kind"));
  const exchangeId = Number(formData.get("exchange_id")) || null;
  const homeId = Number(formData.get("home_id")) || null;
  const { supabase } = await requireUser("/roj");
  const { data, error } = await supabase.rpc("join_group", { p_kind: kind, p_exchange_id: exchangeId, p_home_id: homeId });
  if (error) throw new Error(error.message);
  revalidatePath("/roj");
  redirect(`/grupy/${data}`);
}

export async function leaveGroup(formData: FormData) {
  const groupId = Number(formData.get("group_id"));
  const { supabase, userId } = await requireUser("/roj");
  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  revalidatePath("/roj");
  redirect("/roj");
}

export async function requestBuddy(formData: FormData) {
  const to = String(formData.get("user_id"));
  const { supabase, userId } = await requireUser(`/u/${to}`);
  await supabase.from("buddy_requests").upsert({ from_user: userId, to_user: to, status: "pending" }, { onConflict: "from_user,to_user", ignoreDuplicates: true });
  revalidatePath(`/u/${to}`);
  revalidatePath("/roj");
}

export async function answerBuddy(formData: FormData) {
  const id = Number(formData.get("id"));
  const accept = formData.get("accept") === "1";
  const { supabase } = await requireUser("/czaty");
  const { data: req } = await supabase.from("buddy_requests").update({ status: accept ? "accepted" : "declined" }).eq("id", id).select("from_user").single();
  revalidatePath("/czaty");
  if (accept && req) {
    const { data: conv } = await supabase.rpc("get_or_create_conversation", { other_user: req.from_user });
    if (conv) redirect(`/wiadomosci/${conv}`);
  }
}

export async function createEvent(formData: FormData) {
  const { supabase, userId } = await requireUser("/wydarzenia/nowe");
  const online = formData.get("is_online") === "on";
  const startsAt = new Date(String(formData.get("starts_at_iso") ?? ""));
  if (Number.isNaN(startsAt.getTime())) throw new Error("invalid date");
  const audience = String(formData.get("audience"));
  // Zdjęcie przyjmujemy tylko z własnego folderu w naszym Storage
  const cover = clip(formData.get("cover_url"), 400);
  const coverPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/events/${userId}/`;

  const { error } = await supabase.from("events").insert({
    title: clip(formData.get("title"), 150),
    description: clip(formData.get("description"), 3000),
    starts_at: startsAt.toISOString(),
    is_online: online,
    city: online ? null : clip(formData.get("city"), 80) || null,
    country_code: online ? null : clip(formData.get("country_code"), 2).toUpperCase() || null,
    location: online ? null : clip(formData.get("location"), 200) || null,
    link: clip(formData.get("link"), 300) || null,
    audience: ["all", "alumni", "going"].includes(audience) ? audience : "all",
    cover_url: cover.startsWith(coverPrefix) ? cover : null,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/wydarzenia");
  redirect("/wydarzenia");
}

export async function deleteEvent(formData: FormData) {
  const { supabase, userId } = await requireUser("/wydarzenia");
  const { data: ev } = await supabase.from("events").delete().eq("id", Number(formData.get("id"))).eq("created_by", userId).select("cover_url").maybeSingle();
  const path = ev?.cover_url?.split("/storage/v1/object/public/events/")[1];
  if (path) await supabase.storage.from("events").remove([path]);
  revalidatePath("/wydarzenia");
}

export async function toggleAttend(formData: FormData) {
  const id = Number(formData.get("id"));
  const { supabase, userId } = await requireUser("/wydarzenia");
  if (formData.get("going") === "1") {
    await supabase.from("event_attendees").delete().eq("event_id", id).eq("user_id", userId);
  } else {
    await supabase.from("event_attendees").insert({ event_id: id, user_id: userId });
  }
  revalidatePath("/wydarzenia");
}

export async function joinGroupById(formData: FormData) {
  const groupId = Number(formData.get("group_id"));
  const { supabase } = await requireUser(`/grupy/${groupId}`);
  const { error } = await supabase.rpc("join_group_by_id", { p_group_id: groupId });
  if (error) throw new Error(error.message);
  revalidatePath("/roj");
  redirect(`/grupy/${groupId}`);
}

export async function createGroup(formData: FormData) {
  const { supabase } = await requireUser("/grupy");
  const { data, error } = await supabase.rpc("create_group", {
    p_kind: String(formData.get("kind")),
    p_sem: String(formData.get("semester")),
    p_inst: Number(formData.get("institution_id")) || null,
    p_cc: String(formData.get("country_code") ?? "") || null,
    p_city: String(formData.get("city") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/grupy");
  redirect(`/grupy/${data}`);
}

// RODO: usunięcie konta ze wszystkimi danymi
export async function deleteAccount(formData: FormData) {
  const { supabase, userId } = await requireUser("/profil");
  const word = String(formData.get("confirm") ?? "").trim().toUpperCase();
  if (word !== "USUŃ" && word !== "DELETE") return;

  const { data: files } = await supabase.storage.from("avatars").list(userId);
  if (files?.length) await supabase.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
  const { data: eventFiles } = await supabase.storage.from("events").list(userId);
  if (eventFiles?.length) await supabase.storage.from("events").remove(eventFiles.map((f) => `${userId}/${f.name}`));
  const { error } = await supabase.rpc("delete_my_account");
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
