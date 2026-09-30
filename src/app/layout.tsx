import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/AppNav";
import { getCurrentUser, unreadTotal } from "@/lib/auth";
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
  const { userId } = await getCurrentUser();
  const unread = await unreadTotal();

  return (
    <html lang={locale} className={`${onest.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Header />
        <main className={`flex-1 ${userId ? "pb-28 md:pb-10" : ""}`}>{children}</main>
        {userId && <BottomNav locale={locale} unread={unread} />}
        <footer className={`border-t border-line py-6 text-center text-xs text-muted ${userId ? "hidden md:block" : ""}`}>
          <p>{t.footer.made}</p>
          <p className="mt-2 flex justify-center gap-4">
            <Link href="/regulamin" className="hover:text-ink">
              {t.footer.terms}
            </Link>
            <Link href="/prywatnosc" className="hover:text-ink">
              {t.footer.privacy}
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}
