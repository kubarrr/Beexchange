import type { Metadata } from "next";
import { getDictionary, type Dictionary } from "@/lib/i18n";

// Tytuł karty przeglądarki w języku użytkownika
export function localizedTitle(pick: (t: Dictionary) => string) {
  return async function generateMetadata(): Promise<Metadata> {
    const { t } = await getDictionary();
    return { title: pick(t) };
  };
}
