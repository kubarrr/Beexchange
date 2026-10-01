-- BeeXchange 0011: ręczny wybór etapu w profilu (🔍 szukam / ✈️ jadę / 📍 jestem na wymianie / 👑 byłem/am)
-- Domyślnie etap wynika z semestrów wymian. Wybór z profilu obowiązuje do końca bieżącego semestru,
-- potem znów liczymy automatycznie (żeby nikt nie został „na wymianie” na zawsze).
-- Uruchom w Supabase → SQL Editor po 0010_housing.sql. Plik można uruchomić ponownie.

alter table public.profiles add column if not exists stage_choice text;
alter table public.profiles add column if not exists stage_semester text;
alter table public.profiles drop constraint if exists profiles_stage_choice_check;
alter table public.profiles add constraint profiles_stage_choice_check check (stage_choice in ('searching', 'going', 'abroad', 'been'));

create or replace function public.person_stage(p_user uuid) returns text
language sql stable set search_path = '' as $$
  select coalesce(
    (select p.stage_choice from public.profiles p where p.id = p_user and p.stage_semester = public.current_semester()),
    (select case
       when bool_or(e.semester = public.current_semester()) then 'abroad'
       when bool_or(e.semester > public.current_semester()) then 'going'
       when count(e.id) > 0 then 'been'
       else 'searching'
     end
     from public.exchanges e where e.user_id = p_user)
  );
$$;

-- ============ 🧸 BUDDY = OSOBA, KTÓRA NADAL STUDIUJE ============
-- Buddy może być każdy, kto ma choć jedną uczelnię z aktywnym stopniem (nie „ukończone studia”),
-- niezależnie od etapu wymiany. Osoby po studiach pomagają dalej jako 📋 i 🔎, ale nie jako buddy.
create or replace function public.is_student(p_user uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.profile_homes h where h.user_id = p_user and h.study is distinct from 'graduate');
$$;

update public.profiles p set wants_buddy = false where p.wants_buddy and not public.is_student(p.id);

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
    and (not p_buddy or (p.wants_buddy and public.is_student(p.id)))
    and (not p_housing or p.looking_for_housing)
    and (not p_open or p.open_to_questions)
    and (p_q is null or public.words_match(p.full_name, p_q))
  order by p.created_at desc
  limit lim;
$$;
