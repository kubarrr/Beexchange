import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { setLocale } from "@/app/actions/locale";

export async function Header() {
  const { userId } = await getCurrentUser();
  const { t, locale } = await getDictionary();

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
        <Link href="/" aria-label="BeeXchange">
          <Logo />
        </Link>
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
          <Link href={userId ? "/me" : "/login?next=/me"} className="btn-honey min-h-9 bg-ink text-honey hover:bg-black">
            {userId ? t.simple.myEntry : t.simple.addMe}
          </Link>
        </div>
      </div>
    </header>
  );
}
