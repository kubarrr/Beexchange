-- BeeXchange (wersja prosta): wyszukiwarka osób zamiast pełnej aplikacji.
-- Przechowujemy minimum: imię lub ksywkę, uczelnię macierzystą, do trzech linków (Instagram, Facebook,
-- WhatsApp) i wpisy „jadę / jestem lub byłem / pomagam” z uczelnią i opcjonalnym semestrem.
-- Osobne tabele — pełna wersja aplikacji (gałąź main) działa dalej bez zmian.
-- Uruchom w Supabase → SQL Editor. Plik można uruchomić ponownie.

create table if not exists public.simple_people (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 2 and 60),
  home_institution_id bigint references public.institutions(id) on delete set null,
  instagram text check (length(instagram) <= 60),
  facebook text check (length(facebook) <= 200),
  whatsapp text check (whatsapp ~ '^\+?[0-9 ]{6,20}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.simple_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.simple_people(user_id) on delete cascade,
  kind text not null check (kind in ('going', 'been', 'helper')),
  institution_id bigint not null references public.institutions(id) on delete cascade,
  semester text check (semester ~ '^\d{4}[WS]$'),
  created_at timestamptz not null default now()
);
create unique index if not exists simple_entries_unique on public.simple_entries (user_id, kind, institution_id, coalesce(semester, ''));
create index if not exists simple_entries_kind_inst on public.simple_entries (kind, institution_id);

-- Dane osób widzą tylko zalogowani; każdy edytuje tylko siebie
alter table public.simple_people enable row level security;
alter table public.simple_entries enable row level security;
drop policy if exists "simple people read" on public.simple_people;
drop policy if exists "simple people own" on public.simple_people;
drop policy if exists "simple entries read" on public.simple_entries;
drop policy if exists "simple entries own" on public.simple_entries;
create policy "simple people read" on public.simple_people for select to authenticated using (true);
create policy "simple people own" on public.simple_people for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "simple entries read" on public.simple_entries for select to authenticated using (true);
create policy "simple entries own" on public.simple_entries for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Wyszukiwanie: rodzaj wpisu + kraj i miasto uczelni, opcjonalnie konkretna uczelnia.
-- Tylko dla zalogowanych (zwraca imiona i kontakty).
drop function if exists public.simple_search(text, text, text, bigint);
create function public.simple_search(p_kind text, p_cc text, p_city text, p_inst bigint default null)
returns table (
  entry_id bigint, user_id uuid, display_name text, instagram text, facebook text, whatsapp text,
  home_id bigint, institution_id bigint, semester text
)
language sql stable set search_path = '' as $$
  select e.id, p.user_id, p.display_name, p.instagram, p.facebook, p.whatsapp, p.home_institution_id, e.institution_id, e.semester
  from public.simple_entries e
  join public.simple_people p on p.user_id = e.user_id
  join public.institutions i on i.id = e.institution_id
  where e.kind = p_kind
    and i.country_code = p_cc
    and lower(i.city) = lower(p_city)
    and (p_inst is null or e.institution_id = p_inst)
  order by e.semester desc nulls last, e.created_at desc
  limit 100;
$$;
revoke execute on function public.simple_search(text, text, text, bigint) from public, anon;
grant execute on function public.simple_search(text, text, text, bigint) to authenticated;

-- Liczba wyników dla niezalogowanych (bez żadnych danych osób) — zachęta do zalogowania
drop function if exists public.simple_count(text, text, text, bigint);
create function public.simple_count(p_kind text, p_cc text, p_city text, p_inst bigint default null)
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int
  from public.simple_entries e join public.institutions i on i.id = e.institution_id
  where e.kind = p_kind and i.country_code = p_cc and lower(i.city) = lower(p_city)
    and (p_inst is null or e.institution_id = p_inst);
$$;
grant execute on function public.simple_count(text, text, text, bigint) to anon, authenticated;

-- Miasta z uczelniami w danym kraju są potrzebne też niezalogowanym (wybór miasta w wyszukiwarce)
grant execute on function public.cities_in_country(text) to anon;
