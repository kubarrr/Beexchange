import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  const prefer = request.nextUrl.searchParams.get("prefer");
  if (q.length < 2) return NextResponse.json([]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_institutions", {
    q,
    prefer_cc: prefer && /^[A-Z]{2}$/.test(prefer) ? prefer : null,
    lim: 8,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    (data ?? []).map((i: Record<string, unknown>) => ({
      id: i.id,
      name: i.name,
      name_en: i.name_en,
      name_pl: i.name_pl,
      acronym: i.acronym,
      country_code: i.country_code,
      city: i.city,
      status: i.status,
    })),
  );
}
