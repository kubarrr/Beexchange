import { signOut } from "@/app/actions";
import type { EntryKind } from "@/app/actions/simple";
import { DeleteAccount } from "@/components/DeleteAccount";
import { requireUser } from "@/lib/auth";
import { INSTITUTION_FIELDS, type Institution } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { MeForm, type MeInitial } from "./MeForm";

export const generateMetadata = localizedTitle((t) => t.simple.meTitle);

export default async function MePage() {
  const { supabase, userId } = await requireUser("/me");
  const { t, locale } = await getDictionary();

  const [{ data: person }, { data: entries }, { data: auth }] = await Promise.all([
    supabase.from("simple_people").select(`display_name, instagram, facebook, whatsapp, looking_for_housing, is_buddy, home:institutions(${INSTITUTION_FIELDS})`).eq("user_id", userId).maybeSingle(),
    supabase.from("simple_entries").select(`kind, semester, inst:institutions(${INSTITUTION_FIELDS})`).eq("user_id", userId).order("created_at"),
    // Imię z konta Google jako podpowiedź przy pierwszym wpisie
    supabase.auth.getUser(),
  ]);

  const initial: MeInitial = {
    display_name: person?.display_name ?? String(auth.user?.user_metadata?.full_name ?? auth.user?.user_metadata?.name ?? ""),
    home: (person?.home as unknown as Institution | null) ?? null,
    instagram: person?.instagram ?? "",
    facebook: person?.facebook ?? "",
    whatsapp: person?.whatsapp ?? "",
    looking_for_housing: person?.looking_for_housing ?? false,
    is_buddy: person?.is_buddy ?? false,
    // Wpisy „pomogę” z wcześniejszej wersji zastąpił znacznik 🧸 buddy
    entries: ((entries ?? []) as unknown as { kind: string; semester: string | null; inst: Institution | null }[])
      .filter((e) => e.kind !== "helper")
      .map((e) => ({ kind: "exchange" as EntryKind, inst: e.inst, semester: e.semester })),
  };

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div>
          <h1 className="display text-[30px] leading-tight">{t.simple.meTitle}</h1>
          <p className="mt-1 text-sm text-muted">{t.simple.meLead}</p>
        </div>
        <MeForm locale={locale} initial={initial} />
        <form action={signOut} className="text-center">
          <button className="min-h-11 text-sm font-semibold underline">{t.simple.signOut}</button>
        </form>
      </div>
      <DeleteAccount locale={locale} />
    </>
  );
}
