-- Nome no ranking = nome real: só vale uma das combinações do nome da conta Microsoft
-- (primeiro + último, primeiro + cada sobrenome do meio, ou o nome completo). Espelha nameSuggestions (src/lib/names.ts).

create or replace function public.name_suggestions(raw text)
returns text[]
language sql immutable
set search_path = public
as $$
  with words as (
    select w, ord
      from regexp_split_to_table(lower(regexp_replace(coalesce(raw, ''), '\(.*?\)|\[.*?\]', ' ', 'g')), '[\s,]+')
           with ordinality as t(w, ord)
     where w ~ '[[:alpha:]]'
       and w not in ('da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von')
  ),
  f as (select w from words order by ord limit 1),
  l as (select w from words order by ord desc limit 1),
  opts as (
    select 1 as k, left(initcap((select w from f) || coalesce(' ' || nullif((select w from l), (select w from f)), '')), 40) as name
    union all
    select 2, left(initcap((select w from f) || ' ' || w), 40)
      from words where ord > (select min(ord) from words) and ord < (select max(ord) from words)
    union all
    select 3, left(initcap((select string_agg(w, ' ' order by ord) from words)), 40)
  )
  select coalesce(array_agg(distinct name), '{}') from opts where name is not null and name <> ''
$$;

create or replace function public.enforce_real_name()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  options text[];
begin
  -- admin e serviços (sem usuário logado) podem ajustar livremente
  if new.display_name is not distinct from old.display_name or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  select public.name_suggestions(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'))
    into options from auth.users u where u.id = new.id;
  if cardinality(options) > 0 and not (lower(new.display_name) = any (select lower(o) from unnest(options) o)) then
    raise exception 'Escolha um dos nomes sugeridos (use seu nome real).';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_real_name() from public, anon, authenticated;
revoke execute on function public.name_suggestions(text) from public, anon, authenticated;

create trigger profiles_real_name before update of display_name on public.profiles
  for each row execute function public.enforce_real_name();
