-- BeeXchange 0010: zakładka Mieszkania (etap 1, bez płatności)
-- • pokoje do przejęcia — wystawia tylko ktoś, kto ma w tym mieście wymianę albo uczelnię macierzystą
-- • 🕵️ sprawdzenie mieszkania na miejscu — prośba do osoby, która jest w tym mieście i się zgłosiła
-- Uruchom w Supabase → SQL Editor po 0009_person_types.sql. Plik można uruchomić ponownie.

-- Zgoda na sprawdzanie mieszkań na miejscu (widoczna w zakładce Mieszkania)
alter table public.profiles add column if not exists checks_housing boolean not null default false;

-- Czy zalogowana osoba jest „stąd”: ma w tym mieście wymianę albo uczelnię macierzystą
drop function if exists public.knows_city(text, text);
create function public.knows_city(p_cc text, p_city text) returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.exchanges e join public.institutions i on i.id = e.institution_id
    where e.user_id = auth.uid() and i.country_code = p_cc and lower(i.city) = lower(p_city)
  ) or exists (
    select 1 from public.profile_homes h join public.institutions i on i.id = h.institution_id
    where h.user_id = auth.uid() and i.country_code = p_cc and lower(i.city) = lower(p_city)
  );
$$;

-- ============ POKOJE DO PRZEJĘCIA ============
create table if not exists public.rooms (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (length(city) between 1 and 80),
  kind text not null default 'room' check (kind in ('room', 'shared', 'flat')),
  title text not null check (length(title) between 3 and 120),
  description text not null default '' check (length(description) <= 3000),
  price int not null check (price between 0 and 100000),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  available_from date not null,
  available_to date,
  area text check (length(area) <= 120),
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  taken boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rooms_place on public.rooms (country_code, lower(city), taken);

alter table public.rooms enable row level security;
drop policy if exists "read rooms" on public.rooms;
drop policy if exists "add room where I live" on public.rooms;
drop policy if exists "edit own room" on public.rooms;
drop policy if exists "delete own room" on public.rooms;
create policy "read rooms" on public.rooms for select to authenticated using (true);
create policy "add room where I live" on public.rooms for insert to authenticated
  with check (author_id = auth.uid() and public.knows_city(country_code, city));
create policy "edit own room" on public.rooms for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete own room" on public.rooms for delete to authenticated using (author_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rooms', 'rooms', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "rooms photos public read" on storage.objects;
drop policy if exists "rooms photos upload own" on storage.objects;
drop policy if exists "rooms photos delete own" on storage.objects;
create policy "rooms photos public read" on storage.objects for select using (bucket_id = 'rooms');
create policy "rooms photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'rooms' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "rooms photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'rooms' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ PROŚBY O SPRAWDZENIE ============
create table if not exists public.check_requests (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  checker_id uuid not null references public.profiles(id) on delete cascade,
  country_code text not null,
  city text not null,
  details text not null check (length(details) between 5 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'done')),
  created_at timestamptz not null default now(),
  check (requester_id <> checker_id)
);
create index if not exists check_requests_checker on public.check_requests (checker_id, status);

alter table public.check_requests enable row level security;
drop policy if exists "read own check requests" on public.check_requests;
drop policy if exists "send check request" on public.check_requests;
drop policy if exists "answer check request" on public.check_requests;
drop policy if exists "cancel check request" on public.check_requests;
create policy "read own check requests" on public.check_requests for select to authenticated using (auth.uid() in (requester_id, checker_id));
-- Prosić można tylko kogoś, kto zgłosił gotowość do sprawdzania
create policy "send check request" on public.check_requests for insert to authenticated
  with check (requester_id = auth.uid() and exists (select 1 from public.profiles p where p.id = checker_id and p.checks_housing));
create policy "answer check request" on public.check_requests for update to authenticated using (checker_id = auth.uid()) with check (checker_id = auth.uid());
create policy "cancel check request" on public.check_requests for delete to authenticated using (requester_id = auth.uid());

-- Kto może sprawdzić mieszkanie w tym mieście: zgłoszeni, którzy są tam teraz na wymianie
-- albo studiują tam na co dzień (uczelnia macierzysta w tym mieście)
drop function if exists public.housing_checkers(text, text);
create function public.housing_checkers(p_cc text, p_city text) returns setof public.profiles
language sql stable set search_path = '' as $$
  select p.* from public.profiles p
  where p.checks_housing and p.id is distinct from auth.uid()
    and (
      exists (select 1 from public.exchanges e join public.institutions i on i.id = e.institution_id
              where e.user_id = p.id and e.semester = public.current_semester() and i.country_code = p_cc and lower(i.city) = lower(p_city))
      or exists (select 1 from public.profile_homes h join public.institutions i on i.id = h.institution_id
              where h.user_id = p.id and i.country_code = p_cc and lower(i.city) = lower(p_city))
    )
  order by p.created_at
  limit 30;
$$;

-- Szukający współlokatora: 🏠 i bieżąca albo przyszła wymiana w tym mieście
drop function if exists public.flatmate_seekers(text, text);
create function public.flatmate_seekers(p_cc text, p_city text) returns setof public.profiles
language sql stable set search_path = '' as $$
  select p.* from public.profiles p
  where p.looking_for_housing and p.id is distinct from auth.uid()
    and exists (select 1 from public.exchanges e join public.institutions i on i.id = e.institution_id
                where e.user_id = p.id and e.semester >= public.current_semester() and i.country_code = p_cc and lower(i.city) = lower(p_city))
  order by p.created_at desc
  limit 60;
$$;
