import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, GraduationCap, Hexagon } from "lucide-react";
import { BeeMark, Wordmark } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  const { userId } = await getCurrentUser();
  if (userId) redirect("/swarm");
  const { t } = await getDictionary();

  const features = [
    { Icon: Hexagon, title: t.landing.f1t, text: t.landing.f1d },
    { Icon: GraduationCap, title: t.landing.f2t, text: t.landing.f2d },
    { Icon: CalendarDays, title: t.landing.f3t, text: t.landing.f3d },
  ];

  return (
    <>
      {deleted === "1" && <p className="bg-ink px-4 py-3 text-center text-sm font-semibold text-honey">{t.profile.deleted}</p>}
      <section className="honeycomb relative overflow-hidden border-b-4 border-ink bg-honey">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 py-14 md:grid-cols-[1.3fr_1fr] md:py-20">
          <div className="space-y-6">
            <span className="inline-block -rotate-3 rounded-full bg-ink px-3 py-1.5 text-[13px] font-semibold text-honey">{t.landing.sticker}</span>
            <h1 className="display text-[44px] leading-[1] break-words sm:text-6xl">{t.landing.title}</h1>
            <p className="max-w-lg text-lg leading-relaxed">{t.landing.lead}</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/login" className="btn-primary min-h-14 px-7 text-lg">
                {t.landing.cta} <ArrowRight size={20} strokeWidth={2.5} />
              </Link>
              <Link href="/login" className="btn-outline min-h-14 px-6 text-base">
                {t.landing.haveAccount}
              </Link>
            </div>
          </div>
          <div className="hidden flex-col items-center gap-2 md:flex">
            <svg viewBox="0 0 400 110" className="w-full max-w-sm" aria-hidden="true">
              <path d="M10 100 C 90 100, 150 40, 250 64 S 330 60, 344 44" fill="none" stroke="#17140F" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" />
            </svg>
            <div className="-mt-24 ml-64 rotate-6">
              <BeeMark size={150} body="#FFF7E2" />
            </div>
            <Wordmark className="mt-2 text-5xl" />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-5 py-12 md:grid-cols-3">
        {features.map(({ Icon, title, text }) => (
          <div key={title} className="panel p-6">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-honey">
              <Icon size={22} />
            </span>
            <h2 className="display mt-4 text-xl">{title}</h2>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </section>
    </>
  );
}
