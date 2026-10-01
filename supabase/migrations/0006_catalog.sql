-- BeeXchange 0006: oficjalne wydziały i kierunki uczelni (podpowiedzi w profilu)
-- Dane wgrywa skrypt: npm run import:catalog (z pliku data/catalog.json).
-- Uruchom w Supabase → SQL Editor po 0005_world_groups.sql. Plik można uruchomić ponownie.

create table if not exists public.institution_catalog (
  id bigint generated always as identity primary key,
  institution_id bigint not null references public.institutions(id) on delete cascade,
  kind text not null check (kind in ('faculty', 'field')),
  name text not null,
  unique (institution_id, kind, name)
);
create index if not exists institution_catalog_inst on public.institution_catalog (institution_id, kind);

alter table public.institution_catalog enable row level security;
drop policy if exists "read catalog" on public.institution_catalog;
create policy "read catalog" on public.institution_catalog for select to authenticated using (true);

-- Podpowiedzi: najpierw nazwy najczęściej wpisywane przez ludzi z tej uczelni, potem pozostałe oficjalne (alfabetycznie).
-- Ta sama nazwa (bez względu na wielkość liter) pojawia się tylko raz.
drop function if exists public.faculties_at(bigint);
create function public.faculties_at(p_inst bigint) returns table (faculty text)
language sql stable set search_path = '' as $$
  with used as (
    select ph.faculty as name, count(*) as n from public.profile_homes ph
    where ph.institution_id = p_inst and coalesce(trim(ph.faculty), '') <> ''
    group by ph.faculty
  ), official as (
    select c.name, 0 as n from public.institution_catalog c where c.institution_id = p_inst and c.kind = 'faculty'
  ), merged as (
    select distinct on (lower(name)) name, n from (select * from used union all select * from official) a
    order by lower(name), n desc
  )
  select name from merged order by n desc, name limit 80;
$$;

drop function if exists public.fields_at(bigint);
create function public.fields_at(p_inst bigint) returns table (field text)
language sql stable set search_path = '' as $$
  with used as (
    select ph.field_of_study as name, count(*) as n from public.profile_homes ph
    where ph.institution_id = p_inst and coalesce(trim(ph.field_of_study), '') <> ''
    group by ph.field_of_study
  ), official as (
    select c.name, 0 as n from public.institution_catalog c where c.institution_id = p_inst and c.kind = 'field'
  ), merged as (
    select distinct on (lower(name)) name, n from (select * from used union all select * from official) a
    order by lower(name), n desc
  )
  select name from merged order by n desc, name limit 200;
$$;
