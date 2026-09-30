import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";
import { getDictionary } from "@/lib/i18n";
import { PRIVACY } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDictionary();
  return { title: PRIVACY[locale].title };
}

export default async function PrivacyPage() {
  const { locale } = await getDictionary();
  return <LegalDoc {...PRIVACY[locale]} />;
}
