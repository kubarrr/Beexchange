import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (!code) {
    // Supabase przekazuje tu powód błędu, np. otp_expired (link wygasł lub został już użyty)
    const reason = searchParams.get("error_code") ?? searchParams.get("error") ?? "missing_code";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.code ?? "exchange_failed")}`);

  // Nowa osoba bez wpisu → najpierw „Mój wpis” (chyba że szła do konkretnej wyszukiwarki)
  const { data: person } = await supabase.from("simple_people").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!person && safeNext === "/") return NextResponse.redirect(`${origin}/me`);

  return NextResponse.redirect(`${origin}${safeNext}`);
}
