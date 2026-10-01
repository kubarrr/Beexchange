import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { createGroup, joinGroupById } from "@/app/actions/bx";
import { EmptyState, PageTitle } from "@/components/bx";
import { GroupFlag, GroupKindIcon } from "@/components/GroupKindIcon";
import { requireProfile } from "@/lib/auth";
import { INSTITUTION_FIELDS, formatRelative, type Institution } from "@/lib/domain";
import { ACTIVE_GROUP_KINDS, groupTitle, type GroupKind } from "@/lib/groups";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { DiscoverFilters, type DiscoverQuery } from "./DiscoverFilters";

export const generateMetadata = localizedTitle((t) => t.discover.title);

type Row = {
  id: number;
  kind: GroupKind;
  key: string;
  home_institution_id: number | null;
  exchange_institution_id: number | null;
  city: string | null;
  country_code: string | null;
  nat_cc: string | null;
  semester: string | null;
  members: number;
  last_message_at: string | null;
  is_member: boolean;
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function DiscoverPage({ searchParams }: PageProps<"/groups">) {
  const sp = await searchParams;
  const { supabase } = await requireProfile("/groups");
  const { t, locale } = await getDictionary();

  const tab = (["semester", "city"].includes(str(sp.tab)) ? str(sp.tab) : "all") as DiscoverQuery["tab"];
  const cc = /^[A-Z]{2}$/.test(str(sp.cc)) ? str(sp.cc) : "";
  const city = str(sp.city).slice(0, 80);
  const sem = /^\d{4}[WS]$/.test(str(sp.sem)) ? str(sp.sem) : "";
  const instId = tab === "semester" ? Number(str(sp.inst)) || null : null;
  const inst = instId ? ((await supabase.from("institutions").select(INSTITUTION_FIELDS).eq("id", instId).maybeSingle()).data as Institution | null) : null;

  const [{ data }, { data: cityRows }] = await Promise.all([
    supabase.rpc("discover_groups", {
      p_kind: tab === "all" ? null : tab,
      p_cc: tab === "semester" ? null : cc || null,
      p_city: tab === "semester" ? null : city || null,
      p_inst: inst?.id ?? null,
      p_sem: sem || null,
      lim: 40,
    }),
    cc && tab !== "semester" ? supabase.from("institutions").select("city").eq("country_code", cc).not("city", "is", null).limit(3000) : Promise.resolve({ data: [] }),
  ]);
  // Stare rodzaje (trasa, absolwenci) zostają tylko w czatach członków
  const groups = ((data ?? []) as Row[]).filter((g) => ACTIVE_GROUP_KINDS.includes(g.kind));
  const cities = [...new Set((cityRows ?? []).map((r) => r.city as string))].sort((a, b) => a.localeCompare(b));

  const instIds = [...new Set(groups.flatMap((g) => [g.home_institution_id, g.exchange_institution_id]).filter((x): x is number => !!x))];
  const insts = new Map<number, Institution>();
  if (instIds.length) {
    const { data: rows } = await supabase.from("institutions").select(INSTITUTION_FIELDS).in("id", instIds);
    for (const r of (rows ?? []) as Institution[]) insts.set(r.id, r);
  }

  // Czy da się założyć brakującą grupę dla wybranych filtrów?
  const wantedKey =
    sem && tab === "semester" && inst
      ? `semester:${inst.id}:${sem}`
      : sem && tab === "city" && cc && city
        ? `city:${cc}:${city.toLowerCase()}:${sem}`
        : null;
  const canCreate = wantedKey && !groups.some((g) => g.key === wantedKey);

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <PageTitle title={t.discover.title} lead={t.discover.lead} />
      <DiscoverFilters key={JSON.stringify({ tab, cc, city, sem, inst: inst?.id })} locale={locale} q={{ tab, cc, city, inst, sem }} cities={cities} />

      {canCreate ? (
        <form action={createGroup} className="space-y-3 rounded-[24px] bg-honey p-4">
          <p className="text-sm font-semibold">{t.discover.createHint}</p>
          <input type="hidden" name="kind" value={tab} />
          <input type="hidden" name="semester" value={sem} />
          {inst && <input type="hidden" name="institution_id" value={inst.id} />}
          {cc && <input type="hidden" name="country_code" value={cc} />}
          {city && <input type="hidden" name="city" value={city} />}
          <button className="btn-primary w-full">
            <Plus size={18} /> {t.discover.create}
          </button>
        </form>
      ) : (
        tab !== "all" && !wantedKey && <p className="text-[13px] text-muted">{t.discover.pickToCreate}</p>
      )}

      {groups.length === 0 ? (
        <EmptyState>{t.discover.empty}</EmptyState>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const { title, subtitle } = groupTitle(
              {
                kind: g.kind,
                home: g.home_institution_id ? insts.get(g.home_institution_id) ?? null : null,
                exchange: g.exchange_institution_id ? insts.get(g.exchange_institution_id) ?? null : null,
                city: g.city,
                country_code: g.country_code,
                nat_cc: g.nat_cc,
                semester: g.semester,
              },
              t,
              locale,
            );
            return (
              <div key={g.id} className="panel flex items-center gap-3.5 p-3.5">
                <GroupKindIcon kind={g.kind} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 leading-tight font-bold">
                    <GroupFlag kind={g.kind} country_code={g.country_code} nat_cc={g.nat_cc} className="h-3 w-[18px]" />
                    <span className="break-words">{title}</span>
                  </p>
                  <p className="text-[13px] text-muted">
                    {subtitle} · {t.common.people(g.members)}
                    {g.last_message_at && ` · ${t.discover.lastActive} ${formatRelative(g.last_message_at, locale)}`}
                  </p>
                </div>
                {g.is_member ? (
                  <Link href={`/groups/${g.id}`} className="btn-outline shrink-0">
                    {t.discover.open} <ArrowRight size={16} />
                  </Link>
                ) : (
                  <form action={joinGroupById}>
                    <input type="hidden" name="group_id" value={g.id} />
                    <button className="btn-honey shrink-0 bg-ink text-honey hover:bg-black">{t.discover.join}</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
