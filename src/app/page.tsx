import Link from "next/link";
import { Avatar, Flag } from "@/components/bx";
import { getCurrentUser } from "@/lib/auth";
import { cityName } from "@/lib/cities";
import { ALL_COUNTRY_CODES } from "@/lib/countries";
import { INSTITUTION_FIELDS, countryName, institutionName, semesterLabel, semesterPhase, type Institution } from "@/lib/domain";
import { getDictionary } from "@/lib/i18n";
import { HomeUniForm, SearchForm } from "./SearchForm";

const TABS = ["going", "been", "helper"] as const;
type Tab = (typeof TABS)[number];

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
};

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const { supabase, userId } = await getCurrentUser();
  const { t, locale } = await getDictionary();

  const tab: Tab = TABS.includes(str(sp.tab) as Tab) ? (str(sp.tab) as Tab) : "going";
  // „Twój buddy”: na Twojej uczelni (wystarczy uczelnia) albo na uczelni wymiany (kraj, miasto, opcjonalnie uczelnia)
  const mode: "home" | "host" = tab === "helper" && str(sp.mode) === "home" ? "home" : "host";
  let instId = Number(str(sp.inst)) || null;
  // Zalogowanemu podpowiadamy jego uczelnię macierzystą
  if (mode === "home" && !instId && userId) {
    instId = ((await supabase.from("simple_people").select("home_institution_id").eq("user_id", userId).maybeSingle()).data?.home_institution_id as number | null) ?? null;
  }
  const inst = instId ? ((await supabase.from("institutions").select(INSTITUTION_FIELDS).eq("id", instId).maybeSingle()).data as Institution | null) : null;
  const cc = mode === "home" ? (inst?.country_code ?? "") : /^[A-Z]{2}$/.test(str(sp.cc)) ? str(sp.cc) : "";
  const city = mode === "home" ? (inst?.city ?? "") : str(sp.city).slice(0, 80);
  const ready = !!cc && !!city && (mode === "host" || !!inst);
  const args = { p_kind: tab, p_cc: cc, p_city: city, p_inst: instId };

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
  const ids = [...new Set(hits.flatMap((h) => [h.institution_id, h.home_id]).filter((x): x is number => !!x))];
  const insts = new Map<number, Institution>();
  if (ids.length) for (const i of ((await supabase.from("institutions").select(INSTITUTION_FIELDS).in("id", ids)).data ?? []) as Institution[]) insts.set(i.id, i);

  const countries = ALL_COUNTRY_CODES.map((c) => ({ c, n: countryName(c, locale) })).sort((a, b) => a.n.localeCompare(b.n, locale));
  const tabHref = (k: Tab, m: "home" | "host" = mode) =>
    `/?${new URLSearchParams({ tab: k, ...(k === "helper" && m === "home" ? { mode: "home" } : {}), ...(m === "host" && cc ? { cc } : {}), ...(m === "host" && city ? { city } : {}), ...(instId ? { inst: String(instId) } : {}) }).toString()}`;
  const loginHref = `/login?next=${encodeURIComponent(tabHref(tab))}`;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      {sp.deleted === "1" && <p className="rounded-2xl bg-ink px-4 py-3 text-center text-sm font-semibold text-honey">{t.profile.deleted}</p>}

      <div>
        <h1 className="display text-[34px] leading-[1.05]">{t.simple.title}</h1>
        <p className="mt-1.5 text-[15px] text-muted">{t.simple.lead}</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sand p-1">
        {TABS.map((k) => (
          <Link
            key={k}
            href={tabHref(k)}
            aria-current={tab === k ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-xl px-1 text-center text-sm leading-tight font-bold ${tab === k ? "bg-ink text-honey" : ""}`}
          >
            {t.simple.tabs[k]}
          </Link>
        ))}
      </div>
      {tab === "helper" && (
        <div className="flex gap-2">
          {(["home", "host"] as const).map((m) => (
            <Link key={m} href={tabHref("helper", m)} aria-current={mode === m ? "page" : undefined} className={`chip flex-1 justify-center ${mode === m ? "chip-on" : ""}`}>
              {t.simple.buddyModes[m]}
            </Link>
          ))}
        </div>
      )}
      <p className="text-sm text-muted">{tab === "helper" ? t.simple.buddyLead[mode] : t.simple.tabLead[tab]}</p>

      {mode === "home" ? (
        <HomeUniForm key={`home:${instId}`} locale={locale} initial={inst} />
      ) : (
        <SearchForm key={`${cc}:${city}:${instId}`} locale={locale} tab={tab} initial={{ cc, city, inst }} countries={countries} />
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
                      <span className="rounded-full bg-sand px-2 py-0.5 text-[11px] font-bold">🏠 {t.simple.lookingForHousing}</span>
                    )}
                  </p>
                  {at && (
                    <p className="flex min-w-0 items-start gap-1.5 text-[13px] font-semibold text-honey-700">
                      <Flag code={at.country_code} className="mt-[3px] h-3 w-[18px]" />
                      <span>
                        {institutionName(at)}
                        {h.semester && ` · ${semesterLabel(h.semester, t)}`}
                        {now && ` · ${t.simple.now}`}
                      </span>
                    </p>
                  )}
                  {/* Uczelnia macierzysta tylko przy „Twój buddy” */}
                  {tab === "helper" && home && (
                    <p className="flex min-w-0 items-start gap-1.5 text-[13px]">
                      <Flag code={home.country_code} className="mt-[3px] h-3 w-[18px]" />
                      <span>
                        {t.simple.from} {institutionName(home)}
                      </span>
                    </p>
                  )}
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
