import { CalendarRange, Crown, Flag, GraduationCap, MapPin, Route, School, Users } from "lucide-react";
import type { GroupKind } from "@/lib/groups";

const ICON = {
  route: Route,
  nat_uni: Users,
  nat_city: Users,
  nat_country: Flag,
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
