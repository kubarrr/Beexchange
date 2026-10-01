import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { startConversation } from "@/app/actions";
import { Avatar, BuddyBadge, EmptyState, Flag, PageTitle, StatusBadge } from "@/components/bx";
import { requireProfile } from "@/lib/auth";
import { INSTITUTION_FIELDS, institutionShort, semesterLabel, stageOf, type Institution, type Status } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { PeopleFilters, type PeopleQuery } from "./PeopleFilters";

export const generateMetadata = localizedTitle((t) => t.nav.people);

type Row = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  status: Status;
  semester: string | null;
  field_of_study: string;
  wants_buddy: boolean;
  open_to_questions: boolean;
  home: Institution | null;
  exchange: Institution | null;
  exchanges: { id: number }[];
  homes: { faculty: string | null; position: number }[];
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function PeoplePage({ searchParams }: PageProps<"/ludzie">) {
  const sp = await searchParams;
  const { supabase, profile: me } = await requireProfile("/ludzie");
  const { t, locale } = await getDictionary();

  const seg = (["going", "been"].includes(str(sp.seg)) ? str(sp.seg) : "all") as PeopleQuery["seg"];
  const exParam = str(sp.ex);
  const exId = exParam === "all" ? null : Number(exParam) || me.exchange_institution_id;
  const huId = Number(str(sp.hu)) || null;
  const myInsts = [...me.exchanges.map((x) => x.institution), ...me.homes.map((h) => h.institution)];
  const loadInst = async (id: number | null) =>
    id ? (myInsts.find((i) => i.id === id) ?? ((await supabase.from("institutions").select(INSTITUTION_FIELDS).eq("id", id).maybeSingle()).data as Institution | null)) : null;
  const [ex, hu] = await Promise.all([loadInst(exId), loadInst(huId)]);
  const filters: PeopleQuery = {
    seg,
    hu,
    ex,
    field: str(sp.field).slice(0, 60),
    cc: /^[A-Z]{2}$/.test(str(sp.cc)) ? str(sp.cc) : "",
    city: str(sp.city).slice(0, 80),
    sem: /^\d{4}[WS]$/.test(str(sp.sem)) ? str(sp.sem) : "",
    buddy: sp.buddy === "1",
    open: sp.open === "1",
  };

  const [{ data, error }, { data: placeRows }] = await Promise.all([
    supabase
      .rpc("search_people", {
        p_seg: filters.seg,
        p_inst: filters.ex?.id ?? null,
        p_sem: filters.sem || null,
        p_city: filters.city || null,
        p_cc: filters.cc || null,
        p_home: filters.hu?.id ?? null,
        p_field: filters.field || null,
        p_buddy: filters.buddy,
        p_open: filters.open,
        lim: 60,
      })
      .select(
        `id, full_name, avatar_url, status, semester, field_of_study, wants_buddy, open_to_questions,
         home:institutions!profiles_home_institution_id_fkey(${INSTITUTION_FIELDS}),
         exchange:institutions!profiles_exchange_institution_id_fkey(${INSTITUTION_FIELDS}),
         exchanges(id), homes:profile_homes(faculty, position)`,
      ),
    supabase.from("exchanges").select("institutions(city, country_code)").limit(2000),
  ]);
  if (error) console.error("search_people", error.message);
  const people = (data ?? []) as unknown as Row[];

  const places = new Map<string, { city: string; cc: string }>();
  for (const r of placeRows ?? []) {
    const i = r.institutions as unknown as { city: string | null; country_code: string } | null;
    if (i?.city) places.set(`${i.country_code}:${i.city}`, { city: i.city, cc: i.country_code });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <PageTitle title={t.people.title} lead={t.people.lead} />
      <PeopleFilters
        key={JSON.stringify({ ...filters, ex: filters.ex?.id, hu: filters.hu?.id })}
        locale={locale}
        initial={filters}
        myHomes={me.homes.map((h) => h.institution)}
        myExchanges={me.exchanges.map((x) => x.institution)}
        places={[...places.values()]}
      />
      <p className="text-[13px] font-semibold text-muted">{t.people.found(people.length)}</p>

      {people.length === 0 ? (
        <EmptyState>{t.people.found(0)}</EmptyState>
      ) : (
        <div className="space-y-3">
          {people.map((p) => (
            <div key={p.id} className="panel flex items-center gap-3 p-3.5">
              <Link href={`/u/${p.id}`} className="shrink-0">
                <Avatar name={p.full_name} url={p.avatar_url} size={52} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/u/${p.id}`} className="font-bold hover:underline">
                    {p.full_name}
                  </Link>
                  <StatusBadge status={stageOf(p.status, p.semester)} t={t} />
                  {p.wants_buddy && <BuddyBadge t={t} />}
                </div>
                <p className="truncate text-[13px] text-muted">
                  {p.home ? institutionShort(p.home, locale) : ""}
                  {(() => {
                    const faculty = [...p.homes].sort((a, b) => a.position - b.position)[0]?.faculty;
                    return faculty ? ` · ${faculty}` : "";
                  })()}
                  {p.field_of_study && ` · ${p.field_of_study}`}
                </p>
                {p.exchange && (
                  <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
                    <Flag code={p.exchange.country_code} className="h-3 w-[18px]" />
                    <span className="truncate">
                      {institutionShort(p.exchange, locale)}
                      {p.semester && ` · ${semesterLabel(p.semester, t)}`}
                      {p.exchanges.length > 1 && <span className="font-normal text-muted"> +{p.exchanges.length - 1}</span>}
                    </span>
                  </p>
                )}
              </div>
              {p.open_to_questions && (
                <form action={startConversation}>
                  <input type="hidden" name="user_id" value={p.id} />
                  <button aria-label={t.common.write} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-honey">
                    <MessageSquare size={20} strokeWidth={2.2} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
