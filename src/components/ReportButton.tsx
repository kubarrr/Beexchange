"use client";

import { useState } from "react";
import { reportContent } from "@/app/actions";
import { dictionaries, type Locale } from "@/lib/i18n/dictionaries";

export function ReportButton({ type, id, locale = "pl" }: { type: string; id: string | number; locale?: Locale }) {
  const t = dictionaries[locale].report;
  const [state, setState] = useState<"idle" | "open" | "sent">("idle");

  if (state === "sent") return <span className="text-xs text-ink/50">{t.sent}</span>;
  if (state === "idle")
    return (
      <button type="button" onClick={() => setState("open")} className="text-xs text-ink/40 hover:text-red-600">
        {t.button}
      </button>
    );

  return (
    <form
      action={async (fd) => {
        await reportContent(fd);
        setState("sent");
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="target_type" value={type} />
      <input type="hidden" name="target_id" value={String(id)} />
      <input name="reason" placeholder={t.reason} aria-label={t.reason} className="input !py-1 text-xs" required />
      <button className="text-xs font-semibold text-red-600">{t.send}</button>
    </form>
  );
}
