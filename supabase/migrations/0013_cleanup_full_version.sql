-- BeeXchange 0013: sprzątanie po pełnej wersji aplikacji przed startem wersji prostej.
--
-- ⚠️ URUCHOM DOPIERO, GDY PRODUKCJA (gałąź main, beexchange.vercel.app) DZIAŁA JUŻ JAKO WERSJA PROSTA.
--    Wcześniej pełna wersja przestanie działać. Tego nie da się cofnąć — dane pełnej wersji znikną.
--
-- Zostaje tylko to, czego używa wersja prosta:
--   • institutions (baza uczelni) • simple_people, simple_entries (wpisy) • konta logowania (auth.users)
--   • funkcje: current_semester, simple_tab, simple_search, simple_count, cities_in_country,
--     search_institutions, delete_my_account
-- Pliki ze Storage (avatars, events, rooms, places) i konta demo/testowe usuwa skrypt:
--   node scripts/cleanup-full-version.mjs

-- 1. Kto dodał uczelnię: odwołanie z profiles przenosimy na konta logowania
alter table public.institutions drop constraint if exists institutions_added_by_fkey;
alter table public.institutions add constraint institutions_added_by_fkey foreign key (added_by) references auth.users(id) on delete set null;

-- 2. Nowe konto nie tworzy już profilu pełnej wersji
drop trigger if exists on_auth_user_created on auth.users;

-- 3. Widoki i tabele pełnej wersji (razem z ich danymi, politykami i realtime)
drop view if exists public.university_stats, public.city_stats cascade;
drop table if exists
  public.answer_votes, public.answers, public.questions,
  public.buddy_requests, public.check_requests, public.checklist_progress,
  public.conversation_reads, public.messages, public.conversations,
  public.course_matches, public.reviews, public.listings,
  public.event_attendees, public.events,
  public.group_messages, public.group_members, public.groups,
  public.exchanges, public.profile_homes, public.rooms,
  public.place_photos, public.institution_catalog, public.reports,
  public.universities, public.cities, public.profiles
  cascade;

-- 4. Funkcje pełnej wersji: usuwamy wszystkie z public poza potrzebnymi (funkcji rozszerzeń nie ruszamy)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname not in ('current_semester', 'simple_tab', 'simple_search', 'simple_count', 'cities_in_country', 'search_institutions', 'delete_my_account')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;

-- 5. Uprawnienia do starych folderów ze zdjęciami (same pliki i foldery usuwa skrypt)
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars upload own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;
drop policy if exists "avatars delete own" on storage.objects;
drop policy if exists "events photos public read" on storage.objects;
drop policy if exists "events photos upload own" on storage.objects;
drop policy if exists "events photos delete own" on storage.objects;
drop policy if exists "rooms photos public read" on storage.objects;
drop policy if exists "rooms photos upload own" on storage.objects;
drop policy if exists "rooms photos delete own" on storage.objects;
drop policy if exists "places public read" on storage.objects;
