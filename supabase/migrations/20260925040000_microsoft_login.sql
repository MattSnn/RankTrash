-- Login com a conta Microsoft da Facens: o perfil nasce com o nome real
-- (primeiro + último nome) em vez do RA/parte do e-mail.

create or replace function public.format_person_name(raw text)
returns text
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
  picked as (
    select w, ord from words where ord = (select min(ord) from words)
    union all
    select w, ord from words where ord = (select max(ord) from words) and (select count(*) from words) > 1
  )
  select left(coalesce(string_agg(initcap(w), ' ' order by ord), ''), 40) from picked
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cfg public.app_config;
  mail text := lower(new.email);
  real_name text := public.format_person_name(
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  );
begin
  select * into cfg from public.app_config limit 1;
  if cardinality(cfg.allowed_email_domains) > 0
     and not (split_part(mail, '@', 2) = any (cfg.allowed_email_domains))
     and not (mail = any (cfg.allowed_emails)) then
    raise exception 'E-mail fora do domínio permitido (%).', array_to_string(cfg.allowed_email_domains, ', ');
  end if;
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(real_name, ''), left(split_part(mail, '@', 1), 40)),
    case when mail = any (cfg.admin_emails) then 'admin'::public.user_role else 'student' end
  );
  return new;
end;
$$;

revoke execute on function public.format_person_name(text) from public, anon, authenticated;
