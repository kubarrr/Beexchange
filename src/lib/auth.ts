import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INSTITUTION_FIELDS, type Institution, type Status } from "@/lib/domain";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return { supabase, userId };
}

export async function requireUser(next = "/") {
  const { supabase, userId } = await getCurrentUser();
  if (!userId) redirect(`/login?next=${encodeURIComponent(next)}`);
  return { supabase, userId };
}

export type MyProfile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  status: Status;
  semester: string | null;
  field_of_study: string;
  study_year: string | null;
  passions: string[];
  languages: string[];
  bio: string;
  open_to_questions: boolean;
  wants_buddy: boolean;
  looking_for_housing: boolean;
  helps_departure: boolean;
  checks_housing: boolean;
  stage_choice: string | null;
  stage_semester: string | null;
  home_institution_id: number | null;
  exchange_institution_id: number | null;
  home: Institution | null;
  exchange: Institution | null;
  homes: HomeRow[];
  exchanges: ExchangeRow[];
};

export type HomeRow = { institution_id: number; field_of_study: string; faculty: string | null; study: string | null; position: number; institution: Institution };
export type ExchangeRow = { id: number; institution_id: number; semester: string; status: "going" | "been"; institution: Institution };

export const MY_PROFILE_SELECT = `id, full_name, avatar_url, status, semester, field_of_study, study_year, passions, languages, bio,
  open_to_questions, wants_buddy, looking_for_housing, helps_departure, checks_housing, stage_choice, stage_semester, home_institution_id, exchange_institution_id,
  home:institutions!profiles_home_institution_id_fkey(${INSTITUTION_FIELDS}),
  exchange:institutions!profiles_exchange_institution_id_fkey(${INSTITUTION_FIELDS}),
  homes:profile_homes(institution_id, field_of_study, faculty, study, position, institution:institutions(${INSTITUTION_FIELDS})),
  exchanges(id, institution_id, semester, status, institution:institutions(${INSTITUTION_FIELDS}))`;

// Zalogowany użytkownik z uzupełnionym profilem, inaczej przekierowanie do logowania lub onboardingu
export async function requireProfile(next = "/swarm") {
  const { supabase, userId } = await requireUser(next);
  const { data } = await supabase.from("profiles").select(MY_PROFILE_SELECT).eq("id", userId).single();
  const profile = data as unknown as MyProfile | null;
  if (!profile?.home_institution_id) redirect("/onboarding");
  profile.homes = [...(profile.homes ?? [])].sort((a, b) => a.position - b.position);
  profile.exchanges = [...(profile.exchanges ?? [])].sort((a, b) => (a.status === b.status ? b.semester.localeCompare(a.semester) : a.status === "going" ? -1 : 1));
  return { supabase, userId, profile };
}

// Liczba nieprzeczytanych wiadomości (rozmowy i grupy) plus oczekujące prośby o buddy, raz na żądanie
export const unreadTotal = cache(async () => {
  const { supabase, userId } = await getCurrentUser();
  if (!userId) return 0;
  const { data } = await supabase.rpc("unread_threads");
  return ((data ?? []) as { unread: number }[]).reduce((n, r) => n + r.unread, 0);
});
