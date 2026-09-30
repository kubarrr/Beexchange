-- BeErasmus: schemat startowy
-- Uruchom w Supabase: SQL Editor → wklej całość → Run

-- ============ MIASTA I UCZELNIE ============
create table public.cities (
  id bigint generated always as identity primary key,
  slug text unique not null,
  name text not null,
  country text not null,
  country_flag text not null default '',
  description text not null default '',
  tips text not null default '',
  avg_rent int,          -- orientacyjny czynsz za pokój (EUR/mies.)
  avg_monthly_cost int,  -- orientacyjny koszt życia łącznie z pokojem (EUR/mies.)
  created_at timestamptz not null default now()
);

create table public.universities (
  id bigint generated always as identity primary key,
  slug text unique not null,
  city_id bigint not null references public.cities(id) on delete cascade,
  name text not null,
  short_name text,
  website text,
  english_courses boolean not null default true,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index on public.universities(city_id);

-- ============ PROFILE ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  home_university text not null default '',
  field_of_study text not null default '',
  status text not null default 'searching' check (status in ('searching', 'going', 'been')),
  destination_university_id bigint references public.universities(id) on delete set null,
  semester text,
  open_to_questions boolean not null default false,
  bio text not null default '',
  onboarded boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.profiles(destination_university_id);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ OPINIE ============
create table public.reviews (
  id bigint generated always as identity primary key,
  university_id bigint not null references public.universities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  semester text,
  rating_university smallint not null check (rating_university between 1 and 5),
  rating_city smallint not null check (rating_city between 1 and 5),
  rating_social smallint not null check (rating_social between 1 and 5),
  rating_housing smallint not null check (rating_housing between 1 and 5),   -- łatwość znalezienia mieszkania
  rating_exams smallint not null check (rating_exams between 1 and 5),       -- łatwość zaliczeń
  rent_paid int,
  neighborhood text,
  body text not null default '',
  created_at timestamptz not null default now(),
  unique (university_id, author_id)
);

-- ============ UZNAWANE PRZEDMIOTY ============
create table public.course_matches (
  id bigint generated always as identity primary key,
  university_id bigint not null references public.universities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  foreign_course text not null,
  ects numeric(4,1),
  home_university text not null,
  home_course text not null,
  field_of_study text,
  note text,
  created_at timestamptz not null default now()
);
create index on public.course_matches(university_id);

-- ============ PYTANIA I ODPOWIEDZI ============
create table public.questions (
  id bigint generated always as identity primary key,
  city_id bigint not null references public.cities(id) on delete cascade,
  university_id bigint references public.universities(id) on delete set null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);
create index on public.questions(city_id);

create table public.answers (
  id bigint generated always as identity primary key,
  question_id bigint not null references public.questions(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.answers(question_id);

create table public.answer_votes (
  answer_id bigint not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (answer_id, user_id)
);

-- ============ MIESZKANIA ============
create table public.listings (
  id bigint generated always as identity primary key,
  city_id bigint not null references public.cities(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  price int,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.listings(city_id);

-- ============ WIADOMOŚCI ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages(conversation_id, created_at);

create function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_created
  after insert on public.messages
  for each row execute function public.touch_conversation();

-- Zwraca istniejącą rozmowę z danym użytkownikiem albo tworzy nową
create function public.get_or_create_conversation(other_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  conv uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if other_user = me then raise exception 'cannot message yourself'; end if;
  a := least(me, other_user);
  b := greatest(me, other_user);
  select id into conv from public.conversations where user_a = a and user_b = b;
  if conv is null then
    insert into public.conversations (user_a, user_b) values (a, b) returning id into conv;
  end if;
  return conv;
end;
$$;

-- ============ CHECKLISTA ============
create table public.checklist_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null,
  done_at timestamptz not null default now(),
  primary key (user_id, item_key)
);

-- ============ ZGŁOSZENIA ============
create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

-- ============ STATYSTYKI ============
create view public.university_stats with (security_invoker = on) as
select
  u.id as university_id,
  count(r.id)::int as review_count,
  round(avg(r.rating_university), 1) as avg_university,
  round(avg(r.rating_city), 1) as avg_city,
  round(avg(r.rating_social), 1) as avg_social,
  round(avg(r.rating_housing), 1) as avg_housing,
  round(avg(r.rating_exams), 1) as avg_exams,
  round(avg((r.rating_university + r.rating_city + r.rating_social + r.rating_housing + r.rating_exams) / 5.0), 1) as avg_overall,
  round(avg(r.rent_paid))::int as avg_rent_paid
from public.universities u
left join public.reviews r on r.university_id = u.id
group by u.id;

create view public.city_stats with (security_invoker = on) as
select
  c.id as city_id,
  count(r.id)::int as review_count,
  round(avg((r.rating_university + r.rating_city + r.rating_social + r.rating_housing + r.rating_exams) / 5.0), 1) as avg_overall,
  round(avg(r.rent_paid))::int as avg_rent_paid,
  (select count(*)::int from public.profiles p join public.universities u2 on u2.id = p.destination_university_id where u2.city_id = c.id) as people_count
from public.cities c
left join public.universities u on u.city_id = c.id
left join public.reviews r on r.university_id = u.id
group by c.id;

-- ============ RLS ============
alter table public.cities enable row level security;
alter table public.universities enable row level security;
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.course_matches enable row level security;
alter table public.questions enable row level security;
alter table public.answers enable row level security;
alter table public.answer_votes enable row level security;
alter table public.listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.checklist_progress enable row level security;
alter table public.reports enable row level security;

-- Publiczny odczyt
create policy "read cities" on public.cities for select using (true);
create policy "read universities" on public.universities for select using (true);
create policy "read profiles" on public.profiles for select using (true);
create policy "read reviews" on public.reviews for select using (true);
create policy "read course_matches" on public.course_matches for select using (true);
create policy "read questions" on public.questions for select using (true);
create policy "read answers" on public.answers for select using (true);
create policy "read votes" on public.answer_votes for select using (true);
create policy "read listings" on public.listings for select using (true);

-- Własne dane
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

create policy "insert own reviews" on public.reviews for insert with check (auth.uid() = author_id);
create policy "update own reviews" on public.reviews for update using (auth.uid() = author_id);
create policy "delete own reviews" on public.reviews for delete using (auth.uid() = author_id);

create policy "insert own course_matches" on public.course_matches for insert with check (auth.uid() = author_id);
create policy "delete own course_matches" on public.course_matches for delete using (auth.uid() = author_id);

create policy "insert own questions" on public.questions for insert with check (auth.uid() = author_id);
create policy "delete own questions" on public.questions for delete using (auth.uid() = author_id);

create policy "insert own answers" on public.answers for insert with check (auth.uid() = author_id);
create policy "delete own answers" on public.answers for delete using (auth.uid() = author_id);

create policy "insert own votes" on public.answer_votes for insert with check (auth.uid() = user_id);
create policy "delete own votes" on public.answer_votes for delete using (auth.uid() = user_id);

create policy "insert own listings" on public.listings for insert with check (auth.uid() = author_id);
create policy "update own listings" on public.listings for update using (auth.uid() = author_id);
create policy "delete own listings" on public.listings for delete using (auth.uid() = author_id);

-- Rozmowy: tylko uczestnicy (tworzone przez get_or_create_conversation)
create policy "read own conversations" on public.conversations for select
  using (auth.uid() in (user_a, user_b));

create policy "read own messages" on public.messages for select
  using (exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
create policy "send messages" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
  );

create policy "own checklist" on public.checklist_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "insert reports" on public.reports for insert with check (auth.uid() = reporter_id);

-- Czat na żywo
alter publication supabase_realtime add table public.messages;
