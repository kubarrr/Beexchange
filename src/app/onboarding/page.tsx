import type { Metadata } from "next";
import { ProfileForm } from "@/components/ProfileForm";
import { MY_PROFILE_SELECT, requireUser, type MyProfile } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { toProfileFormInitial } from "@/lib/profile-initial";

export const metadata: Metadata = { title: "Start" };

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser("/onboarding");
  const { locale } = await getDictionary();
  const { data } = await supabase.from("profiles").select(MY_PROFILE_SELECT).eq("id", userId).single();

  return <ProfileForm locale={locale} userId={userId} mode="onboarding" initial={toProfileFormInitial(data as unknown as MyProfile)} />;
}
