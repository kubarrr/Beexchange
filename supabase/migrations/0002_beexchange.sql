-- BeeXchange: uczelnie z ROR, rozbudowany profil, grupy dopasowań, buddy, wydarzenia, zdjęcia
-- Uruchom w Supabase → SQL Editor po 0001_init.sql

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ============ UCZELNIE (ROR, CC0) ============
create table public.institutions (
  id bigint generated always as identity primary key,
  ror_id text unique,
  name text not null,
  name_en text,
  name_pl text,
  acronym text,
  search_text text not null default '',   -- małe litery, bez polskich znaków: nazwy, skróty, miasto
  country_code text not null,
  city text,
  website text,
  status text not null default 'approved' check (status in ('approved', 'pending', 'rejected')),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index institutions_search_trgm on public.institutions using gin (search_text extensions.gin_trgm_ops);
create index on public.institutions (country_code);

alter table public.institutions enable row level security;
create policy "read institutions" on public.institutions for select
  using (status = 'approved' or added_by = auth.uid());
create policy "suggest institution" on public.institutions for insert
  with check (auth.uid() = added_by and status = 'pending' and ror_id is null);

create function public.search_institutions(q text, prefer_cc text default null, lim int default 12)
returns setof public.institutions
language sql stable set search_path = '' as $$
  with needle as (select lower(extensions.unaccent(trim(q))) as n)
  select i.*
  from public.institutions i, needle
  where (i.status = 'approved' or i.added_by = auth.uid())
    and length(needle.n) >= 2
    and (i.search_text like '%' || needle.n || '%' or lower(i.acronym) = needle.n)
  order by
    (lower(i.acronym) = needle.n) desc,
    (i.country_code = prefer_cc) desc,
    (i.search_text like needle.n || '%' or i.search_text like '% ' || needle.n || '%') desc,
    length(i.name)
  limit lim;
$$;

-- ============ PROFIL ============
alter table public.profiles
  add column home_institution_id bigint references public.institutions(id) on delete set null,
  add column exchange_institution_id bigint references public.institutions(id) on delete set null,
  add column study_year text,
  add column passions text[] not null default '{}',
  add column languages jsonb not null default '[]',
  add column wants_buddy boolean not null default false,
  add column locale text not null default 'pl';
create index on public.profiles (exchange_institution_id, semester);
create index on public.profiles (home_institution_id);

-- ============ GRUPY DOPASOWAŃ ============
-- route:    uczelnia macierzysta → zagraniczna, ten sam semestr
-- semester: ta sama uczelnia zagraniczna i semestr
-- alumni:   absolwenci danej uczelni zagranicznej z Twojej uczelni macierzystej
-- city:     to samo miasto i semestr (wszystkie uczelnie)
create table public.groups (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('route', 'semester', 'alumni', 'city')),
  key text unique not null,
  home_institution_id bigint references public.institutions(id) on delete cascade,
  exchange_institution_id bigint references public.institutions(id) on delete cascade,
  city text,
  country_code text,
  semester text,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.group_messages (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.group_messages (group_id, created_at);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create policy "read groups" on public.groups for select using (true);
create policy "read members" on public.group_members for select using (auth.uid() is not null);
create policy "leave group" on public.group_members for delete using (auth.uid() = user_id);

create function public.is_group_member(gid bigint) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create policy "read group messages" on public.group_messages for select using (public.is_group_member(group_id));
create policy "send group messages" on public.group_messages for insert
  with check (auth.uid() = sender_id and public.is_group_member(group_id));

-- Klucz grupy danego rodzaju dla zalogowanego użytkownika (null = nie pasuje)
create function public.my_group_key(p_kind text) returns text
language plpgsql stable set search_path = '' as $$
declare
  me public.profiles;
  ex public.institutions;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.exchange_institution_id is null then return null; end if;
  select * into ex from public.institutions where id = me.exchange_institution_id;
  if p_kind = 'route' and me.home_institution_id is not null and me.semester is not null then
    return 'route:' || me.home_institution_id || ':' || me.exchange_institution_id || ':' || me.semester;
  elsif p_kind = 'semester' and me.semester is not null then
    return 'semester:' || me.exchange_institution_id || ':' || me.semester;
  elsif p_kind = 'alumni' and me.home_institution_id is not null then
    return 'alumni:' || me.exchange_institution_id || ':' || me.home_institution_id;
  elsif p_kind = 'city' and me.semester is not null and ex.city is not null then
    return 'city:' || ex.country_code || ':' || lower(ex.city) || ':' || me.semester;
  end if;
  return null;
end;
$$;

-- Propozycje grup: ile osób pasuje, czy grupa już istnieje, czy jestem w niej
create function public.group_suggestions()
returns table (kind text, key text, candidates int, group_id bigint, members int, is_member boolean)
language plpgsql stable set search_path = '' as $$
declare
  me public.profiles;
  ex public.institutions;
  k text;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.exchange_institution_id is null then return; end if;
  select * into ex from public.institutions where id = me.exchange_institution_id;

  foreach k in array array['route', 'semester', 'alumni', 'city'] loop
    if public.my_group_key(k) is null then continue; end if;
    return query
      select
        k,
        public.my_group_key(k),
        (select count(*)::int from public.profiles p
          left join public.institutions pi on pi.id = p.exchange_institution_id
          where case k
            when 'route' then p.home_institution_id = me.home_institution_id and p.exchange_institution_id = me.exchange_institution_id and p.semester = me.semester
            when 'semester' then p.exchange_institution_id = me.exchange_institution_id and p.semester = me.semester
            when 'alumni' then p.exchange_institution_id = me.exchange_institution_id and p.home_institution_id = me.home_institution_id and p.status = 'been'
            else pi.country_code = ex.country_code and lower(pi.city) = lower(ex.city) and p.semester = me.semester
          end),
        g.id,
        (select count(*)::int from public.group_members gm where gm.group_id = g.id),
        exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid())
      from (select 1) as one
      left join public.groups g on g.key = public.my_group_key(k);
  end loop;
end;
$$;

-- Dołączenie do grupy danego rodzaju (tworzy ją, jeśli nie istnieje)
create function public.join_group(p_kind text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles;
  ex public.institutions;
  k text := public.my_group_key(p_kind);
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if k is null then raise exception 'profile does not match this group'; end if;
  select * into me from public.profiles where id = auth.uid();
  select * into ex from public.institutions where id = me.exchange_institution_id;

  insert into public.groups (kind, key, home_institution_id, exchange_institution_id, city, country_code, semester)
  values (
    p_kind, k,
    case when p_kind in ('route', 'alumni') then me.home_institution_id end,
    case when p_kind <> 'city' then me.exchange_institution_id end,
    case when p_kind = 'city' then ex.city end,
    ex.country_code,
    case when p_kind <> 'alumni' then me.semester end
  )
  on conflict (key) do update set key = excluded.key
  returning id into gid;

  insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end;
$$;

-- ============ BUDDY ============
create table public.buddy_requests (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  message text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);
alter table public.buddy_requests enable row level security;
create policy "read own buddy requests" on public.buddy_requests for select using (auth.uid() in (from_user, to_user));
create policy "send buddy request" on public.buddy_requests for insert
  with check (auth.uid() = from_user and exists (select 1 from public.profiles p where p.id = to_user and p.wants_buddy));
create policy "answer buddy request" on public.buddy_requests for update using (auth.uid() = to_user);
create policy "cancel buddy request" on public.buddy_requests for delete using (auth.uid() = from_user);

-- ============ WYDARZENIA ============
create table public.events (
  id bigint generated always as identity primary key,
  title text not null check (length(title) between 3 and 150),
  description text not null default '',
  starts_at timestamptz not null,
  is_online boolean not null default false,
  city text,
  country_code text,
  location text,
  link text,
  audience text not null default 'all' check (audience in ('all', 'alumni', 'going')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.events (starts_at);

create table public.event_attendees (
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (event_id, user_id)
);

alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
create policy "read events" on public.events for select using (true);
create policy "create events" on public.events for insert with check (auth.uid() = created_by);
create policy "edit own events" on public.events for update using (auth.uid() = created_by);
create policy "delete own events" on public.events for delete using (auth.uid() = created_by);
create policy "read attendees" on public.event_attendees for select using (true);
create policy "attend" on public.event_attendees for insert with check (auth.uid() = user_id);
create policy "unattend" on public.event_attendees for delete using (auth.uid() = user_id);

-- ============ ZDJĘCIA PROFILOWE ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ CZAT NA ŻYWO ============
alter publication supabase_realtime add table public.group_messages;
