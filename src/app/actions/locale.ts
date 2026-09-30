"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";

export async function setLocale(formData: FormData) {
  const lang = formData.get("lang") === "en" ? "en" : "pl";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });

  // Język zalogowanego użytkownika zapisujemy też w koncie, żeby maile przychodziły w tym języku
  const { supabase, userId } = await getCurrentUser();
  if (userId) {
    await Promise.all([supabase.auth.updateUser({ data: { locale: lang } }), supabase.from("profiles").update({ locale: lang }).eq("id", userId)]);
  }
  revalidatePath("/", "layout");
}
