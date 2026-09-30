"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CalendarDays, Hexagon, MessageSquare, User, Users } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

const ITEMS = [
  { href: "/roj", key: "swarm", Icon: Hexagon },
  { href: "/ludzie", key: "people", Icon: Users },
  { href: "/wydarzenia", key: "events", Icon: CalendarDays },
  { href: "/czaty", key: "chats", Icon: MessageSquare },
  { href: "/profil", key: "profile", Icon: User },
] as const;

function Badge({ n }: { n: number }) {
  return (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-honey px-1 text-[11px] leading-none font-extrabold text-ink ring-2 ring-ink" aria-label={`${n}`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

// Licznik nieprzeczytanych: startuje z wartości z serwera, odświeża się po zmianie strony i co 20 s
function useUnread(initial: number) {
  const path = usePathname();
  const [n, setN] = useState(initial);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await createClient().rpc("unread_threads");
      if (alive && data) setN((data as { unread: number }[]).reduce((sum, r) => sum + r.unread, 0));
    };
    const first = setTimeout(load, 600);
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [path]);
  return n;
}

function useActive() {
  const path = usePathname();
  return (href: string) =>
    path === href ||
    path.startsWith(href + "/") ||
    (href === "/czaty" && (path.startsWith("/wiadomosci") || path.startsWith("/grupy/"))) ||
    (href === "/roj" && path === "/grupy") ||
    (href === "/ludzie" && path.startsWith("/u/"));
}

export function DesktopNav({ locale, unread = 0 }: { locale: Locale; unread?: number }) {
  const t = dictionaries[locale];
  const isActive = useActive();
  const count = useUnread(unread);
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, key, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${isActive(href) ? "bg-ink text-honey" : "text-ink hover:bg-sand"}`}
        >
          <Icon size={17} strokeWidth={2.3} />
          {t.nav[key]}
          {key === "chats" && count > 0 && <Badge n={count} />}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav({ locale, unread = 0 }: { locale: Locale; unread?: number }) {
  const t = dictionaries[locale];
  const isActive = useActive();
  const count = useUnread(unread);
  if (usePathname() === "/onboarding") return null;
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 grid h-[68px] grid-cols-5 items-center rounded-[22px] bg-ink shadow-lg md:hidden">
      {ITEMS.map(({ href, key, Icon }) => {
        const on = isActive(href);
        return (
          <Link key={href} href={href} className={`relative flex flex-col items-center gap-1 text-[11px] font-semibold ${on ? "text-honey" : "text-mist"}`}>
            <Icon size={22} strokeWidth={2.2} />
            {key === "chats" && count > 0 && (
              <span className="absolute -top-1.5 left-1/2 ml-1">
                <Badge n={count} />
              </span>
            )}
            {t.nav[key]}
          </Link>
        );
      })}
    </nav>
  );
}
