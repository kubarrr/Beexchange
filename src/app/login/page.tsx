import Link from "next/link";
import { LogoHero, Wordmark } from "@/components/Logo";
import { getDictionary } from "@/lib/i18n";
import { localizedTitle } from "@/lib/i18n/meta";
import { LoginForm } from "./LoginForm";

export const generateMetadata = localizedTitle((t) => t.login.title);

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const { t, locale } = await getDictionary();
  const errorText =
    error === "otp_expired" || error === "access_denied"
      ? t.login.expired
      : error === "bad_code_verifier" || error === "flow_state_not_found" || error === "exchange_failed"
        ? t.login.otherBrowser
        : t.login.failed;

  return (
    <div className="mx-auto max-w-sm px-5 py-12">
      <div className="panel p-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoHero />
          <Wordmark className="mt-1 text-3xl" />
          <h1 className="display mt-5 text-2xl">{t.login.title}</h1>
          <p className="mt-1 text-sm text-muted">{t.login.lead}</p>
        </div>
        {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorText}</p>}
        <LoginForm next={nextPath} locale={locale} />
        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          {t.login.consentA}
          <Link href="/terms" className="font-semibold underline">
            {t.login.terms}
          </Link>
          {t.login.consentAnd}
          <Link href="/privacy" className="font-semibold underline">
            {t.login.privacy}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
