"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, key: string, max = 5000) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function startConversation(formData: FormData) {
  const other = text(formData, "user_id");
  const { supabase } = await requireUser(`/u/${other}`);
  const { data, error } = await supabase.rpc("get_or_create_conversation", { other_user: other });
  // Osoba mogła w międzyczasie usunąć konto (np. nieaktualna lista) – wracamy do listy zamiast błędu
  if (error || !data) redirect("/people");
  redirect(`/messages/${data}`);
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
