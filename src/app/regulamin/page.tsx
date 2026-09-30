import type { Metadata } from "next";
import { LegalDoc } from "@/components/LegalDoc";
import { getDictionary } from "@/lib/i18n";
import { TERMS } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getDictionary();
  return { title: TERMS[locale].title };
}

export default async function TermsPage() {
  const { locale } = await getDictionary();
  return <LegalDoc {...TERMS[locale]} />;
}
