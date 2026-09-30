-- BeeXchange 0004: odkrywanie grup (goście, zakładanie grup), licznik nieprzeczytanych, usuwanie konta
-- Uruchom w Supabase → SQL Editor po 0003_multi_exchange.sql

-- Gość = członek, którego profil nie pasuje do grupy (np. osoba szukająca wymiany w grupie „Barcelona · zima”)
alter table public.group_members add column is_guest boolean not null default false;

-- Lista grup z filtrami (liczba członków i ostatnia aktywność także dla osób spoza grupy)
create function public.discover_groups(
  p_kind text default null,
  p_cc text default null,
  p_city text default null,
  p_inst bigint default null,
  p_sem text default null,
  lim int default 40
)
returns table (
  id bigint, kind text, key text, home_institution_id bigint, exchange_institution_id bigint,
  city text, country_code text, semester text, members int, last_message_at timestamptz, is_member boolean
)
language sql stable security definer set search_path = '' as $$
  select
    g.id, g.kind, g.key, g.home_institution_id, g.exchange_institution_id, g.city, g.country_code, g.semester,
    (select count(*)::int from public.group_members m where m.group_id = g.id) as members,
    (select max(gm.created_at) from public.group_messages gm where gm.group_id = g.id) as last_message_at,
    exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = auth.uid()) as is_member
  from public.groups g
  left join public.institutions ei on ei.id = g.exchange_institution_id
  where (p_kind is null or g.kind = p_kind)
    and (p_cc is null or g.country_code = p_cc)
    and (p_city is null or lower(coalesce(g.city, ei.city)) = lower(p_city))
    and (p_inst is null or g.exchange_institution_id = p_inst)
    and (p_sem is null or g.semester = p_sem)
  order by members desc, last_message_at desc nulls last
  limit lim;
$$;

-- Dołączenie do istniejącej grupy; jeśli grupa nie pasuje do żadnej z moich wymian, jestem gościem
create function public.join_group_by_id(p_group_id bigint) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  guest boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select g.key into k from public.groups g where g.id = p_group_id;
  if k is null then raise exception 'group not found'; end if;
  guest := not exists (select 1 from public.group_suggestions() s where s.key = k);
  insert into public.group_members (group_id, user_id, is_guest) values (p_group_id, auth.uid(), guest)
  on conflict do nothing;
  return p_group_id;
end;
$$;

-- Założenie grupy, której jeszcze nie ma (uczelnia/miasto/kraj + semestr). Klucze jak w group_key_for,
-- więc osoby dopasowane później automatycznie trafią do tej samej grupy.
create function public.create_group(p_kind text, p_sem text, p_inst bigint default null, p_cc text default null, p_city text default null)
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
  elsif p_kind = 'country' then
    if cc !~ '^[A-Z]{2}$' then raise exception 'invalid country'; end if;
    k := 'country:' || cc || ':' || p_sem;
  else
    raise exception 'unsupported kind';
  end if;

  insert into public.groups (kind, key, exchange_institution_id, city, country_code, semester)
  values (
    p_kind, k,
    case when p_kind = 'semester' then i.id end,
    case when p_kind = 'city' then (select city from public.institutions where country_code = cc and lower(city) = lower(trim(p_city)) limit 1) end,
    cc,
    p_sem
  )
  on conflict (key) do update set key = excluded.key
  returning id into gid;

  perform public.join_group_by_id(gid);
  return gid;
end;
$$;

-- ============ NIEPRZECZYTANE ============
alter table public.group_members add column last_read_at timestamptz not null default now();

create table public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.conversation_reads enable row level security;
create policy "own reads" on public.conversation_reads for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = '' as $$
  insert into public.conversation_reads (conversation_id, user_id, last_read_at)
  select c.id, auth.uid(), now() from public.conversations c
  where c.id = p_conversation and auth.uid() in (c.user_a, c.user_b)
  on conflict (conversation_id, user_id) do update set last_read_at = now();
$$;

create function public.mark_group_read(p_group bigint) returns void
language sql security definer set search_path = '' as $$
  update public.group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid();
$$;

-- Nieprzeczytane w każdej rozmowie i grupie (do kropek na liście czatów i licznika w menu)
create function public.unread_threads()
returns table (kind text, thread_id text, unread int)
language sql stable security definer set search_path = '' as $$
  select 'direct', c.id::text, count(m.id)::int
  from public.conversations c
  join public.messages m on m.conversation_id = c.id and m.sender_id <> auth.uid()
  left join public.conversation_reads r on r.conversation_id = c.id and r.user_id = auth.uid()
  where auth.uid() in (c.user_a, c.user_b) and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by c.id
  union all
  select 'group', gm.group_id::text, count(msg.id)::int
  from public.group_members gm
  join public.group_messages msg on msg.group_id = gm.group_id and msg.sender_id <> auth.uid() and msg.created_at > gm.last_read_at
  where gm.user_id = auth.uid()
  group by gm.group_id
  union all
  select 'requests', 'buddy', count(*)::int
  from public.buddy_requests b
  where b.to_user = auth.uid() and b.status = 'pending'
  having count(*) > 0;
$$;

-- ============ USUWANIE KONTA (RODO) ============
-- Usuwa konto i kaskadowo wszystkie dane: profil, uczelnie, wymiany, członkostwa, wiadomości, wydarzenia, prośby.
-- Zdjęcia z magazynu aplikacja usuwa wcześniej przez API (Supabase nie pozwala kasować plików z SQL).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- ============ PRYWATNOŚĆ: profile tylko dla zalogowanych ============
-- Wcześniej profile, uczelnie macierzyste i wymiany można było odczytać przez API bez logowania.
drop policy "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated using (true);
drop policy "read homes" on public.profile_homes;
create policy "read homes" on public.profile_homes for select to authenticated using (true);
drop policy "read exchanges" on public.exchanges;
create policy "read exchanges" on public.exchanges for select to authenticated using (true);
drop policy "read events" on public.events;
create policy "read events" on public.events for select to authenticated using (true);
drop policy "read attendees" on public.event_attendees;
create policy "read attendees" on public.event_attendees for select to authenticated using (true);
drop policy "read groups" on public.groups;
create policy "read groups" on public.groups for select to authenticated using (true);
