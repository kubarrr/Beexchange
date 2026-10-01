import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { myCities } from "@/lib/places";
import { RoomForm } from "./RoomForm";

export const generateMetadata = localizedTitle((t) => t.housing.newTitle);

export default async function NewRoomPage({ searchParams }: PageProps<"/mieszkania/nowy">) {
  const sp = await searchParams;
  const { userId, profile } = await requireProfile("/mieszkania/nowy");
  const { t, locale } = await getDictionary();
  // Pokój można wystawić tylko w mieście swojej wymiany albo uczelni (pilnuje tego też baza)
  const places = [...myCities(profile).values()].map((p) => ({ ...p, label: cityName(p.city, locale) }));
  const wanted = places.find((p) => p.cc === sp.cc && p.city.toLowerCase() === String(sp.city ?? "").toLowerCase());

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <div className="flex items-center gap-3">
        <Link href="/mieszkania" aria-label={t.common.back} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-[1.5px] border-line bg-white">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </Link>
        <h1 className="display text-[28px] leading-tight">{t.housing.newTitle}</h1>
      </div>
      <p className="text-sm text-muted">{t.housing.newLead}</p>
      <RoomForm locale={locale} userId={userId} places={places} initial={wanted ? `${wanted.cc}:${wanted.city}` : ""} />
    </div>
  );
}
