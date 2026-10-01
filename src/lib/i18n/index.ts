import { cookies } from "next/headers";
import { dictionaries, type Dictionary, type Locale } from "./dictionaries";

export { type Dictionary, type Locale } from "./dictionaries";

// Domyślnie angielski (aplikacja jest międzynarodowa); polski po wybraniu PL w nagłówku (ciasteczko „lang”)
export async function getLocale(): Promise<Locale> {
  const cookie = (await cookies()).get("lang")?.value;
  return cookie === "pl" ? "pl" : "en";
}

export async function getDictionary(): Promise<{ t: Dictionary; locale: Locale }> {
  const locale = await getLocale();
  return { t: dictionaries[locale], locale };
}
