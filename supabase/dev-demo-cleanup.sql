-- Usuwa wszystkich testowych użytkowników (z obu wersji danych testowych) razem z ich
-- profilami, wiadomościami, członkostwem w grupach, wydarzeniami itd. (kaskadowo).
delete from auth.users where email like '%@demo.beexchange.local' or email like '%@demo.beerasmus.local';
-- Puste grupy, które zostały po testach
delete from public.groups g where not exists (select 1 from public.group_members m where m.group_id = g.id);
