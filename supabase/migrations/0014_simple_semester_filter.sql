-- BeErasm 0014: filtr semestru w wyszukiwarce („Jadą” i „Są lub byli”).
-- Funkcje dostają opcjonalny parametr p_sem (np. '2027S'); bez niego działają jak dotąd.

drop function if exists public.simple_search(text, text, text, bigint);
drop function if exists public.simple_search(text, text, text, bigint, text);
create function public.simple_search(p_kind text, p_cc text, p_city text, p_inst bigint default null, p_sem text default null)
returns table (
  entry_id bigint, user_id uuid, display_name text, instagram text, facebook text, whatsapp text,
  home_id bigint, institution_id bigint, semester text, looking_for_housing boolean, is_buddy boolean
)
language sql stable set search_path = '' as $$
  (
    select e.id, p.user_id, p.display_name, p.instagram, p.facebook, p.whatsapp, p.home_institution_id, e.institution_id, e.semester, p.looking_for_housing, p.is_buddy
    from public.simple_entries e
    join public.simple_people p on p.user_id = e.user_id
    join public.institutions i on i.id = e.institution_id
    where p_kind <> 'helper'
      and public.simple_tab(e.kind, e.semester) = p_kind
      and i.country_code = p_cc and lower(i.city) = lower(p_city)
      and (p_inst is null or e.institution_id = p_inst)
      and (p_sem is null or e.semester = p_sem)
    order by e.semester desc nulls last, e.created_at desc
    limit 100
  )
  union all
  (
    select -abs(hashtext(p.user_id::text))::bigint, p.user_id, p.display_name, p.instagram, p.facebook, p.whatsapp, p.home_institution_id, p.home_institution_id, null::text, p.looking_for_housing, p.is_buddy
    from public.simple_people p
    join public.institutions i on i.id = p.home_institution_id
    where p_kind = 'helper' and p.is_buddy
      and i.country_code = p_cc and lower(i.city) = lower(p_city)
      and (p_inst is null or p.home_institution_id = p_inst)
    order by p.updated_at desc
    limit 100
  );
$$;
revoke execute on function public.simple_search(text, text, text, bigint, text) from public, anon;
grant execute on function public.simple_search(text, text, text, bigint, text) to authenticated;

drop function if exists public.simple_count(text, text, text, bigint);
drop function if exists public.simple_count(text, text, text, bigint, text);
create function public.simple_count(p_kind text, p_cc text, p_city text, p_inst bigint default null, p_sem text default null)
returns integer
language sql stable security definer set search_path = '' as $$
  select case when p_kind = 'helper' then
    (select count(*)::int from public.simple_people p join public.institutions i on i.id = p.home_institution_id
     where p.is_buddy and i.country_code = p_cc and lower(i.city) = lower(p_city) and (p_inst is null or p.home_institution_id = p_inst))
  else
    (select count(*)::int from public.simple_entries e join public.institutions i on i.id = e.institution_id
     where public.simple_tab(e.kind, e.semester) = p_kind and i.country_code = p_cc and lower(i.city) = lower(p_city)
       and (p_inst is null or e.institution_id = p_inst)
       and (p_sem is null or e.semester = p_sem))
  end;
$$;
revoke execute on function public.simple_count(text, text, text, bigint, text) from public;
grant execute on function public.simple_count(text, text, text, bigint, text) to anon, authenticated;
