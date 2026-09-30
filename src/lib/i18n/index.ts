import { cookies, headers } from "next/headers";
import { dictionaries, type Dictionary, type Locale } from "./dictionaries";

export { type Dictionary, type Locale } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookie = (await cookies()).get("lang")?.value;
  if (cookie === "pl" || cookie === "en") return cookie;
  const langs = ((await headers()).get("accept-language") ?? "")
    .toLowerCase()
    .split(",")
    .map((l) => l.split(";")[0].trim())
    .filter((l) => l && l !== "*");
  if (!langs.length || langs.some((l) => l.startsWith("pl"))) return "pl";
  return "en";
}

export async function getDictionary(): Promise<{ t: Dictionary; locale: Locale }> {
  const locale = await getLocale();
  return { t: dictionaries[locale], locale };
}
