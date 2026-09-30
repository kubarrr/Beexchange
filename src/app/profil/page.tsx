import { ProfileForm } from "@/components/ProfileForm";
import { DeleteAccount } from "@/components/DeleteAccount";
import { requireProfile } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { toProfileFormInitial } from "@/lib/profile-initial";

export const generateMetadata = localizedTitle((t) => t.nav.profile);

export default async function MyProfilePage() {
  const { userId, profile } = await requireProfile("/profil");
  const { locale } = await getDictionary();
  return (
    <>
      <ProfileForm locale={locale} userId={userId} mode="edit" initial={toProfileFormInitial(profile)} />
      <DeleteAccount locale={locale} />
    </>
  );
}
