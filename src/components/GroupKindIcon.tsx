import { CalendarRange, Crown, Flag as FlagIcon, GraduationCap, MapPin, Route, School, Users } from "lucide-react";
import { Flag } from "@/components/bx";
import type { GroupKind } from "@/lib/groups";

const ICON = {
  route: Route,
  nat_uni: Users,
  nat_city: Users,
  nat_country: FlagIcon,
  semester: School,
  city: MapPin,
  alumni: GraduationCap,
  alumni_local: Crown,
} as const;

const TONE: Record<GroupKind, string> = {
  route: "bg-honey text-ink",
  nat_uni: "bg-honey text-ink",
  nat_city: "bg-sand text-ink",
  nat_country: "bg-sand text-ink",
  semester: "bg-honey text-ink",
  city: "bg-sand text-ink",
  alumni: "bg-ink text-honey",
  alumni_local: "bg-ink text-honey",
};

export function GroupKindIcon({ kind, size = 48 }: { kind: GroupKind; size?: number }) {
  const Icon = ICON[kind] ?? CalendarRange;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-2xl ${TONE[kind] ?? "bg-sand"}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={2.2} />
    </span>
  );
}

// Flaga przy nazwie grupy: narodowość dla „Polacy · …”, kula ziemska dla „Wszyscy · …”, kraj wymiany dla reszty
export function GroupFlag({ kind, country_code, nat_cc, className = "h-3.5 w-5" }: { kind: GroupKind; country_code: string | null; nat_cc?: string | null; className?: string }) {
  if (kind === "semester" || kind === "city") {
    return (
      <span role="img" aria-label="🌍" className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}>
        🌍
      </span>
    );
  }
  const nat = kind === "nat_uni" || kind === "nat_city" || kind === "nat_country";
  return <Flag code={nat ? nat_cc : country_code} className={className} />;
}
