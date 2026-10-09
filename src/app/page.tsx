import Link from "next/link";
import { Avatar, Flag } from "@/components/bx";
import { getCurrentUser } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { ALL_COUNTRY_CODES } from "@/lib/countries";
import { INSTITUTION_FIELDS, countryName, institutionName, semesterLabel, semesterPhase, type Institution } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { HomeUniForm, SearchForm } from "./SearchForm";

const TABS = ["going", "been", "helper"] as const;
type Tab = (typeof TABS)[number];
const TAB_ICON: Record<Tab, string> = { going: "✈️", been: "📍", helper: "🧸" };

type Hit = {
  entry_id: number;
  user_id: string;
  display_name: string;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  home_id: number | null;
  institution_id: number;
  semester: string | null;
  looking_for_housing: boolean;
  is_buddy: boolean;
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { supabase, userId } = await getCurrentUser();
  const { t, locale } = await getDictionary();

  const tab: Tab = TABS.includes(str(sp.tab) as Tab) ? (str(sp.tab) as Tab) : "going";
  // „Twój buddy”: na Twojej uczelni (wystarczy uczelnia) albo na uczelni wymiany (kraj, miasto, opcjonalnie uczelnia)
  const mode: "home" | "host" = tab === "helper" && str(sp.mode) === "home" ? "home" : "host";
  const sem = tab !== "helper" && /^\d{4}[WS]$/.test(str(sp.sem)) ? str(sp.sem) : null;
  // „Skąd”: kraj uczelni macierzystej (tylko „Jadą” i „Są lub byli”)
  const from = tab !== "helper" && /^[A-Z]{2}$/.test(str(sp.from)) ? str(sp.from) : null;
  let instId = Number(str(sp.inst)) || null;
  // Zalogowanemu bez wybranego miejsca podpowiadamy uczelnię z profilu:
  // „Na Twojej uczelni” → macierzystą, pozostałe → uczelnię wymiany (najbliższą przyszłą, inaczej ostatnią)
  let prefilled = false;
  if (userId && !instId && !str(sp.cc) && !str(sp.city)) {
    if (mode === "home") {
      instId = ((await supabase.from("simple_people").select("home_institution_id").eq("user_id", userId).maybeSingle()).data?.home_institution_id as number | null) ?? null;
    } else {
      const mine = (((await supabase.from("simple_entries").select("institution_id, semester").eq("user_id", userId).neq("kind", "helper")).data ?? []) as { institution_id: number; semester: string | null }[])
        .filter((e): e is { institution_id: number; semester: string } => !!e.semester)
        .sort((a, b) => b.semester.localeCompare(a.semester));
      instId = (mine.filter((e) => semesterPhase(e.semester) === "upcoming").at(-1) ?? mine[0])?.institution_id ?? null;
    }
    prefilled = !!instId;
  }
  const inst = instId ? ((await supabase.from("institutions").select(INSTITUTION_FIELDS).eq("id", instId).maybeSingle()).data as Institution | null) : null;
  const cc = mode === "home" || prefilled ? (inst?.country_code ?? "") : /^[A-Z]{2}$/.test(str(sp.cc)) ? str(sp.cc) : "";
  const city = mode === "home" || prefilled ? (inst?.city ?? "") : str(sp.city).slice(0, 80);
  const ready = !!cc && !!city && (mode === "host" || !!inst);
  const args = { p_kind: tab, p_cc: cc, p_city: city, p_inst: instId, p_sem: sem, ...(from ? { p_from: from } : {}) };

  // Zalogowani widzą osoby, niezalogowani tylko liczbę
  let hits: Hit[] = [];
  let count = 0;
  if (ready && userId) {
    hits = ((await supabase.rpc("simple_search", args)).data ?? []) as Hit[];
    count = hits.length;
  } else if (ready) {
    count = ((await supabase.rpc("simple_count", args)).data as number | null) ?? 0;
  }

  // Uczelnie z wyników (uczelnia wpisu i uczelnia macierzysta)
  // 🧸 Buddy: gdzie i kiedy sami byli na wymianie
  const trips = new Map<string, { institution_id: number; semester: string }[]>();
  if (tab === "helper" && hits.length) {
    const { data } = await supabase.from("simple_entries").select("user_id, institution_id, semester").in("user_id", hits.map((h) => h.user_id)).neq("kind", "helper").not("semester", "is", null).order("semester", { ascending: false });
    for (const e of (data ?? []) as { user_id: string; institution_id: number; semester: string }[]) trips.set(e.user_id, [...(trips.get(e.user_id) ?? []), e]);
  }
  const ids = [...new Set([...hits.flatMap((h) => [h.institution_id, h.home_id]), ...[...trips.values()].flat().map((e) => e.institution_id)].filter((x): x is number => !!x))];
  const insts = new Map<number, Institution>();
  if (ids.length) for (const i of ((await supabase.from("institutions").select(INSTITUTION_FIELDS).in("id", ids)).data ?? []) as Institution[]) insts.set(i.id, i);

  const countries = ALL_COUNTRY_CODES.map((c) => ({ c, n: countryName(c, locale) })).sort((a, b) => a.n.localeCompare(b.n, locale));
  // Miejsce przenosimy między zakładkami tylko w obrębie tego samego rodzaju (uczelnia wymiany ↔ macierzysta się nie mieszają)
  const tabHref = (k: Tab, m: "home" | "host" = mode) => {
    const toHome = k === "helper" && m === "home";
    const carry = !prefilled && toHome === (mode === "home");
    const q: Record<string, string> = { tab: k };
    if (toHome) q.mode = "home";
    if (carry && !toHome && cc) q.cc = cc;
    if (carry && !toHome && city) q.city = city;
    if (carry && instId) q.inst = String(instId);
    if (k === tab && sem) q.sem = sem;
    if (carry && k !== "helper" && from) q.from = from;
    return `/?${new URLSearchParams(q).toString()}`;
  };
  const loginHref = `/login?next=${encodeURIComponent(tabHref(tab))}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      {sp.deleted === "1" && <p className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-honey">{t.profile.deleted}</p>}

      <section className="relative overflow-hidden rounded-[28px] border-[3px] border-ink bg-honey px-5 pt-6 pb-5">
        <svg viewBox="0 0 400 120" className="pointer-events-none absolute -right-6 -bottom-2 w-[70%] opacity-90" aria-hidden="true">
          <path d="M10 110 C 100 110, 160 50, 260 70 S 340 60, 360 34" fill="none" stroke="#17140F" strokeOpacity="0.18" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" />
        </svg>
        <span className="absolute top-4 right-5 rotate-12 text-[40px]" aria-hidden="true">
          ✈️
        </span>
        <h1 className="display relative max-w-[85%] text-[32px] leading-[1.02] sm:text-[40px]">{t.simple.title}</h1>
        <p className="relative mt-2 max-w-[80%] text-[15px] font-medium">{t.simple.lead}</p>
      </section>

      <div className="grid grid-cols-3 gap-1 rounded-2xl border-[1.5px] border-line bg-white/80 p-1 backdrop-blur">
        {TABS.map((k) => (
          <Link
            key={k}
            href={tabHref(k)}
            aria-current={tab === k ? "page" : undefined}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-center text-[13px] leading-tight font-bold ${tab === k ? "bg-ink text-honey" : ""}`}
          >
            <span aria-hidden="true" className="text-xl leading-none">
              {TAB_ICON[k]}
            </span>
            {t.simple.tabs[k]}
          </Link>
        ))}
      </div>
      {tab === "helper" && (
        <div className="flex gap-2">
          {(["home", "host"] as const).map((m) => (
            <Link key={m} href={tabHref("helper", m)} aria-current={mode === m ? "page" : undefined} className={`chip flex-1 justify-center gap-1.5 ${mode === m ? "chip-on" : ""}`}>
              <span aria-hidden="true">{m === "home" ? "🐝" : "🗺️"}</span>
              {t.simple.buddyModes[m]}
            </Link>
          ))}
        </div>
      )}
      <p className="text-sm text-muted">{tab === "helper" ? t.simple.buddyLead[mode] : t.simple.tabLead[tab]}</p>
      {prefilled && <p className="text-[13px] font-semibold">{t.simple.prefilled[mode]}</p>}

      {mode === "home" ? (
        <HomeUniForm key={`home:${instId}`} locale={locale} initial={inst} />
      ) : (
        <SearchForm key={`${cc}:${city}:${instId}:${sem}:${from}`} locale={locale} tab={tab} initial={{ cc, city, inst, sem, from }} countries={countries} />
      )}

      {!ready ? (
        <p className="rounded-2xl bg-sand px-4 py-3 text-sm">{t.simple.needPlace}</p>
      ) : (
        <section className="space-y-3">
          <p className="flex items-center gap-2 font-bold">
            <Flag code={cc} className="h-3.5 w-5" />
            {cityName(city, locale)}
            {inst && ` · ${institutionName(inst)}`}
            <span className="font-normal text-muted">· {t.simple.found(count)}</span>
          </p>

          {!userId && count > 0 && (
            <div className="rounded-[22px] bg-ink p-5 text-cream">
              <p className="text-[15px]">{t.simple.loginToSee}</p>
              <Link href={loginHref} className="btn-honey mt-4 min-h-12 w-full">
                {t.simple.loginCta}
              </Link>
            </div>
          )}

          {hits.map((h) => {
            const at = insts.get(h.institution_id);
            const home = h.home_id ? insts.get(h.home_id) : null;
            const now = h.semester && semesterPhase(h.semester) === "now";
            return (
              <article key={h.entry_id} className="panel flex items-start gap-3 p-4">
                <Avatar name={h.display_name} size={48} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-[17px] leading-tight font-bold">
                    {h.display_name}
                    {h.looking_for_housing && tab !== "helper" && (
                      <span title={t.simple.lookingForHousing} className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold">
                        🏠 {t.simple.lookingForHousing}
                      </span>
                    )}
                    {h.is_buddy && (
                      <span title={t.simple.buddyBadge} className="rounded-full bg-honey px-2 py-0.5 text-[11px] font-bold">
                        🧸 buddy
                      </span>
                    )}
                  </p>
                  {at && tab !== "helper" && (
                    <p className="flex min-w-0 items-start gap-1.5 text-[13px] font-semibold text-honey-700">
                      <span aria-hidden="true">{tab === "going" ? "✈️" : now ? "📍" : "🏛️"}</span>
                      <Flag code={at.country_code} className="mt-[3px] h-3 w-[18px]" />
                      <span>
                        {institutionName(at)}
                        {h.semester && ` · ${semesterLabel(h.semester, t)}`}
                        {now && ` · ${t.simple.now}`}
                      </span>
                    </p>
                  )}
                  {home && (
                    <p className="flex min-w-0 items-start gap-1.5 text-[13px]">
                      <Flag code={home.country_code} className="mt-[3px] h-3 w-[18px]" />
                      <span>
                        {t.simple.from} {institutionName(home)}
                      </span>
                    </p>
                  )}
                  {tab === "helper" &&
                    (trips.get(h.user_id) ?? []).slice(0, 3).map((e) => {
                      const ex = insts.get(e.institution_id);
                      const phase = semesterPhase(e.semester);
                      return (
                        ex && (
                          <p key={`${e.institution_id}:${e.semester}`} className="flex min-w-0 items-start gap-1.5 text-[13px] font-semibold text-honey-700">
                            <span aria-hidden="true">{phase === "upcoming" ? "✈️" : phase === "now" ? "📍" : "🏛️"}</span>
                            <Flag code={ex.country_code} className="mt-[3px] h-3 w-[18px]" />
                            <span>
                              <span className="font-normal text-muted">{t.simple.buddyExchange}</span> {institutionName(ex)} · {semesterLabel(e.semester, t)}
                            </span>
                          </p>
                        )
                      );
                    })}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {h.instagram && (
                      <a href={`https://instagram.com/${h.instagram}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#E1306C] px-3 py-1.5 text-xs font-bold text-white">
                        Instagram
                      </a>
                    )}
                    {h.facebook && (
                      <a href={h.facebook} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#1877F2] px-3 py-1.5 text-xs font-bold text-white">
                        Facebook
                      </a>
                    )}
                    {h.whatsapp && (
                      <a href={`https://wa.me/${h.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-ink">
                        WhatsApp
                      </a>
                    )}
                    {/* DSA: zgłoszenie nielegalnej lub niezgodnej z regulaminem treści */}
                    <a
                      href={`mailto:${LEGAL.email}?subject=${encodeURIComponent(`${t.simple.reportSubject} ${h.user_id}`)}&body=${encodeURIComponent(t.simple.reportBody(h.display_name))}`}
                      className="ml-auto self-center text-xs text-muted underline hover:text-red-700"
                    >
                      {t.simple.report}
                    </a>
                  </div>
                </div>
              </article>
            );
          })}

          {count === 0 && (
            <div className="rounded-[22px] border-2 border-dashed border-line p-5 text-center">
              <p className="text-sm">{t.simple.beFirst}</p>
              <Link href={userId ? "/me" : "/login?next=/me"} className="btn-primary mt-3">
                {t.simple.addMe}
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
