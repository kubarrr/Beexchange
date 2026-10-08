import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import { HiveBackground } from "@/components/HiveBackground";
import { getDictionary } from "@/lib/i18n";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "latin-ext"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: { default: "BeeXchange: exchange together", template: "%s · BeeXchange" },
    description: t.meta.description,
    appleWebApp: { capable: true, title: "BeeXchange", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = { themeColor: "#FFC52E" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { t, locale } = await getDictionary();

  return (
    <html lang={locale} className={`${onest.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <HiveBackground />
        <Header />
        <main className="flex-1 pb-10">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          <p>{t.footer.made}</p>
          <p className="mt-2 flex justify-center gap-4">
            <Link href="/terms" className="hover:text-ink">
              {t.footer.terms}
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              {t.footer.privacy}
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
