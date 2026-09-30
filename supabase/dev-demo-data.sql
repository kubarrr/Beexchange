-- ⚠️ TYLKO DO TESTÓW: fikcyjni użytkownicy, żeby zobaczyć, jak BeeXchange wygląda „z ludźmi”.
-- Przed publicznym startem usuń ich plikiem dev-demo-cleanup.sql.
-- Uruchom w Supabase → SQL Editor PO: 0001_init.sql, 0002_beexchange.sql i imporcie uczelni (npm run import:institutions).
-- Po zalogowaniu ustaw w profilu: SGH → Bocconi, zima 2026/27, żeby zobaczyć pełny rój.

-- 1. Konta testowe (profil tworzy się automatycznie z triggera)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  u.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  u.email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.name), now(), now(),
  '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001', 'kasia@demo.beexchange.local',  'Kasia Nowak'),
  ('00000000-0000-4000-8000-000000000002', 'michal@demo.beexchange.local', 'Michał Wiśniewski'),
  ('00000000-0000-4000-8000-000000000003', 'ola@demo.beexchange.local',    'Ola Zielińska'),
  ('00000000-0000-4000-8000-000000000004', 'bartek@demo.beexchange.local', 'Bartek Kowalczyk'),
  ('00000000-0000-4000-8000-000000000005', 'marta@demo.beexchange.local',  'Marta Kaczmarek'),
  ('00000000-0000-4000-8000-000000000006', 'adam@demo.beexchange.local',   'Adam Pawlak'),
  ('00000000-0000-4000-8000-000000000007', 'piotr@demo.beexchange.local',  'Piotr Sikora'),
  ('00000000-0000-4000-8000-000000000008', 'kuba@demo.beexchange.local',   'Kuba Szymański'),
  ('00000000-0000-4000-8000-000000000009', 'ania@demo.beexchange.local',   'Ania Wróbel')
) as u(id, email, name)
on conflict (id) do nothing;

-- 2. Profile
update public.profiles p set
  home_institution_id = (select id from public.institutions where name = v.home limit 1),
  exchange_institution_id = (select id from public.institutions where name = v.exchange limit 1),
  status = v.status, semester = v.semester, field_of_study = v.field, study_year = v.year,
  passions = v.passions, languages = v.langs, bio = v.bio,
  open_to_questions = true, wants_buddy = v.buddy, onboarded = true
from (values
  ('00000000-0000-4000-8000-000000000001', 'SGH Warsaw School of Economics', 'Bocconi University', 'been', '2025W', 'Finanse i rachunkowość', 'V rok', array['travel','coffee','photography','mountains'], '["polski", "angielski C1", "włoski B1"]'::jsonb, true,
   'Semestr na Bocconi to był najlepszy czas na studiach. Chętnie pomogę z Learning Agreement i szukaniem mieszkania w Mediolanie.'),
  ('00000000-0000-4000-8000-000000000007', 'SGH Warsaw School of Economics', 'Bocconi University', 'been', '2026S', 'Ekonomia', 'IV rok', array['football','startups','travel'], '["polski", "angielski C1"]'::jsonb, true,
   'Wróciłem w czerwcu. Pytajcie o kursy z finansów i życie w Porta Romana.'),
  ('00000000-0000-4000-8000-000000000005', 'SGH Warsaw School of Economics', 'Bocconi University', 'going', '2026W', 'Finanse i rachunkowość', 'III rok', array['travel','coffee','volleyball'], '["polski", "angielski C1"]'::jsonb, false,
   'Lecę na Bocconi w zimie! Szukam ludzi do wspólnego mieszkania.'),
  ('00000000-0000-4000-8000-000000000006', 'SGH Warsaw School of Economics', 'Bocconi University', 'going', '2026W', 'Metody ilościowe', 'III rok', array['gym','music','travel'], '["polski", "angielski B2"]'::jsonb, false,
   'Budżet na pokój ok. 800 €, szukam współlokatora.'),
  ('00000000-0000-4000-8000-000000000009', 'University of Warsaw', 'Bocconi University', 'going', '2026W', 'Finanse', 'II rok magisterki', array['art','coffee','dance'], '["polski", "angielski C1", "włoski A2"]'::jsonb, false,
   'Z UW na Bocconi, ktoś jeszcze?'),
  ('00000000-0000-4000-8000-000000000002', 'Warsaw University of Technology', 'Politecnico di Milano', 'been', '2026S', 'Informatyka', 'I rok magisterki', array['gaming','mountains','cooking'], '["polski", "angielski C1"]'::jsonb, true,
   'Polimi, Città Studi, dużo nauki i jeszcze więcej pizzy.'),
  ('00000000-0000-4000-8000-000000000004', 'AGH University of Krakow', 'Politecnico di Milano', 'going', '2026W', 'Automatyka i robotyka', 'IV rok', array['running','startups'], '["polski", "angielski B2"]'::jsonb, false,
   'Szukam współlokatora w okolicy Città Studi!'),
  ('00000000-0000-4000-8000-000000000003', 'Jagiellonian University', 'Universitat de Barcelona', 'been', '2025W', 'Filologia hiszpańska', 'V rok', array['dance','travel','parties'], '["polski", "hiszpański C1", "angielski B2"]'::jsonb, true,
   'Barcelona ❤️ Znam Gràcię jak własną kieszeń.'),
  ('00000000-0000-4000-8000-000000000008', 'Adam Mickiewicz University in Poznań', 'University of Bologna', 'been', '2025S', 'Psychologia', 'absolwent', array['music','cinema','cooking'], '["polski", "włoski B2"]'::jsonb, true,
   'Bolonia to najbardziej studenckie miasto, w jakim byłem.')
) as v(id, home, exchange, status, semester, field, year, passions, langs, buddy, bio)
where p.id = v.id::uuid;

-- 3. Grupa „SGH → Bocconi · zima 2026/27” z rozmową
with g as (
  insert into public.groups (kind, key, home_institution_id, exchange_institution_id, country_code, semester)
  select 'route', 'route:' || h.id || ':' || e.id || ':2026W', h.id, e.id, e.country_code, '2026W'
  from public.institutions h, public.institutions e
  where h.name = 'SGH Warsaw School of Economics' and e.name = 'Bocconi University'
  on conflict (key) do update set key = excluded.key
  returning id
), m as (
  insert into public.group_members (group_id, user_id)
  select g.id, u::uuid from g, unnest(array['00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006']) as u
  on conflict do nothing
  returning group_id
)
insert into public.group_messages (group_id, sender_id, body, created_at)
select g.id, x.sender::uuid, x.body, now() - x.ago::interval
from g, (values
  ('00000000-0000-4000-8000-000000000005', 'Hej! Ktoś już ogarnia mieszkanie? Myślałam o Porta Romana', '2 hours'),
  ('00000000-0000-4000-8000-000000000006', 'Ja szukam, możemy razem! Budżet ok. 800 €', '100 minutes'),
  ('00000000-0000-4000-8000-000000000005', 'Super, to piszmy tutaj jak coś znajdziemy', '90 minutes')
) as x(sender, body, ago);

-- 4. Wydarzenia
insert into public.events (title, description, starts_at, is_online, city, country_code, location, audience, created_by) values
('Zjazd absolwentów Włoch', 'Wieczór dla wszystkich po wymianie we Włoszech. Przyjdź też, jeśli dopiero jedziesz, i zapytaj na żywo.',
  date_trunc('day', now()) + interval '14 days 19 hours', false, 'Warszawa', 'PL', 'Miejsce podamy zapisanym', 'alumni', '00000000-0000-4000-8000-000000000001'),
('Q&A na żywo: Mediolan', 'Trzy osoby po Bocconi i Polimi odpowiadają na pytania o mieszkania, kursy i życie w Mediolanie.',
  date_trunc('day', now()) + interval '6 days 20 hours', true, null, null, null, 'going', '00000000-0000-4000-8000-000000000002'),
('Aperitivo Polaków na Bocconi', 'Poznajmy się na miejscu w pierwszym tygodniu semestru!',
  date_trunc('day', now()) + interval '40 days 18 hours 30 minutes', false, 'Mediolan', 'IT', 'Navigli', 'going', '00000000-0000-4000-8000-000000000005');

insert into public.event_attendees (event_id, user_id)
select e.id, u::uuid from public.events e, unnest(array['00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000007']) as u
where e.created_by::text like '00000000-0000-4000-8000-%'
on conflict do nothing;
