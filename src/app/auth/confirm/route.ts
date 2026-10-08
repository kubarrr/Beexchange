import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Link z maila (szablony w supabase/email-templates): działa w każdej przeglądarce,
// bo nie wymaga ciasteczka PKCE z przeglądarki, w której wpisano adres.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") ?? "email") as EmailOtpType;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!tokenHash) return NextResponse.redirect(`${origin}/login?error=missing_token`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error?.code ?? "verify_failed")}`);
  }

  // Nowa osoba bez wpisu → najpierw „Mój wpis” (chyba że szła do konkretnej wyszukiwarki)
  const { data: person } = await supabase.from("simple_people").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!person && safeNext === "/") return NextResponse.redirect(`${origin}/me`);
  return NextResponse.redirect(`${origin}${safeNext}`);
}
