// Wspólne elementy interfejsu BeeXchange (działają po stronie serwera i klienta)
import { institutionName, initials, type Institution, type Stage } from "@/lib/domain";
import type { Dictionary, Locale } from "@/lib/i18n/dictionaries";
import { cityName } from "@/lib/cities";
import { BUDDY_EMOJI, LANGUAGE_FLAGS, PASSION_EMOJI, STAGE_EMOJI, languageName, parseLanguage } from "@/lib/profile-options";

export function Flag({ code, className = "h-3.5 w-5" }: { code: string | null | undefined; className?: string }) {
  if (!code) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/flags/${code.toUpperCase()}.svg`} alt={code.toUpperCase()} className={`inline-block shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgba(23,20,15,.12)] ${className}`} />
  );
}

function badgeText(i: Pick<Institution, "acronym" | "name">) {
  if (i.acronym && i.acronym.length <= 8) return i.acronym;
  const words = i.name.split(/\s+/).filter((w) => w.length > 3 && /^[A-ZÀ-Ž]/.test(w));
  return (words.map((w) => w[0]).join("").slice(0, 4) || i.name.slice(0, 3)).toUpperCase();
}

export function InstBadge({
  inst,
  size = 44,
  tone = "ink",
}: {
  inst: Pick<Institution, "acronym" | "name" | "country_code">;
  size?: number;
  tone?: "ink" | "honey" | "cream";
}) {
  const text = badgeText(inst);
  const tones = { ink: "bg-ink text-honey", honey: "bg-honey text-ink", cream: "bg-cream text-ink border-[1.5px] border-line" };
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={`flex h-full w-full items-center justify-center rounded-xl px-1 text-center font-display font-extrabold leading-none ${tones[tone]}`}
        style={{ fontSize: text.length > 5 ? size * 0.2 : text.length > 3 ? size * 0.24 : size * 0.3 }}
      >
        {text}
      </span>
      <Flag code={inst.country_code} className="absolute -right-1 -bottom-1 h-3 w-[18px] ring-2 ring-cream" />
    </span>
  );
}

export function InstLine({ inst, locale, extra }: { inst: Institution; locale: Locale; extra?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <InstBadge inst={inst} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-bold">{institutionName(inst)}</span>
        <span className="truncate text-[13px] text-muted">
          {cityName(inst.city, locale)}
          {extra ? ` · ${extra}` : ""}
        </span>
      </span>
    </span>
  );
}

const AVATAR_TONES = ["bg-ink text-honey", "bg-honey text-ink", "bg-sand text-ink"];

export function Avatar({ name, url, size = 44, className = "" }: { name: string; url?: string | null; size?: number; className?: string }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" width={size} height={size} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: size, height: size }} referrerPolicy="no-referrer" />
    );
  }
  const tone = AVATAR_TONES[(name.charCodeAt(0) || 0) % AVATAR_TONES.length];
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tone} ${className}`} style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {initials(name)}
    </span>
  );
}

export function StatusBadge({ status, t }: { status: Stage; t: Dictionary }) {
  const tones: Record<Stage, string> = { searching: "bg-cream text-ink border border-line", going: "bg-sand text-ink", abroad: "bg-honey text-ink", been: "bg-ink text-honey" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${tones[status]}`}>
      <span aria-hidden="true">{STAGE_EMOJI[status]}</span>
      {t.statusBadge[status]}
    </span>
  );
}

export function Switch({ on }: { on: boolean }) {
  return (
    <span className={`flex h-8 w-[52px] shrink-0 items-center rounded-full p-[3px] transition ${on ? "justify-end bg-ink" : "justify-start bg-line"}`}>
      <span className={`h-[26px] w-[26px] rounded-full transition ${on ? "bg-honey" : "bg-white"}`} />
    </span>
  );
}

export function EmptyState({ title, children, action }: { title?: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border-2 border-dashed border-line p-6 text-center">
      {title && <p className="display text-lg">{title}</p>}
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, lead, action }: { title: string; lead?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="display text-[32px] leading-[1.05]">{title}</h1>
        {lead && <p className="mt-1 text-sm text-muted">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function LanguageBadge({ entry, t, locale, children }: { entry: string; t: Dictionary; locale: Locale; children?: React.ReactNode }) {
  const lang = parseLanguage(entry);
  return (
    <span className="chip gap-2 rounded-xl">
      {lang && <Flag code={LANGUAGE_FLAGS[lang.code]} className="h-3.5 w-5" />}
      {lang ? languageName(lang.code, locale) : entry}
      {lang && <span className="text-xs font-medium text-muted">{t.profile.levels[lang.level]}</span>}
      {children}
    </span>
  );
}

export function PassionEmoji({ id }: { id: string }) {
  return <span aria-hidden="true">{PASSION_EMOJI[id] ?? "🐝"}</span>;
}

export function BuddyBadge({ t, tone = "ink" }: { t: Dictionary; tone?: "ink" | "honey" }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${tone === "ink" ? "bg-ink text-honey" : "bg-honey text-ink"}`}>
      <span aria-hidden="true">{BUDDY_EMOJI}</span>
      {t.people.buddy}
    </span>
  );
}
