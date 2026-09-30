import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { EventForm } from "./EventForm";

export const generateMetadata = localizedTitle((t) => t.events.newTitle);

export default async function NewEventPage() {
  const { profile } = await requireProfile("/wydarzenia/nowe");
  const { t, locale } = await getDictionary();

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/wydarzenia" aria-label={t.common.back} className="flex h-11 w-11 items-center justify-center rounded-2xl border-[1.5px] border-line bg-white">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </Link>
        <h1 className="display text-[28px]">{t.events.newTitle}</h1>
      </div>
      <EventForm locale={locale} defaultCountry={profile.home?.country_code ?? "PL"} />
    </div>
  );
}
