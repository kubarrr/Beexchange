import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Link z maila (szablony w supabase/email-templates): działa w każdej przeglądarce,
// bo nie wymaga ciasteczka PKCE z przeglądarki, w której wpisano adres.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = searchParams.get("next") ?? "/roj";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/roj";

  if (!tokenHash) return NextResponse.redirect(`${origin}/login?error=missing_token`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.code ?? "verify_failed")}`);
  }

  const { data: profile } = await supabase.from("profiles").select("home_institution_id").eq("id", data.user.id).single();
  if (profile && !profile.home_institution_id) return NextResponse.redirect(`${origin}/onboarding`);
  return NextResponse.redirect(`${origin}${safeNext}`);
}
