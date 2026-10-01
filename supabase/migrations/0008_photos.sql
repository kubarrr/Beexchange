-- BeeXchange 0008: zdjęcia wydarzeń i zdjęcia miast
-- Uruchom w Supabase → SQL Editor po 0007_people_search.sql. Plik można uruchomić ponownie.

-- ============ ZDJĘCIE WYDARZENIA ============
alter table public.events add column if not exists cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('events', 'events', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "events photos public read" on storage.objects;
drop policy if exists "events photos upload own" on storage.objects;
drop policy if exists "events photos delete own" on storage.objects;
create policy "events photos public read" on storage.objects for select using (bucket_id = 'events');
create policy "events photos upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'events' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "events photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'events' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============ ZDJĘCIA MIAST ============
-- Wgrywa je skrypt (npm run import:places) z Wikimedia Commons, razem z autorem i licencją do podpisu.
create table if not exists public.place_photos (
  country_code text not null,
  city text not null,
  url text not null,
  author text not null default '',
  license text not null default '',
  source_url text not null default '',
  primary key (country_code, city)
);
alter table public.place_photos enable row level security;
drop policy if exists "read place photos" on public.place_photos;
create policy "read place photos" on public.place_photos for select to authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('places', 'places', true, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
drop policy if exists "places public read" on storage.objects;
create policy "places public read" on storage.objects for select using (bucket_id = 'places');
