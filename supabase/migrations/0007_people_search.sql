-- BeeXchange 0007: wyszukiwanie ludzi po filtrach (uczelnia macierzysta, uczelnia wymiany, kierunek/wydział)
-- Uruchom w Supabase → SQL Editor po 0006_catalog.sql. Plik można uruchomić ponownie.

create extension if not exists unaccent with schema extensions;

-- Luźne dopasowanie tekstu: każde słowo z zapytania musi wystąpić w tekście, w dowolnej kolejności,
-- bez względu na wielkość liter i polskie znaki. Dłuższe słowa porównujemy bez końcówki,
-- żeby „finansów” znalazło „Finanse”, a „informatyki” — „Informatyka”.
drop function if exists public.words_match(text, text);
create function public.words_match(hay text, needle text) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(bool_and(
    extensions.unaccent(lower(coalesce(hay, ''))) like
      '%' || left(w, case when length(w) >= 6 then length(w) - 2 when length(w) = 5 then 4 else length(w) end) || '%'
  ), true)
  from unnest(regexp_split_to_array(extensions.unaccent(lower(trim(coalesce(needle, '')))), '[^[:alnum:]]+')) as w
  where length(w) >= 2;
$$;

drop function if exists public.search_people(text, bigint, text, text, text, boolean, text, text, boolean, boolean, text, int);
drop function if exists public.search_people(text, bigint, text, text, text, boolean, text, text, boolean, boolean, text, int, bigint);
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
  lim int default 60,
  p_home bigint default null
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
    and (p_home is null or exists (
      select 1 from public.profile_homes h where h.user_id = p.id and h.institution_id = p_home))
    and (not p_home_only or exists (
      select 1 from public.profile_homes a join public.profile_homes b on a.institution_id = b.institution_id
      where a.user_id = p.id and b.user_id = auth.uid()))
    and (p_field is null or exists (
      select 1 from public.profile_homes ph
      where ph.user_id = p.id
        and (p_home is null or ph.institution_id = p_home)
        and public.words_match(concat_ws(' ', ph.field_of_study, ph.faculty), p_field)))
    and (p_passion is null or p_passion = any (p.passions))
    and (not p_buddy or p.wants_buddy)
    and (not p_open or p.open_to_questions)
    and (p_q is null or public.words_match(p.full_name, p_q))
  order by p.wants_buddy desc, p.created_at desc
  limit lim;
$$;
