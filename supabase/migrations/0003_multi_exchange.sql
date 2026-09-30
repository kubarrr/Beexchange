-- BeeXchange 0003: wiele uczelni macierzystych i wiele wymian na profil, grupy krajowe,
-- wyszukiwarka ludzi (kraj, miasto) i poprawka wyszukiwarki uczelni.
-- Uruchom w Supabase → SQL Editor po 0002_beexchange.sql

-- ============ WYSZUKIWARKA UCZELNI (poprawka) ============
-- Uczelnie bez skrótu trafiały na początek wyników (NULL sortuje się przed true), np. „uw” → Friesland College.
create or replace function public.search_institutions(q text, prefer_cc text default null, lim int default 12)
returns setof public.institutions
language sql stable set search_path = '' as $$
  with needle as (select lower(extensions.unaccent(trim(q))) as n)
  select i.*
  from public.institutions i, needle
  where (i.status = 'approved' or i.added_by = auth.uid())
    and length(needle.n) >= 2
    and (i.search_text like '%' || needle.n || '%' or lower(i.acronym) = needle.n)
  order by
    coalesce(lower(i.acronym) = needle.n, false) desc,
    coalesce(i.country_code = prefer_cc, false) desc,
    (i.search_text like needle.n || '%' or i.search_text like '% ' || needle.n || '%') desc,
    length(i.name)
  limit lim;
$$;

-- ============ UCZELNIE MACIERZYSTE (wiele) ============
create table public.profile_homes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution_id bigint not null references public.institutions(id) on delete cascade,
  field_of_study text not null default '',
  study text,                       -- "stopień:rok", np. "master:2"
  position smallint not null default 0,
  primary key (user_id, institution_id)
);
create index on public.profile_homes (institution_id);

-- ============ WYMIANY (wiele) ============
create table public.exchanges (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution_id bigint not null references public.institutions(id) on delete cascade,
  semester text not null check (semester ~ '^\d{4}[WS]$'),
  status text not null check (status in ('going', 'been')),
  created_at timestamptz not null default now(),
  unique (user_id, institution_id, semester)
);
create index on public.exchanges (institution_id, semester);
create index on public.exchanges (user_id);

alter table public.profile_homes enable row level security;
alter table public.exchanges enable row level security;
create policy "read homes" on public.profile_homes for select using (true);
create policy "manage own homes" on public.profile_homes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "read exchanges" on public.exchanges for select using (true);
create policy "manage own exchanges" on public.exchanges for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Przeniesienie istniejących profili (kolumny w profiles zostają jako „główna” uczelnia i wymiana)
insert into public.profile_homes (user_id, institution_id, field_of_study, study)
select id, home_institution_id, field_of_study, study_year from public.profiles where home_institution_id is not null
on conflict do nothing;
insert into public.exchanges (user_id, institution_id, semester, status)
select id, exchange_institution_id, semester, case when status = 'been' then 'been' else 'going' end
from public.profiles
where exchange_institution_id is not null and semester ~ '^\d{4}[WS]$'
on conflict do nothing;

-- ============ GRUPY: nowy rodzaj „country” ============
alter table public.groups drop constraint groups_kind_check;
alter table public.groups add constraint groups_kind_check check (kind in ('route', 'semester', 'alumni', 'city', 'country'));

drop function if exists public.group_suggestions();
drop function if exists public.join_group(text);
drop function if exists public.my_group_key(text);

-- Klucz grupy dla mojej wymiany (i ewentualnie mojej uczelni macierzystej); null = nie pasuje
-- route:    uczelnia macierzysta → zagraniczna, ten sam semestr
-- semester: ta sama uczelnia zagraniczna i semestr
-- alumni:   absolwenci danej uczelni zagranicznej z danej uczelni macierzystej
-- city:     to samo miasto i semestr
-- country:  ten sam kraj i semestr
create function public.group_key_for(p_kind text, p_exchange_id bigint, p_home_id bigint default null)
returns text
language plpgsql stable set search_path = '' as $$
declare
  x public.exchanges;
  i public.institutions;
begin
  select * into x from public.exchanges where id = p_exchange_id and user_id = auth.uid();
  if x.id is null then return null; end if;
  select * into i from public.institutions where id = x.institution_id;
  if p_kind in ('route', 'alumni') and (p_home_id is null or not exists (
    select 1 from public.profile_homes where user_id = auth.uid() and institution_id = p_home_id)) then
    return null;
  end if;
  return case p_kind
    when 'route' then 'route:' || p_home_id || ':' || x.institution_id || ':' || x.semester
    when 'semester' then 'semester:' || x.institution_id || ':' || x.semester
    when 'alumni' then 'alumni:' || x.institution_id || ':' || p_home_id
    when 'city' then case when i.city is null then null else 'city:' || i.country_code || ':' || lower(i.city) || ':' || x.semester end
    when 'country' then 'country:' || i.country_code || ':' || x.semester
  end;
end;
$$;

-- Propozycje grup dla wszystkich moich wymian
create function public.group_suggestions()
returns table (
  kind text, key text, exchange_id bigint, institution_id bigint, home_id bigint, city text, country_code text, semester text,
  candidates int, self_counted boolean, group_id bigint, members int, is_member boolean
)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  x record;
  h record;
  k text;
begin
  for x in
    select e.id as xid, e.institution_id as inst, e.semester as sem, e.status as st, i.city as icity, i.country_code as cc
    from public.exchanges e join public.institutions i on i.id = e.institution_id
    where e.user_id = auth.uid()
    order by (e.status = 'going') desc, e.semester desc
  loop
    for h in select ph.institution_id as hid from public.profile_homes ph where ph.user_id = auth.uid() order by ph.position loop
      k := public.group_key_for('route', x.xid, h.hid);
      return query
        select 'route'::text, k, x.xid, x.inst, h.hid, null::text, x.cc, x.sem,
          (select count(distinct e2.user_id)::int from public.exchanges e2 join public.profile_homes h2 on h2.user_id = e2.user_id
            where e2.institution_id = x.inst and e2.semester = x.sem and h2.institution_id = h.hid),
          true, g.id,
          (select count(*)::int from public.group_members gm where gm.group_id = g.id),
          exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid())
        from (select 1) as one left join public.groups g on g.key = k;

      k := public.group_key_for('alumni', x.xid, h.hid);
      return query
        select 'alumni'::text, k, x.xid, x.inst, h.hid, null::text, x.cc, null::text,
          (select count(distinct e2.user_id)::int from public.exchanges e2 join public.profile_homes h2 on h2.user_id = e2.user_id
            where e2.institution_id = x.inst and e2.status = 'been' and h2.institution_id = h.hid),
          x.st = 'been', g.id,
          (select count(*)::int from public.group_members gm where gm.group_id = g.id),
          exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid())
        from (select 1) as one left join public.groups g on g.key = k;
    end loop;

    k := public.group_key_for('semester', x.xid);
    return query
      select 'semester'::text, k, x.xid, x.inst, null::bigint, null::text, x.cc, x.sem,
        (select count(distinct e2.user_id)::int from public.exchanges e2 where e2.institution_id = x.inst and e2.semester = x.sem),
        true, g.id,
        (select count(*)::int from public.group_members gm where gm.group_id = g.id),
        exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid())
      from (select 1) as one left join public.groups g on g.key = k;

    if x.icity is not null then
      k := public.group_key_for('city', x.xid);
      return query
        select 'city'::text, k, x.xid, x.inst, null::bigint, x.icity, x.cc, x.sem,
          (select count(distinct e2.user_id)::int from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
            where i2.country_code = x.cc and lower(i2.city) = lower(x.icity) and e2.semester = x.sem),
          true, g.id,
          (select count(*)::int from public.group_members gm where gm.group_id = g.id),
          exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid())
        from (select 1) as one left join public.groups g on g.key = k;
    end if;

    k := public.group_key_for('country', x.xid);
    return query
      select 'country'::text, k, x.xid, x.inst, null::bigint, null::text, x.cc, x.sem,
        (select count(distinct e2.user_id)::int from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
          where i2.country_code = x.cc and e2.semester = x.sem),
        true, g.id,
        (select count(*)::int from public.group_members gm where gm.group_id = g.id),
        exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid())
      from (select 1) as one left join public.groups g on g.key = k;
  end loop;
end;
$$;

-- Dołączenie do grupy (tworzy ją, jeśli nie istnieje)
create function public.join_group(p_kind text, p_exchange_id bigint, p_home_id bigint default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  k text := public.group_key_for(p_kind, p_exchange_id, p_home_id);
  x public.exchanges;
  i public.institutions;
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if k is null then raise exception 'profile does not match this group'; end if;
  select * into x from public.exchanges where id = p_exchange_id;
  select * into i from public.institutions where id = x.institution_id;

  insert into public.groups (kind, key, home_institution_id, exchange_institution_id, city, country_code, semester)
  values (
    p_kind, k,
    case when p_kind in ('route', 'alumni') then p_home_id end,
    case when p_kind in ('route', 'semester', 'alumni') then x.institution_id end,
    case when p_kind = 'city' then i.city end,
    i.country_code,
    case when p_kind <> 'alumni' then x.semester end
  )
  on conflict (key) do update set key = excluded.key
  returning id into gid;

  insert into public.group_members (group_id, user_id) values (gid, auth.uid()) on conflict do nothing;
  return gid;
end;
$$;

-- ============ WYSZUKIWARKA LUDZI ============
create function public.search_people(
  p_seg text default 'all',
  p_inst bigint default null,
  p_sem text default null,
  p_city text default null,
  p_cc text default null,
  p_home_only boolean default false,
  p_field text default null,
  p_passion text default null,
  p_buddy boolean default false,
  p_open boolean default false,
  p_q text default null,
  lim int default 60
)
returns setof public.profiles
language sql stable set search_path = '' as $$
  select p.*
  from public.profiles p
  where p.home_institution_id is not null
    and p.id is distinct from auth.uid()
    and (
      (p_inst is null and p_sem is null and p_city is null and p_cc is null and p_seg = 'all')
      or exists (
        select 1 from public.exchanges e join public.institutions i on i.id = e.institution_id
        where e.user_id = p.id
          and (p_inst is null or e.institution_id = p_inst)
          and (p_sem is null or e.semester = p_sem)
          and (p_city is null or lower(i.city) = lower(p_city))
          and (p_cc is null or i.country_code = p_cc)
          and (p_seg = 'all' or e.status = p_seg)
      )
    )
    and (not p_home_only or exists (
      select 1 from public.profile_homes a join public.profile_homes b on a.institution_id = b.institution_id
      where a.user_id = p.id and b.user_id = auth.uid()))
    and (p_field is null or exists (
      select 1 from public.profile_homes ph where ph.user_id = p.id and ph.field_of_study ilike '%' || p_field || '%'))
    and (p_passion is null or p_passion = any (p.passions))
    and (not p_buddy or p.wants_buddy)
    and (not p_open or p.open_to_questions)
    and (p_q is null or p.full_name ilike '%' || p_q || '%' or p.field_of_study ilike '%' || p_q || '%')
  order by p.wants_buddy desc, p.created_at desc
  limit lim;
$$;
