import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/roj";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    // Supabase przekazuje tu powód błędu, np. otp_expired (link wygasł lub został już użyty)
    const reason = searchParams.get("error_code") ?? searchParams.get("error") ?? "missing_code";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.code ?? "exchange_failed")}`);

  // Nowy użytkownik → najpierw profil
  const { data: profile } = await supabase.from("profiles").select("home_institution_id").eq("id", data.user.id).single();
  if (profile && !profile.home_institution_id) return NextResponse.redirect(`${origin}/onboarding`);

  return NextResponse.redirect(`${origin}${safeNext}`);
}
