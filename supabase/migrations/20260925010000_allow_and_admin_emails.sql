-- E-mails liberados individualmente (ex.: testes com e-mail pessoal) e
-- e-mails que viram admin automaticamente no primeiro login.
alter table public.app_config
  add column if not exists allowed_emails text[] not null default '{}',
  add column if not exists admin_emails text[] not null default '{}';

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  cfg public.app_config;
  mail text := lower(new.email);
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
    left(split_part(mail, '@', 1), 40),
    case when mail = any (cfg.admin_emails) then 'admin'::public.user_role else 'student' end
  );
  return new;
end;
$$;
