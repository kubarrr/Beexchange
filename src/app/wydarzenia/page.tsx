import Link from "next/link";
import { Globe, MapPin, Plus, Trash2 } from "lucide-react";
import { deleteEvent, toggleAttend } from "@/app/actions/bx";
import { EmptyState, Flag, PageTitle } from "@/components/bx";
import { LocalDate } from "@/components/LocalDate";
import { PhotoBanner, loadPlacePhotos, placeKey as photoKey } from "@/components/PlacePhoto";
import { cityName } from "@/lib/cities";
import { semesterPhase } from "@/lib/domain";
import { EventFilters } from "./EventFilters";
import { requireProfile } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";

export const generateMetadata = localizedTitle((t) => t.nav.events);

type EventRow = {
  id: number;
  title: string;
  description: string;
  starts_at: string;
  is_online: boolean;
  city: string | null;
  country_code: string | null;
  location: string | null;
  link: string | null;
  audience: "all" | "alumni" | "going";
  cover_url: string | null;
  created_by: string;
  event_attendees: { user_id: string }[];
};


// Pokazujemy też wydarzenia, które zaczęły się do 3 godzin temu
function recentCutoff() {
  return new Date(Date.now() - 3 * 3600 * 1000).toISOString();
}
const placeKey = (cc: string | null | undefined, city: string | null | undefined) => `${cc ?? ""}:${(city ?? "").toLowerCase()}`;

export default async function EventsPage({ searchParams }: PageProps<"/wydarzenia">) {
  const sp = await searchParams;
  const qCc = typeof sp.cc === "string" && /^[A-Z]{2}$/.test(sp.cc) ? sp.cc : "";
  const qCity = typeof sp.city === "string" ? sp.city.slice(0, 80) : "";
  const { supabase, userId, profile: me } = await requireProfile("/wydarzenia");

  // Moje miasta: najpierw miasta wymian (bieżących i przyszłych), potem uczelni macierzystych
  const myCities = new Map<string, { cc: string; city: string }>();
  const ordered = [
    ...me.exchanges.filter((x) => semesterPhase(x.semester) !== "past").map((x) => x.institution),
    ...me.homes.map((h) => h.institution),
    ...me.exchanges.map((x) => x.institution),
  ];
  for (const i of ordered) if (i.city) myCities.set(placeKey(i.country_code, i.city), { cc: i.country_code, city: i.city });
  const first = [...myCities.values()][0];

  // Widok: wybrane miasto, „inne miasto” (kraj → miasto) albo Online Q&A. Domyślnie moje pierwsze miasto.
  const view: "city" | "other" | "online" = sp.tab === "online" ? "online" : sp.tab === "other" || (!qCity && !first) ? "other" : "city";
  const cc = view === "city" && !qCity ? first!.cc : qCc;
  const city = view === "city" && !qCity ? first!.city : qCity;
  const { t, locale } = await getDictionary();

  const { data } = await supabase
    .from("events")
    .select("id, title, description, starts_at, is_online, city, country_code, location, link, audience, cover_url, created_by, event_attendees(user_id)")
    .gte("starts_at", recentCutoff())
    .order("starts_at")
    .limit(300);
  const upcoming = (data ?? []) as EventRow[];

  // Miejsca z wydarzeniami (do wyboru „inne miasto”)
  const places = new Map<string, { cc: string; city: string }>();
  for (const e of upcoming) if (!e.is_online && e.country_code && e.city) places.set(placeKey(e.country_code, e.city), { cc: e.country_code, city: e.city });

  let events =
    view === "online"
      ? upcoming.filter((e) => e.is_online)
      : upcoming.filter((e) => !e.is_online && (!cc || e.country_code === cc) && (!city || (e.city ?? "").toLowerCase() === city.toLowerCase()));
  // W „innym mieście” bez wybranego kraju nic nie pokazujemy — wydarzenia są zawsze w konkretnym mieście
  if (view === "other" && !cc) events = [];
  events = events.slice(0, 60);
  const chosen = view === "city" ? placeKey(cc, city) : "";
  const photos = await loadPlacePhotos(
    supabase,
    events.filter((e) => !e.is_online && !e.cover_url).map((e) => ({ cc: e.country_code, city: e.city })),
  );

  const audienceTone = { all: "bg-sand", alumni: "bg-ink text-honey", going: "bg-honey" };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <PageTitle
        title={t.events.title}
        lead={t.events.lead}
        action={
          <Link href="/wydarzenia/nowe" className="btn-honey shrink-0 bg-ink text-honey hover:bg-black">
            <Plus size={16} strokeWidth={3} /> {t.events.create}
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[...myCities.entries()].map(([key, c]) => (
          <Link key={key} href={`/wydarzenia?cc=${c.cc}&city=${encodeURIComponent(c.city)}`} className={`chip gap-1.5 ${chosen === key ? "chip-on" : ""}`}>
            <Flag code={c.cc} className="h-3 w-[18px]" />
            {cityName(c.city, locale)}
          </Link>
        ))}
        <Link href="/wydarzenia?tab=other" className={`chip ${view === "other" ? "chip-on" : ""}`}>
          <MapPin size={14} /> {t.events.tabOtherCity}
        </Link>
        <Link href="/wydarzenia?tab=online" className={`chip ${view === "online" ? "chip-on" : ""}`}>
          <Globe size={14} /> {t.events.tabOnline}
        </Link>
      </div>

      {view === "other" && <EventFilters locale={locale} cc={cc} city={city} places={[...places.values()]} />}

      {events.length === 0 && (
        <EmptyState
          action={
            <Link href="/wydarzenia/nowe" className="btn-primary">
              <Plus size={18} /> {t.events.create}
            </Link>
          }
        >
          {view === "other" && !cc ? t.events.pickCity : view === "online" ? t.events.emptyOnline : t.events.emptyCity}
        </EmptyState>
      )}

      {events.map((e, i) => {
        // Zdjęcie organizatora, a bez niego zdjęcie miasta (z podpisem autora i licencji)
        const cityPhoto = e.is_online ? null : photos.get(photoKey(e.country_code, e.city));
        const cover = e.cover_url ?? cityPhoto?.url;
        const going = e.event_attendees.some((a) => a.user_id === userId);
        const featured = i === 0;
        const place = e.is_online ? t.events.online : [cityName(e.city, locale), e.location].filter(Boolean).join(" · ");
        return (
          <article key={e.id} className={featured ? "relative overflow-hidden rounded-[26px] bg-ink p-5 text-cream" : "panel overflow-hidden p-3.5"}>
            {cover && (
              <PhotoBanner
                src={cover}
                credit={e.cover_url ? null : cityPhoto}
                t={t}
                className={featured ? "-mx-5 -mt-5 mb-4 h-44" : "-mx-3.5 -mt-3.5 mb-3 h-32"}
              />
            )}
            <div className="flex gap-3.5">
              <div className={`flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 ${featured ? "bg-honey text-ink" : "border-[1.5px] border-line bg-cream"}`}>
                <span className="text-[10px] font-bold tracking-wider">
                  <LocalDate iso={e.starts_at} locale={locale} part="month" />
                </span>
                <span className="display text-2xl leading-none">
                  <LocalDate iso={e.starts_at} locale={locale} part="day" />
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${featured ? "bg-ink-soft text-honey" : audienceTone[e.audience]}`}>{t.events.audience[e.audience]}</span>
                <h2 className={`leading-tight font-bold break-words ${featured ? "display text-[21px]" : "text-[15px]"}`}>{e.title}</h2>
                <p className={`flex min-w-0 items-center gap-1.5 text-[13px] ${featured ? "text-mist" : "text-muted"}`}>
                  {e.is_online ? <Globe size={14} className="shrink-0" /> : e.country_code ? <Flag code={e.country_code} className="h-3 w-[18px]" /> : <MapPin size={14} />}
                  <span className="truncate">
                    {place} · <LocalDate iso={e.starts_at} locale={locale} part="time" />
                  </span>
                </p>
              </div>
            </div>
            {featured && e.description && <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">{e.description}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className={`text-[13px] ${featured ? "text-mist" : "text-muted"}`}>
                {t.events.attendees(e.event_attendees.length)}
                {e.link && (
                  <>
                    {" · "}
                    <a href={e.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                      link
                    </a>
                  </>
                )}
                {/* Link do mapy z miejsca i miasta — bez klucza API, otwiera Google Maps */}
                {!e.is_online && e.location && (
                  <>
                    {" · "}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.location, e.city].filter(Boolean).join(", "))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      {t.events.map}
                    </a>
                  </>
                )}
              </span>
              <div className="flex items-center gap-2">
                {e.created_by === userId && (
                  <form action={deleteEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button aria-label={t.events.delete} className={`flex h-11 w-11 items-center justify-center rounded-xl ${featured ? "text-mist hover:text-honey" : "text-muted hover:text-red-700"}`}>
                      <Trash2 size={17} />
                    </button>
                  </form>
                )}
                <form action={toggleAttend}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="going" value={going ? "1" : "0"} />
                  <button className={`min-h-11 min-w-20 rounded-xl border-2 px-4 text-sm font-bold ${going ? "border-honey bg-honey text-ink" : featured ? "border-honey bg-honey text-ink" : "border-ink"}`}>
                    {going ? t.events.goingOn : t.events.going}
                  </button>
                </form>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
