import type { MyProfile } from "@/lib/auth";
import type { ProfileFormInitial } from "@/components/ProfileForm";

export function toProfileFormInitial(p: MyProfile): ProfileFormInitial {
  const homes = [...(p.homes ?? [])].sort((a, b) => a.position - b.position);
  return {
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    homes: homes.length
      ? homes.map((h) => ({ inst: h.institution, field: h.field_of_study, study: h.study ?? "" }))
      : p.home
        ? [{ inst: p.home, field: p.field_of_study, study: p.study_year ?? "" }]
        : [],
    exchanges: (p.exchanges ?? []).map((x) => ({ inst: x.institution, semester: x.semester, status: x.status })),
    passions: p.passions ?? [],
    languages: Array.isArray(p.languages) ? p.languages : [],
    bio: p.bio,
    open_to_questions: p.open_to_questions,
    wants_buddy: p.wants_buddy,
  };
}
