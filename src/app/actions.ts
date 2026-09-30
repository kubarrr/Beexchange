"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string, max = 5000) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function int(formData: FormData, key: string) {
  const n = parseInt(String(formData.get(key) ?? ""), 10);
  return Number.isFinite(n) ? n : null;
}

function rating(formData: FormData, key: string) {
  const n = int(formData, key);
  if (n === null || n < 1 || n > 5) throw new Error(`Nieprawidłowa ocena: ${key}`);
  return n;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createReview(formData: FormData) {
  const slug = text(formData, "slug");
  const { supabase, userId } = await requireUser(`/uczelnie/${slug}`);

  const { error } = await supabase.from("reviews").upsert(
    {
      university_id: int(formData, "university_id"),
      author_id: userId,
      semester: text(formData, "semester", 30) || null,
      rating_university: rating(formData, "rating_university"),
      rating_city: rating(formData, "rating_city"),
      rating_social: rating(formData, "rating_social"),
      rating_housing: rating(formData, "rating_housing"),
      rating_exams: rating(formData, "rating_exams"),
      rent_paid: int(formData, "rent_paid"),
      neighborhood: text(formData, "neighborhood", 80) || null,
      body: text(formData, "body", 5000),
    },
    { onConflict: "university_id,author_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath(`/uczelnie/${slug}`);
  redirect(`/uczelnie/${slug}#opinie`);
}

export async function createCourseMatch(formData: FormData) {
  const slug = text(formData, "slug");
  const { supabase, userId } = await requireUser(`/uczelnie/${slug}`);
  const ects = parseFloat(String(formData.get("ects") ?? "").replace(",", "."));

  const { error } = await supabase.from("course_matches").insert({
    university_id: int(formData, "university_id"),
    author_id: userId,
    foreign_course: text(formData, "foreign_course", 200),
    ects: Number.isFinite(ects) ? ects : null,
    home_university: text(formData, "home_university", 120),
    home_course: text(formData, "home_course", 200),
    field_of_study: text(formData, "field_of_study", 120) || null,
    note: text(formData, "note", 500) || null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/uczelnie/${slug}`);
  redirect(`/uczelnie/${slug}#przedmioty`);
}

export async function deleteCourseMatch(formData: FormData) {
  const slug = text(formData, "slug");
  const { supabase } = await requireUser(`/uczelnie/${slug}`);
  await supabase.from("course_matches").delete().eq("id", int(formData, "id"));
  revalidatePath(`/uczelnie/${slug}`);
}

export async function createQuestion(formData: FormData) {
  const { supabase, userId } = await requireUser("/pytania/nowe");
  const title = text(formData, "title", 200);
  if (!title) throw new Error("Pytanie nie może być puste");

  // target: "c:<id miasta>" albo "u:<id uczelni>"
  const [kind, rawId] = text(formData, "target").split(":");
  const targetId = parseInt(rawId, 10);
  let cityId = targetId;
  let universityId: number | null = null;
  if (kind === "u") {
    const { data: uni } = await supabase.from("universities").select("city_id").eq("id", targetId).single();
    if (!uni) throw new Error("Nie ma takiej uczelni");
    cityId = uni.city_id;
    universityId = targetId;
  }

  const { data, error } = await supabase
    .from("questions")
    .insert({
      city_id: cityId,
      university_id: universityId,
      author_id: userId,
      title,
      body: text(formData, "body", 5000),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  redirect(`/pytania/${data.id}`);
}

export async function createAnswer(formData: FormData) {
  const questionId = int(formData, "question_id");
  const { supabase, userId } = await requireUser(`/pytania/${questionId}`);
  const body = text(formData, "body", 5000);
  if (!body) return;

  const { error } = await supabase.from("answers").insert({ question_id: questionId, author_id: userId, body });
  if (error) throw new Error(error.message);
  revalidatePath(`/pytania/${questionId}`);
}

export async function toggleVote(formData: FormData) {
  const questionId = int(formData, "question_id");
  const answerId = int(formData, "answer_id");
  const { supabase, userId } = await requireUser(`/pytania/${questionId}`);

  const { data: existing } = await supabase
    .from("answer_votes")
    .select("answer_id")
    .eq("answer_id", answerId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("answer_votes").delete().eq("answer_id", answerId).eq("user_id", userId);
  } else {
    await supabase.from("answer_votes").insert({ answer_id: answerId, user_id: userId });
  }
  revalidatePath(`/pytania/${questionId}`);
}

export async function createListing(formData: FormData) {
  const { supabase, userId } = await requireUser("/mieszkania/nowe");
  const title = text(formData, "title", 150);
  if (!title) throw new Error("Tytuł nie może być pusty");

  const { error } = await supabase.from("listings").insert({
    city_id: int(formData, "city_id"),
    author_id: userId,
    title,
    price: int(formData, "price"),
    description: text(formData, "description", 5000),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/mieszkania");
  redirect("/mieszkania");
}

export async function closeListing(formData: FormData) {
  const { supabase } = await requireUser("/mieszkania");
  await supabase.from("listings").update({ active: false }).eq("id", int(formData, "id"));
  revalidatePath("/mieszkania");
}

export async function startConversation(formData: FormData) {
  const other = text(formData, "user_id");
  const { supabase } = await requireUser(`/u/${other}`);
  const { data, error } = await supabase.rpc("get_or_create_conversation", { other_user: other });
  // Osoba mogła w międzyczasie usunąć konto (np. nieaktualna lista) – wracamy do listy zamiast błędu
  if (error || !data) redirect("/ludzie");
  redirect(`/wiadomosci/${data}`);
}

export async function toggleChecklistItem(formData: FormData) {
  const { supabase, userId } = await requireUser("/checklista");
  const key = text(formData, "key", 50);
  if (formData.get("done") === "1") {
    await supabase.from("checklist_progress").delete().eq("user_id", userId).eq("item_key", key);
  } else {
    await supabase.from("checklist_progress").insert({ user_id: userId, item_key: key });
  }
  revalidatePath("/checklista");
}

export async function reportContent(formData: FormData) {
  const { supabase, userId } = await requireUser("/");
  await supabase.from("reports").insert({
    reporter_id: userId,
    target_type: text(formData, "target_type", 30),
    target_id: text(formData, "target_id", 60),
    reason: text(formData, "reason", 500),
  });
}
