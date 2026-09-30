import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/bx";
import { DesktopNav } from "@/components/AppNav";
import { getCurrentUser, unreadTotal } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { setLocale } from "@/app/actions/locale";

export async function Header() {
  const { supabase, userId } = await getCurrentUser();
  const { t, locale } = await getDictionary();
  const profile = userId ? (await supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).single()).data : null;
  const unread = await unreadTotal();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-2.5">
        <Link href={userId ? "/roj" : "/"} aria-label="BeeXchange">
          <Logo />
        </Link>
        {userId && <DesktopNav locale={locale} unread={unread} />}
        <div className="ml-auto flex items-center gap-2">
          <form action={setLocale} className="flex rounded-full bg-ink p-[3px]">
            {(["pl", "en"] as const).map((l) => (
              <button
                key={l}
                name="lang"
                value={l}
                aria-pressed={locale === l}
                className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${locale === l ? "bg-honey text-ink" : "text-cream"}`}
              >
                {l}
              </button>
            ))}
          </form>
          {userId ? (
            <Link href="/profil" className="hidden md:block" aria-label={t.nav.profile}>
              <Avatar name={profile?.full_name ?? ""} url={profile?.avatar_url} size={36} />
            </Link>
          ) : (
            <Link href="/login" className="btn-honey min-h-9">
              {t.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
