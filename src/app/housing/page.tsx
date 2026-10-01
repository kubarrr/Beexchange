import Link from "next/link";
import { CalendarDays, MapPin, MessageSquare, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { startConversation } from "@/app/actions";
import { deleteRoom, setRoomTaken } from "@/app/actions/bx";
import { EmptyState, Flag, PageTitle } from "@/components/bx";
import { PERSON_SELECT, PersonCard, personBadges, type Person } from "@/components/PersonCard";
import { PhotoBanner, loadPlacePhotos, placeKey } from "@/components/PlacePhoto";
import { ReportButton } from "@/components/ReportButton";
import { requireProfile } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { formatPrice, myCities } from "@/lib/places";
import { CheckRequest } from "./HousingClient";
import { CitySearch } from "@/components/CitySearch";

export const generateMetadata = localizedTitle((t) => t.nav.housing);

type Room = {
  id: number;
  author_id: string;
  country_code: string;
  city: string;
  kind: "room" | "shared" | "flat";
  title: string;
  description: string;
  price: number;
  currency: string;
  available_from: string;
  available_to: string | null;
  area: string | null;
  photos: string[];
  taken: boolean;
  author: Person;
};

const TABS = ["rooms", "flatmates", "check"] as const;
type Tab = (typeof TABS)[number];

export default async function HousingPage({ searchParams }: PageProps<"/housing">) {
  const sp = await searchParams;
  const { supabase, userId, profile: me } = await requireProfile("/housing");
  const { t, locale } = await getDictionary();

  const mine = [...myCities(me).values()];
  const qCc = typeof sp.cc === "string" && /^[A-Z]{2}$/.test(sp.cc) ? sp.cc : "";
  const qCity = typeof sp.city === "string" ? sp.city.slice(0, 80) : "";
  // Domyślnie pierwsze z moich miast (najpierw wymiany trwające i przyszłe)
  const cc = qCity ? qCc : (mine[0]?.cc ?? "");
  const city = qCity || mine[0]?.city || "";
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "rooms";
  const here = (path: string) => `/housing?${new URLSearchParams({ cc, city, tab: path }).toString()}`;

  const [{ data: roomRows }, { data: flatRows }, { data: checkerRows }, { data: myReqs }] = city
    ? await Promise.all([
        supabase
          .from("rooms")
          .select(`id, author_id, country_code, city, kind, title, description, price, currency, available_from, available_to, area, photos, taken, author:profiles(${PERSON_SELECT})`)
          .eq("country_code", cc)
          .ilike("city", city)
          .order("taken")
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.rpc("flatmate_seekers", { p_cc: cc, p_city: city }).select(PERSON_SELECT),
        supabase.rpc("housing_checkers", { p_cc: cc, p_city: city }).select(PERSON_SELECT),
        supabase.from("check_requests").select("id, checker_id, status, created_at, checker:profiles!check_requests_checker_id_fkey(full_name)").eq("requester_id", userId).order("created_at", { ascending: false }).limit(20),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const rooms = (roomRows ?? []) as unknown as Room[];
  const flatmates = (flatRows ?? []) as unknown as Person[];
  const checkers = (checkerRows ?? []) as unknown as Person[];
  const requests = (myReqs ?? []) as unknown as { id: number; checker_id: string; status: keyof typeof t.housing.statuses; checker: { full_name: string } | null }[];
  const askedAlready = new Set(requests.filter((r) => r.status === "pending" || r.status === "accepted").map((r) => r.checker_id));
  const myHomeIds = me.homes.map((h) => h.institution_id);
  const meLooking = personBadges({ ...me, homes: me.homes, exchanges: me.exchanges } as unknown as Person).housing;
  const photo = city ? (await loadPlacePhotos(supabase, [{ cc, city }])).get(placeKey(cc, city)) : null;

  const dateFmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const fmt = (d: string) => dateFmt.format(new Date(`${d}T12:00:00`));
  const count = { rooms: rooms.filter((r) => !r.taken).length, flatmates: flatmates.length, check: checkers.length };

  const writeButton = (id: string) => (
    <form action={startConversation}>
      <input type="hidden" name="user_id" value={id} />
      <button aria-label={t.housing.write} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-honey">
        <MessageSquare size={20} strokeWidth={2.2} />
      </button>
    </form>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <PageTitle
        title={t.housing.title}
        lead={t.housing.lead}
        action={
          <Link href={`/housing/new${city ? `?cc=${cc}&city=${encodeURIComponent(city)}` : ""}`} className="btn-honey shrink-0 bg-ink text-honey hover:bg-black">
            <Plus size={16} strokeWidth={3} /> {t.housing.addRoom}
          </Link>
        }
      />

      <CitySearch locale={locale} current={city ? { cc, city } : null} mine={mine} basePath="/housing" extra={`tab=${tab}`} />

      <details className="group rounded-[20px] border-2 border-honey bg-white p-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-bold [&::-webkit-details-marker]:hidden">
          <ShieldCheck size={20} className="shrink-0" /> {t.housing.safetyTitle}
        </summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
          {t.housing.safety.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>

      {city && (
        <>
          {photo && (
            <PhotoBanner src={photo.url} credit={photo} t={t} className="h-28 rounded-[22px]">
              <p className="display flex items-center gap-2 p-4 pb-6 text-2xl text-cream">
                <Flag code={cc} className="h-4 w-6" />
                {cityName(city, locale)}
              </p>
            </PhotoBanner>
          )}

          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
            {TABS.map((k) => (
              <Link
                key={k}
                href={here(k)}
                aria-current={tab === k ? "page" : undefined}
                className={`flex min-h-11 items-center justify-center gap-1 rounded-xl text-sm font-semibold ${tab === k ? "bg-ink text-honey" : ""}`}
              >
                {{ rooms: t.housing.tabRooms, flatmates: t.housing.tabFlatmates, check: t.housing.tabCheck }[k]}
                <span className="text-xs opacity-70">{count[k]}</span>
              </Link>
            ))}
          </div>

          {tab === "rooms" &&
            (rooms.length === 0 ? (
              <EmptyState>{t.housing.noRooms}</EmptyState>
            ) : (
              <div className="space-y-4">
                {rooms.map((r) => (
                  <article key={r.id} className={`panel overflow-hidden ${r.taken ? "opacity-60" : ""}`}>
                    {r.photos.length > 0 && (
                      <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto">
                        {r.photos.map((src) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={src} src={src} alt="" loading="lazy" className="aspect-[4/3] w-[85%] shrink-0 snap-start object-cover first:w-full last:w-full" />
                        ))}
                      </div>
                    )}
                    <div className="space-y-2 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="display text-2xl">
                          {formatPrice(r.price, r.currency, locale)} <span className="text-sm font-normal text-muted">{t.housing.perMonth}</span>
                        </p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.taken ? "bg-ink text-honey" : "bg-honey"}`}>{r.taken ? t.housing.taken : t.housing.kinds[r.kind]}</span>
                      </div>
                      <h2 className="leading-tight font-bold break-words">{r.title}</h2>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={14} /> {t.housing.from} {fmt(r.available_from)}
                          {r.available_to && ` ${t.housing.to} ${fmt(r.available_to)}`}
                        </span>
                        {r.area && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={14} /> {r.area}
                          </span>
                        )}
                      </p>
                      {r.description && <p className="text-sm leading-relaxed whitespace-pre-line">{r.description}</p>}
                      <PersonCard p={r.author} locale={locale} t={t} viewerHomeIds={myHomeIds} action={r.author_id !== userId && writeButton(r.author_id)} className="rounded-2xl bg-cream p-3" />
                      <div className="flex items-center justify-end gap-2">
                        {r.author_id === userId ? (
                          <>
                            <form action={setRoomTaken}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="taken" value={r.taken ? "0" : "1"} />
                              <button className="btn-outline min-h-10">{r.taken ? t.housing.markFree : t.housing.markTaken}</button>
                            </form>
                            <form action={deleteRoom}>
                              <input type="hidden" name="id" value={r.id} />
                              <button aria-label={t.housing.delete} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-red-700">
                                <Trash2 size={17} />
                              </button>
                            </form>
                          </>
                        ) : (
                          <ReportButton type="room" id={r.id} locale={locale} />
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}

          {tab === "flatmates" && (
            <div className="space-y-3">
              <p className="text-sm text-muted">{t.housing.flatmatesLead}</p>
              {!meLooking && (
                <Link href="/profile" className="block rounded-2xl bg-sand px-4 py-3 text-sm font-semibold hover:bg-honey">
                  {t.housing.meToo}
                </Link>
              )}
              {flatmates.length === 0 ? (
                <EmptyState>{t.housing.noFlatmates}</EmptyState>
              ) : (
                flatmates.map((p) => <PersonCard key={p.id} p={p} locale={locale} t={t} viewerHomeIds={myHomeIds} action={writeButton(p.id)} />)
              )}
            </div>
          )}

          {tab === "check" && (
            <div className="space-y-3">
              <div className="rounded-[20px] bg-sand p-4">
                <h2 className="display text-lg">{t.housing.checkTitle}</h2>
                <p className="mt-1 text-sm">{t.housing.checkLead}</p>
              </div>
              {checkers.length === 0 ? (
                <EmptyState>{t.housing.noCheckers}</EmptyState>
              ) : (
                checkers.map((p) => (
                  <div key={p.id} className="panel space-y-3 p-3.5">
                    <PersonCard p={p} locale={locale} t={t} viewerHomeIds={myHomeIds} className="" />
                    <div className="flex justify-end">
                      <CheckRequest locale={locale} checkerId={p.id} cc={cc} city={city} sent={askedAlready.has(p.id)} />
                    </div>
                  </div>
                ))
              )}
              {requests.length > 0 && (
                <section className="space-y-2 pt-2">
                  <h3 className="label-caps">{t.housing.myRequests}</h3>
                  {requests.map((r) => (
                    <p key={r.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-2.5 text-sm">
                      <span className="font-semibold">{r.checker?.full_name}</span>
                      <span className="text-muted">{t.housing.statuses[r.status]}</span>
                    </p>
                  ))}
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
