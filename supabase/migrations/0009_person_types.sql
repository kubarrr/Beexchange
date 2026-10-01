-- BeeXchange 0009: typy osób (🔍 szuka, ✈️ jedzie, 📍 na wymianie, 👑 absolwent), 🏠 szukam mieszkania,
-- 📋 pomoc przed wyjazdem dla osób z tej samej uczelni macierzystej.
-- Uruchom w Supabase → SQL Editor po 0008_photos.sql. Plik można uruchomić ponownie.

alter table public.profiles add column if not exists looking_for_housing boolean not null default false;
alter table public.profiles add column if not exists helps_departure boolean not null default false;

-- Status wymiany wynika z semestru: przeszły semestr = „byłem”, bieżący i przyszły = „jadę/jestem”
update public.exchanges set status = case when semester < public.current_semester() then 'been' else 'going' end
where status is distinct from case when semester < public.current_semester() then 'been' else 'going' end;

-- Typ osoby z jej wymian: bieżący semestr → abroad, przyszły → going, tylko przeszłe → been, brak → searching
drop function if exists public.person_stage(uuid);
create function public.person_stage(p_user uuid) returns text
language sql stable set search_path = '' as $$
  select case
    when bool_or(e.semester = public.current_semester()) then 'abroad'
    when bool_or(e.semester > public.current_semester()) then 'going'
    when count(e.id) > 0 then 'been'
    else 'searching'
  end
  from public.exchanges e where e.user_id = p_user;
$$;

drop function if exists public.search_people(text, bigint, text, text, text, boolean, text, text, boolean, boolean, text, int, bigint);
drop function if exists public.search_people(text, bigint, text, text, text, boolean, text, text, boolean, boolean, text, int, bigint, boolean);
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
  p_home bigint default null,
  p_housing boolean default false
)
returns setof public.profiles
language sql stable set search_path = '' as $$
  select p.*
  from public.profiles p
  where p.home_institution_id is not null
    and p.id is distinct from auth.uid()
    and (p_seg = 'all' or public.person_stage(p.id) = p_seg)
    and (
      (p_inst is null and p_sem is null and p_city is null and p_cc is null)
      or exists (
        select 1 from public.exchanges e join public.institutions i on i.id = e.institution_id
        where e.user_id = p.id
          and (p_inst is null or e.institution_id = p_inst)
          and (p_sem is null or e.semester = p_sem)
          and (p_city is null or lower(i.city) = lower(p_city))
          and (p_cc is null or i.country_code = p_cc)
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
    and (not p_buddy or (p.wants_buddy and public.person_stage(p.id) <> 'been'))
    and (not p_housing or p.looking_for_housing)
    and (not p_open or p.open_to_questions)
    and (p_q is null or public.words_match(p.full_name, p_q))
  order by p.created_at desc
  limit lim;
$$;
