"use client";

// Data w strefie czasowej przeglądarki (serwer zwykle działa w UTC)
export function LocalDate({ iso, locale, part }: { iso: string; locale: string; part: "month" | "day" | "time" }) {
  const d = new Date(iso);
  const text =
    part === "month"
      ? d.toLocaleDateString(locale, { month: "short" }).replace(".", "").toUpperCase()
      : part === "day"
        ? String(d.getDate())
        : d.toLocaleString(locale, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return <span suppressHydrationWarning>{text}</span>;
}
