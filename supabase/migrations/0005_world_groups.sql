-- BeeXchange 0005: grupy dla całego świata
--   jadący (zawsze z semestrem):  Polacy na PoliMi · Polacy w Mediolanie · Polacy we Włoszech
--                                 Wszyscy na PoliMi · Wszyscy w Mediolanie (bez „wszyscy w kraju”)
--   absolwenci (bez semestru):    Alumni Włoch w Warszawie (kraj wymiany × miasto uczelni macierzystej)
--   lokalni (bieżący semestr):    studenci uczelni w danym mieście dostają „Wszyscy na <ich uczelni>”
--                                 i „Wszyscy w <ich mieście>”, żeby poznać przyjezdnych i być ich buddy
-- Zostają: trasa (PW → PoliMi · semestr) i absolwenci uczelni (Absolwenci PoliMi z PW).
-- Narodowość = kraj uczelni macierzystej.
-- Uruchom w Supabase → SQL Editor po 0004_groups_unread_account.sql.
-- Plik można bezpiecznie uruchomić ponownie (pomija to, co już istnieje).

alter table public.groups add column if not exists nat_cc text;
alter table public.group_members add column if not exists is_local boolean not null default false;

-- „Wszyscy w kraju” zastępujemy grupami narodowości
delete from public.groups where kind = 'country';
alter table public.groups drop constraint if exists groups_kind_check;
alter table public.groups add constraint groups_kind_check
  check (kind in ('route', 'semester', 'alumni', 'city', 'nat_uni', 'nat_city', 'nat_country', 'alumni_local'));

drop function if exists public.group_suggestions();
drop function if exists public.join_group(text, bigint, bigint);
drop function if exists public.group_key_for(text, bigint, bigint);
drop function if exists public.discover_groups(text, text, text, bigint, text, int);
drop function if exists public.current_semester();
drop function if exists public.group_row(text, text, bigint, bigint, bigint, text, text, text, text, int, boolean, boolean);
drop function if exists public.cities_in_country(text);
drop function if exists public.faculties_at(bigint);
drop function if exists public.fields_at(bigint);

-- Bieżący semestr: zima wrzesień–luty, lato marzec–sierpień
create function public.current_semester() returns text
language sql stable set search_path = '' as $$
  select case
    when extract(month from now()) >= 9 then extract(year from now())::int::text || 'W'
    when extract(month from now()) <= 2 then (extract(year from now())::int - 1)::text || 'W'
    else extract(year from now())::int::text || 'S'
  end;
$$;

-- Klucz grupy. p_exchange_id = moja wymiana; bez wymiany (null) liczy się grupy „lokalne”
-- dla mojej uczelni macierzystej p_home_id w bieżącym semestrze.
create function public.group_key_for(p_kind text, p_exchange_id bigint, p_home_id bigint default null)
returns text
language plpgsql stable set search_path = '' as $$
declare
  x public.exchanges;
  i public.institutions;
  h public.institutions;
begin
  if p_home_id is not null then
    if not exists (select 1 from public.profile_homes where user_id = auth.uid() and institution_id = p_home_id) then
      return null;
    end if;
    select * into h from public.institutions where id = p_home_id;
  end if;

  if p_exchange_id is null then
    if h.id is null then return null; end if;
    if p_kind = 'semester' then return 'semester:' || h.id || ':' || public.current_semester(); end if;
    if p_kind = 'city' and h.city is not null then
      return 'city:' || h.country_code || ':' || lower(h.city) || ':' || public.current_semester();
    end if;
    return null;
  end if;

  select * into x from public.exchanges where id = p_exchange_id and user_id = auth.uid();
  if x.id is null then return null; end if;
  select * into i from public.institutions where id = x.institution_id;
  if p_kind in ('route', 'alumni', 'nat_uni', 'nat_city', 'nat_country', 'alumni_local') and h.id is null then
    return null;
  end if;

  return case p_kind
    when 'route' then 'route:' || h.id || ':' || i.id || ':' || x.semester
    when 'alumni' then 'alumni:' || i.id || ':' || h.id
    when 'semester' then 'semester:' || i.id || ':' || x.semester
    when 'city' then case when i.city is null then null else 'city:' || i.country_code || ':' || lower(i.city) || ':' || x.semester end
    when 'nat_uni' then 'nat_uni:' || h.country_code || ':' || i.id || ':' || x.semester
    when 'nat_city' then case when i.city is null then null
      else 'nat_city:' || h.country_code || ':' || i.country_code || ':' || lower(i.city) || ':' || x.semester end
    when 'nat_country' then 'nat_country:' || h.country_code || ':' || i.country_code || ':' || x.semester
    when 'alumni_local' then case when x.status <> 'been' or h.city is null then null
      else 'alumni_local:' || i.country_code || ':' || h.country_code || ':' || lower(h.city) end
  end;
end;
$$;

-- Jeden wiersz propozycji: grupa (jeśli istnieje), liczba członków, czy już w niej jestem
create function public.group_row(
  p_key text, p_kind text, p_ex bigint, p_inst bigint, p_home bigint, p_city text, p_cc text, p_nat text, p_sem text,
  p_cand int, p_self boolean, p_local boolean
)
returns table (
  kind text, key text, exchange_id bigint, institution_id bigint, home_id bigint, city text, country_code text,
  nat_cc text, semester text, candidates int, self_counted boolean, group_id bigint, members int, is_member boolean, is_local boolean
)
language sql stable set search_path = '' as $$
  select p_kind, p_key, p_ex, p_inst, p_home, p_city, p_cc, p_nat, p_sem, p_cand, p_self, g.id,
    (select count(*)::int from public.group_members gm where gm.group_id = g.id),
    exists (select 1 from public.group_members gm where gm.group_id = g.id and gm.user_id = auth.uid()),
    p_local
  from (select 1) as one
  left join public.groups g on g.key = p_key
  where p_key is not null;
$$;

create function public.group_suggestions()
returns table (
  kind text, key text, exchange_id bigint, institution_id bigint, home_id bigint, city text, country_code text,
  nat_cc text, semester text, candidates int, self_counted boolean, group_id bigint, members int, is_member boolean, is_local boolean
)
language plpgsql stable set search_path = '' as $$
#variable_conflict use_column
declare
  x record;
  h record;
  cur text := public.current_semester();
begin
  -- 1. Grupy moich wymian
  for x in
    select e.id as xid, e.institution_id as inst, e.semester as sem, e.status as st, i.city as icity, i.country_code as cc
    from public.exchanges e join public.institutions i on i.id = e.institution_id
    where e.user_id = auth.uid()
    order by (e.status = 'going') desc, e.semester desc
  loop
    for h in
      select ph.institution_id as hid, hi.country_code as hcc, hi.city as hcity
      from public.profile_homes ph join public.institutions hi on hi.id = ph.institution_id
      where ph.user_id = auth.uid() order by ph.position
    loop
      return query select * from public.group_row(public.group_key_for('route', x.xid, h.hid), 'route', x.xid, x.inst, h.hid, null, x.cc, null, x.sem,
        (select count(distinct e2.user_id)::int from public.exchanges e2 join public.profile_homes h2 on h2.user_id = e2.user_id
          where e2.institution_id = x.inst and e2.semester = x.sem and h2.institution_id = h.hid),
        true, false);

      return query select * from public.group_row(public.group_key_for('nat_uni', x.xid, h.hid), 'nat_uni', x.xid, x.inst, h.hid, null, x.cc, h.hcc, x.sem,
        (select count(distinct e2.user_id)::int from public.exchanges e2
          join public.profile_homes h2 on h2.user_id = e2.user_id join public.institutions hi2 on hi2.id = h2.institution_id
          where e2.institution_id = x.inst and e2.semester = x.sem and hi2.country_code = h.hcc),
        true, false);

      if x.icity is not null then
        return query select * from public.group_row(public.group_key_for('nat_city', x.xid, h.hid), 'nat_city', x.xid, x.inst, h.hid, x.icity, x.cc, h.hcc, x.sem,
          (select count(distinct e2.user_id)::int from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
            join public.profile_homes h2 on h2.user_id = e2.user_id join public.institutions hi2 on hi2.id = h2.institution_id
            where i2.country_code = x.cc and lower(i2.city) = lower(x.icity) and e2.semester = x.sem and hi2.country_code = h.hcc),
          true, false);
      end if;

      return query select * from public.group_row(public.group_key_for('nat_country', x.xid, h.hid), 'nat_country', x.xid, x.inst, h.hid, null, x.cc, h.hcc, x.sem,
        (select count(distinct e2.user_id)::int from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
          join public.profile_homes h2 on h2.user_id = e2.user_id join public.institutions hi2 on hi2.id = h2.institution_id
          where i2.country_code = x.cc and e2.semester = x.sem and hi2.country_code = h.hcc),
        true, false);

      return query select * from public.group_row(public.group_key_for('alumni', x.xid, h.hid), 'alumni', x.xid, x.inst, h.hid, null, x.cc, null, null,
        (select count(distinct e2.user_id)::int from public.exchanges e2 join public.profile_homes h2 on h2.user_id = e2.user_id
          where e2.institution_id = x.inst and e2.status = 'been' and h2.institution_id = h.hid),
        x.st = 'been', false);

      if x.st = 'been' and h.hcity is not null then
        return query select * from public.group_row(public.group_key_for('alumni_local', x.xid, h.hid), 'alumni_local', x.xid, x.inst, h.hid, h.hcity, x.cc, h.hcc, null,
          (select count(distinct e2.user_id)::int from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
            join public.profile_homes h2 on h2.user_id = e2.user_id join public.institutions hi2 on hi2.id = h2.institution_id
            where e2.status = 'been' and i2.country_code = x.cc and hi2.country_code = h.hcc and lower(hi2.city) = lower(h.hcity)),
          true, false);
      end if;
    end loop;

    -- Wszyscy na uczelni / w mieście (w bieżącym semestrze liczą się też lokalni studenci)
    return query select * from public.group_row(public.group_key_for('semester', x.xid), 'semester', x.xid, x.inst, null, null, x.cc, null, x.sem,
      (select count(*)::int from (
        select e2.user_id from public.exchanges e2 where e2.institution_id = x.inst and e2.semester = x.sem
        union select ph.user_id from public.profile_homes ph where ph.institution_id = x.inst and x.sem = cur) u),
      true, false);

    if x.icity is not null then
      return query select * from public.group_row(public.group_key_for('city', x.xid), 'city', x.xid, x.inst, null, x.icity, x.cc, null, x.sem,
        (select count(*)::int from (
          select e2.user_id from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
            where i2.country_code = x.cc and lower(i2.city) = lower(x.icity) and e2.semester = x.sem
          union select ph.user_id from public.profile_homes ph join public.institutions hi on hi.id = ph.institution_id
            where hi.country_code = x.cc and lower(hi.city) = lower(x.icity) and x.sem = cur) u),
        true, false);
    end if;
  end loop;

  -- 2. Jako lokalny: przyjezdni na moich uczelniach i w moich miastach w bieżącym semestrze
  for h in
    select ph.institution_id as hid, hi.country_code as hcc, hi.city as hcity
    from public.profile_homes ph join public.institutions hi on hi.id = ph.institution_id
    where ph.user_id = auth.uid() order by ph.position
  loop
    return query select * from public.group_row(public.group_key_for('semester', null, h.hid), 'semester', null, h.hid, h.hid, null, h.hcc, null, cur,
      (select count(*)::int from (
        select e2.user_id from public.exchanges e2 where e2.institution_id = h.hid and e2.semester = cur
        union select ph2.user_id from public.profile_homes ph2 where ph2.institution_id = h.hid) u),
      true, true);

    if h.hcity is not null then
      return query select * from public.group_row(public.group_key_for('city', null, h.hid), 'city', null, h.hid, h.hid, h.hcity, h.hcc, null, cur,
        (select count(*)::int from (
          select e2.user_id from public.exchanges e2 join public.institutions i2 on i2.id = e2.institution_id
            where i2.country_code = h.hcc and lower(i2.city) = lower(h.hcity) and e2.semester = cur
          union select ph2.user_id from public.profile_homes ph2 join public.institutions hi2 on hi2.id = ph2.institution_id
            where hi2.country_code = h.hcc and lower(hi2.city) = lower(h.hcity)) u),
        true, true);
    end if;
  end loop;
end;
$$;

create function public.join_group(p_kind text, p_exchange_id bigint default null, p_home_id bigint default null) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  k text := public.group_key_for(p_kind, p_exchange_id, p_home_id);
  x public.exchanges;
  i public.institutions;
  h public.institutions;
  sem text;
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if k is null then raise exception 'profile does not match this group'; end if;
  if p_home_id is not null then select * into h from public.institutions where id = p_home_id; end if;
  if p_exchange_id is not null then
    select * into x from public.exchanges where id = p_exchange_id;
    select * into i from public.institutions where id = x.institution_id;
    sem := x.semester;
  else
    i := h; -- lokalny: grupa przyjezdnych na mojej uczelni / w moim mieście
    sem := public.current_semester();
  end if;

  insert into public.groups (kind, key, home_institution_id, exchange_institution_id, city, country_code, nat_cc, semester)
  values (
    p_kind, k,
    case when p_kind in ('route', 'alumni') then h.id end,
    case when p_kind in ('route', 'semester', 'alumni', 'nat_uni') then i.id end,
    case when p_kind in ('city', 'nat_city') then i.city when p_kind = 'alumni_local' then h.city end,
    i.country_code,
    case when p_kind in ('nat_uni', 'nat_city', 'nat_country', 'alumni_local') then h.country_code end,
    case when p_kind in ('alumni', 'alumni_local') then null else sem end
  )
  on conflict (key) do update set key = excluded.key
  returning id into gid;

  insert into public.group_members (group_id, user_id, is_local) values (gid, auth.uid(), p_exchange_id is null)
  on conflict do nothing;
  return gid;
end;
$$;

-- Dołączenie do istniejącej grupy: pasuje → członek (lub lokalny), nie pasuje → gość
create or replace function public.join_group_by_id(p_group_id bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v_local boolean;
  v_found boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select g.key into k from public.groups g where g.id = p_group_id;
  if k is null then raise exception 'group not found'; end if;
  select bool_or(s.is_local) into v_local from public.group_suggestions() s where s.key = k;
  v_found := v_local is not null;
  insert into public.group_members (group_id, user_id, is_guest, is_local)
  values (p_group_id, auth.uid(), not v_found, coalesce(v_local, false))
  on conflict do nothing;
  return p_group_id;
end;
$$;

-- Zakładanie brakującej grupy: tylko „Wszyscy na uczelni” i „Wszyscy w mieście” (bez poziomu kraju)
create or replace function public.create_group(p_kind text, p_sem text, p_inst bigint default null, p_cc text default null, p_city text default null)
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  i public.institutions;
  k text;
  cc text := upper(trim(coalesce(p_cc, '')));
  gid bigint;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if p_sem is null or p_sem !~ '^\d{4}[WS]$' then raise exception 'invalid semester'; end if;
  if p_kind = 'semester' then
    select * into i from public.institutions where id = p_inst and status = 'approved';
    if i.id is null then raise exception 'institution not found'; end if;
    k := 'semester:' || i.id || ':' || p_sem;
    cc := i.country_code;
  elsif p_kind = 'city' then
    if cc !~ '^[A-Z]{2}$' or coalesce(trim(p_city), '') = '' then raise exception 'invalid city'; end if;
    if not exists (select 1 from public.institutions where country_code = cc and lower(city) = lower(trim(p_city))) then
      raise exception 'unknown city';
    end if;
    k := 'city:' || cc || ':' || lower(trim(p_city)) || ':' || p_sem;
  else
    raise exception 'unsupported kind';
  end if;

  insert into public.groups (kind, key, exchange_institution_id, city, country_code, semester)
  values (
    p_kind, k,
    case when p_kind = 'semester' then i.id end,
    case when p_kind = 'city' then (select city from public.institutions where country_code = cc and lower(city) = lower(trim(p_city)) limit 1) end,
    cc, p_sem
  )
  on conflict (key) do update set key = excluded.key
  returning id into gid;

  perform public.join_group_by_id(gid);
  return gid;
end;
$$;

create function public.discover_groups(
  p_kind text default null, p_cc text default null, p_city text default null, p_inst bigint default null, p_sem text default null, lim int default 40
)
returns table (
  id bigint, kind text, key text, home_institution_id bigint, exchange_institution_id bigint, city text, country_code text,
  nat_cc text, semester text, members int, last_message_at timestamptz, is_member boolean
)
language sql stable security definer set search_path = '' as $$
  select
    g.id, g.kind, g.key, g.home_institution_id, g.exchange_institution_id, g.city, g.country_code, g.nat_cc, g.semester,
    (select count(*)::int from public.group_members m where m.group_id = g.id) as members,
    (select max(gm.created_at) from public.group_messages gm where gm.group_id = g.id) as last_message_at,
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid()) as is_member
  from public.groups g
  left join public.institutions ei on ei.id = g.exchange_institution_id
  where auth.uid() is not null
    and (p_kind is null or g.kind = p_kind)
    and (p_cc is null or g.country_code = p_cc)
    and (p_city is null or lower(coalesce(g.city, ei.city)) = lower(p_city))
    and (p_inst is null or g.exchange_institution_id = p_inst)
    and (p_sem is null or g.semester = p_sem)
  order by members desc, last_message_at desc nulls last
  limit lim;
$$;

-- Miasta do wyboru przy wydarzeniach (z bazy uczelni, żeby „Warszawa” i „Warsaw” nie były dwoma miastami)
create function public.cities_in_country(p_cc text) returns table (city text)
language sql stable set search_path = '' as $$
  select distinct i.city from public.institutions i
  where i.country_code = upper(p_cc) and i.city is not null and i.status = 'approved'
  order by 1;
$$;

-- ============ WYDZIAŁ (opcjonalny, przy każdej uczelni macierzystej) ============
-- Na polskich uczelniach umowy Erasmusa, koordynator i uznawanie przedmiotów bywają osobne dla wydziału.
alter table public.profile_homes add column if not exists faculty text;

-- Podpowiedzi: wydziały wpisane już przez innych z tej samej uczelni (najczęstsze najpierw), żeby nazwy się ujednoliciły
create function public.faculties_at(p_inst bigint) returns table (faculty text)
language sql stable set search_path = '' as $$
  select ph.faculty from public.profile_homes ph
  where ph.institution_id = p_inst and coalesce(trim(ph.faculty), '') <> ''
  group by ph.faculty
  order by count(*) desc, ph.faculty
  limit 20;
$$;

-- Wyszukiwarka ludzi: filtr „kierunek lub wydział”
create or replace function public.search_people(
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
      select 1 from public.profile_homes ph
      where ph.user_id = p.id and (ph.field_of_study ilike '%' || p_field || '%' or ph.faculty ilike '%' || p_field || '%')))
    and (p_passion is null or p_passion = any (p.passions))
    and (not p_buddy or p.wants_buddy)
    and (not p_open or p.open_to_questions)
    and (p_q is null or p.full_name ilike '%' || p_q || '%' or p.field_of_study ilike '%' || p_q || '%')
  order by p.wants_buddy desc, p.created_at desc
  limit lim;
$$;

-- Podpowiedzi kierunków: wpisane już przez innych z tej samej uczelni (najczęstsze najpierw)
create function public.fields_at(p_inst bigint) returns table (field text)
language sql stable set search_path = '' as $$
  select ph.field_of_study from public.profile_homes ph
  where ph.institution_id = p_inst and coalesce(trim(ph.field_of_study), '') <> ''
  group by ph.field_of_study
  order by count(*) desc, ph.field_of_study
  limit 20;
$$;
