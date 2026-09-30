import Link from "next/link";
import { STATUS_SHORT, type Status } from "@/lib/constants";
import { initials } from "@/lib/format";

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-honey-400 font-bold text-ink"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

const STATUS_STYLE: Record<Status, string> = {
  searching: "bg-sky-100 text-sky-800",
  going: "bg-honey-200 text-ink",
  been: "bg-emerald-100 text-emerald-800",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>{STATUS_SHORT[status]}</span>;
}

export function MentorBadge() {
  return <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-honey-300">🐝 Odpowiada na pytania</span>;
}

export function Rating({ value, label }: { value: number | null | undefined; label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {label && <span className="w-40 shrink-0 text-ink/70 sm:w-56">{label}</span>}
      {value === null || value === undefined ? (
        <span className="text-ink/40">brak ocen</span>
      ) : (
        <>
          <div className="h-2 w-24 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-honey-500" style={{ width: `${(Number(value) / 5) * 100}%` }} />
          </div>
          <span className="font-semibold">{Number(value).toFixed(1)}</span>
        </>
      )}
    </div>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink/10 p-8 text-center text-ink/60">
      <p>{children}</p>
      {action && (
        <Link href={action.href} className="btn-honey mt-4">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export type PersonRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  home_university: string;
  field_of_study: string;
  status: Status;
  semester: string | null;
  open_to_questions: boolean;
  universities?: { name: string; short_name: string | null; cities: { name: string; country_flag: string } | null } | null;
};

export const PERSON_SELECT =
  "id, full_name, avatar_url, home_university, field_of_study, status, semester, open_to_questions, universities(name, short_name, cities(name, country_flag))";

export function PersonCard({ person }: { person: PersonRow }) {
  const uni = person.universities;
  return (
    <Link href={`/profil/${person.id}`} className="card flex items-start gap-3 transition hover:border-honey-500">
      <Avatar name={person.full_name} url={person.avatar_url} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{person.full_name || "Bez nazwy"}</span>
          <StatusBadge status={person.status} />
        </div>
        <p className="truncate text-sm text-ink/60">
          {person.home_university}
          {person.field_of_study && ` · ${person.field_of_study}`}
        </p>
        {uni && (
          <p className="truncate text-sm">
            ✈️ {uni.cities?.country_flag} {uni.short_name || uni.name}
            {uni.cities && `, ${uni.cities.name}`}
            {person.semester && <span className="text-ink/60"> · {person.semester}</span>}
          </p>
        )}
        {person.open_to_questions && (
          <div className="mt-2">
            <MentorBadge />
          </div>
        )}
      </div>
    </Link>
  );
}
