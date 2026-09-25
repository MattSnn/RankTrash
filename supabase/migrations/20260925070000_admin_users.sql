-- Gestão de usuários pelo admin: banir para sempre (pelo e-mail), apagar registros e excluir conta.
-- As ações que mexem no Auth e no Storage ficam na Edge Function admin-users (service role).

create table public.banned_emails (
  email text primary key check (email = lower(email)),
  reason text,
  banned_at timestamptz not null default now(),
  banned_by uuid
);
alter table public.banned_emails enable row level security;
revoke all on public.banned_emails from anon, authenticated;

alter table public.profiles
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text;

-- Cadastro: além do domínio, recusa e-mail banido.
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
  if exists (select 1 from public.banned_emails where email = mail) then
    raise exception 'Conta banida do RankTrash.';
  end if;
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

-- Banido não registra descarte (vale mesmo com um token ainda válido).
create or replace function public.block_banned_disposal()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.profiles where id = new.user_id and banned_at is not null) then
    raise exception 'Conta suspensa.';
  end if;
  return new;
end;
$$;
revoke execute on function public.block_banned_disposal() from public, anon, authenticated;
create trigger disposals_block_banned before insert on public.disposals
  for each row execute function public.block_banned_disposal();

-- Ranking e letreiro ignoram banidos.
create or replace function public.leaderboard(p_season uuid default null, p_limit integer default 50)
returns table (pos bigint, user_id uuid, display_name text, course text, points bigint, disposals bigint)
language sql security definer set search_path = public
as $$
  with s as (select coalesce(p_season, (public.current_season()).id) as id),
  totals as (
    select d.user_id, sum(d.points)::bigint as points, count(*)::bigint as disposals, max(d.created_at) as last_at
    from public.disposals d, s
    where d.season_id = s.id and d.status = 'approved'
    group by d.user_id
  )
  select rank() over (order by t.points desc), t.user_id, p.display_name, p.course, t.points, t.disposals
  from totals t join public.profiles p on p.id = t.user_id
  where p.banned_at is null
  order by t.points desc, t.last_at asc
  limit p_limit;
$$;

create or replace function public.weekly_leaderboard(p_limit integer default 50)
returns table (pos bigint, user_id uuid, display_name text, course text, points bigint, disposals bigint)
language sql stable security definer set search_path = public
as $$
  with totals as (
    select d.user_id, sum(d.points)::bigint as points, count(*)::bigint as disposals, max(d.created_at) as last_at
    from public.disposals d
    where d.created_at > now() - interval '7 days' and d.status = 'approved'
    group by d.user_id
  )
  select rank() over (order by t.points desc), t.user_id, p.display_name, p.course, t.points, t.disposals
  from totals t join public.profiles p on p.id = t.user_id
  where p.banned_at is null
  order by t.points desc, t.last_at asc
  limit p_limit;
$$;

create or replace function public.course_leaderboard(p_season uuid default null)
returns table (pos bigint, course text, points bigint, players bigint)
language sql security definer set search_path = public
as $$
  with s as (select coalesce(p_season, (public.current_season()).id) as id),
  totals as (
    select p.course, sum(d.points)::bigint as points, count(distinct d.user_id)::bigint as players
    from public.disposals d join public.profiles p on p.id = d.user_id, s
    where d.season_id = s.id and d.status = 'approved' and p.course <> '' and p.banned_at is null
    group by p.course
  )
  select rank() over (order by points desc), course, points, players from totals order by points desc;
$$;

create or replace function public.public_feed(p_limit integer default 15)
returns table (display_name text, item_label text, material public.material, bin_name text, points integer, created_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.display_name, d.item_label, d.material, b.name, d.points, d.created_at
  from public.disposals d
  join public.profiles p on p.id = d.user_id
  left join public.bins b on b.id = d.bin_id
  where d.status = 'approved' and p.banned_at is null
  order by d.created_at desc
  limit least(p_limit, 50);
$$;

-- Lista para a aba USUÁRIOS (só admin). Inclui e-mails banidos cuja conta já foi apagada (id nulo).
create or replace function public.admin_list_users(p_search text default '')
returns table (
  id uuid, email text, display_name text, course text, role public.user_role,
  created_at timestamptz, last_sign_in_at timestamptz, banned_at timestamptz, ban_reason text,
  disposals bigint, season_points bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare
  q text := '%' || lower(coalesce(p_search, '')) || '%';
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  return query
  select u.id, u.email::text, p.display_name, p.course, p.role, u.created_at, u.last_sign_in_at,
         coalesce(p.banned_at, be.banned_at), coalesce(p.ban_reason, be.reason),
         (select count(*) from public.disposals d where d.user_id = u.id and d.status <> 'rejected'),
         (select coalesce(sum(d.points), 0)::bigint from public.disposals d
           where d.user_id = u.id and d.status = 'approved' and d.season_id = (public.current_season()).id)
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.banned_emails be on be.email = lower(u.email)
  where lower(u.email) like q or lower(p.display_name) like q
  union all
  select null::uuid, be.email, ''::text, ''::text, 'student'::public.user_role, be.banned_at, null::timestamptz,
         be.banned_at, be.reason, 0::bigint, 0::bigint
  from public.banned_emails be
  where not exists (select 1 from auth.users u where lower(u.email) = be.email) and be.email like q
  order by 2;
end;
$$;
revoke execute on function public.admin_list_users(text) from public, anon;
grant execute on function public.admin_list_users(text) to authenticated;

-- Derruba as sessões de alguém (usada pela Edge Function ao banir).
create or replace function public.admin_kill_sessions(p_user uuid)
returns void
language sql security definer set search_path = public, auth
as $$
  delete from auth.sessions where user_id = p_user;
$$;
revoke execute on function public.admin_kill_sessions(uuid) from public, anon, authenticated;
grant execute on function public.admin_kill_sessions(uuid) to service_role;
