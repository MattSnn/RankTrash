-- RankTrash: esquema inicial
-- Pontos são gravados apenas pela Edge Function (service role) ou por funções de admin.

create extension if not exists pgcrypto;

create type public.material as enum (
  'aluminio', 'plastico', 'vidro', 'papel', 'metal', 'organico', 'eletronico', 'nao_reciclavel'
);
create type public.disposal_status as enum ('approved', 'pending', 'rejected');
create type public.user_role as enum ('student', 'admin');

-- Configuração global (linha única)
create table public.app_config (
  id boolean primary key default true check (id),
  allowed_email_domains text[] not null default array['facens.br'],
  timezone text not null default 'America/Sao_Paulo'
);
insert into public.app_config default values;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  course text not null default '' check (char_length(course) <= 60),
  role public.user_role not null default 'student',
  xp integer not null default 0,
  streak integer not null default 0,
  last_disposal_date date,
  consent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bins (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '',
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  radius_m integer not null default 15 check (radius_m between 3 and 200),
  accepts public.material[] not null default enum_range(null::public.material),
  active boolean not null default true,
  qr_code text unique, -- reservado para validação por QR no futuro
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  prize text not null default '',
  closed boolean not null default false,
  check (ends_at > starts_at)
);
create unique index seasons_starts_at_key on public.seasons (starts_at);

create table public.disposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  bin_id uuid references public.bins (id) on delete set null,
  season_id uuid not null references public.seasons (id),
  image_path text,
  dhash text,
  signature text,
  ai jsonb not null default '{}'::jsonb,
  item_label text not null default '',
  material public.material,
  points integer not null default 0,
  breakdown jsonb not null default '[]'::jsonb,
  status public.disposal_status not null,
  reason text,
  lat double precision,
  lng double precision,
  accuracy double precision,
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz
);
create index disposals_user_created_idx on public.disposals (user_id, created_at desc);
create index disposals_season_status_idx on public.disposals (season_id, status);
create index disposals_created_idx on public.disposals (created_at desc);

create table public.season_winners (
  season_id uuid not null references public.seasons (id) on delete cascade,
  position integer not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points integer not null,
  primary key (season_id, position)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Temporada do mês atual (cria se não existir). Mês no fuso de São Paulo.
create or replace function public.current_season()
returns public.seasons
language plpgsql security definer set search_path = public
as $$
declare
  tz text := (select timezone from public.app_config);
  month_start timestamptz := (date_trunc('month', now() at time zone tz)) at time zone tz;
  s public.seasons;
begin
  select * into s from public.seasons where starts_at = month_start;
  if not found then
    insert into public.seasons (name, starts_at, ends_at)
    values (
      'Temporada ' || to_char(now() at time zone tz, 'MM/YYYY'),
      month_start,
      (date_trunc('month', now() at time zone tz) + interval '1 month') at time zone tz
    )
    on conflict (starts_at) do nothing;
    select * into s from public.seasons where starts_at = month_start;
  end if;
  return s;
end;
$$;

-- Cria o perfil no cadastro e bloqueia e-mails fora do domínio permitido.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  domains text[] := (select allowed_email_domains from public.app_config);
begin
  if domains is not null and array_length(domains, 1) > 0
     and not (lower(split_part(new.email, '@', 2)) = any (domains)) then
    raise exception 'E-mail fora do domínio permitido (%).', array_to_string(domains, ', ');
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, left(split_part(new.email, '@', 1), 40));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.bins enable row level security;
alter table public.seasons enable row level security;
alter table public.disposals enable row level security;
alter table public.season_winners enable row level security;

create policy "admin lê config" on public.app_config for select to authenticated using (public.is_admin());
create policy "admin altera config" on public.app_config for update to authenticated using (public.is_admin());

create policy "ver o próprio perfil" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "editar o próprio perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Só estas colunas podem ser alteradas pelo cliente (xp/role/streak ficam protegidos).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, course, consent_at) on public.profiles to authenticated;

create policy "ver lixeiras" on public.bins for select to authenticated using (active or public.is_admin());
create policy "admin cria lixeira" on public.bins for insert to authenticated with check (public.is_admin());
create policy "admin edita lixeira" on public.bins for update to authenticated using (public.is_admin());
create policy "admin apaga lixeira" on public.bins for delete to authenticated using (public.is_admin());

create policy "ver temporadas" on public.seasons for select to authenticated using (true);
create policy "admin edita temporada" on public.seasons for update to authenticated using (public.is_admin());

create policy "ver os próprios descartes" on public.disposals for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
-- Sem policy de insert/update: só a Edge Function (service role) grava descartes.

create policy "ver vencedores" on public.season_winners for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Ranking, feed e estatísticas (dados públicos mínimos via security definer)
-- ---------------------------------------------------------------------------

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
    where d.season_id = s.id and d.status = 'approved' and p.course <> ''
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
  where d.status = 'approved'
  order by d.created_at desc
  limit least(p_limit, 50);
$$;

-- Aprovar/rejeitar um descarte pendente (admin). Aprovar soma XP.
create or replace function public.review_disposal(p_id uuid, p_approve boolean)
returns public.disposals
language plpgsql security definer set search_path = public
as $$
declare
  d public.disposals;
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  update public.disposals
     set status = case when p_approve then 'approved'::public.disposal_status else 'rejected' end,
         points = case when p_approve then points else 0 end,
         reason = case when p_approve then reason else coalesce(reason, 'Rejeitado na revisão') end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id and status = 'pending'
  returning * into d;
  if not found then raise exception 'Descarte não encontrado ou já revisado'; end if;
  if p_approve then
    update public.profiles set xp = xp + d.points where id = d.user_id;
  end if;
  return d;
end;
$$;

-- Anula um descarte já aprovado (auditoria do top 10).
create or replace function public.revoke_disposal(p_id uuid, p_reason text default 'Anulado na auditoria')
returns public.disposals
language plpgsql security definer set search_path = public
as $$
declare
  d public.disposals;
  old_points integer;
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  select points into old_points from public.disposals where id = p_id and status = 'approved';
  if not found then raise exception 'Descarte não encontrado ou não aprovado'; end if;
  update public.disposals
     set status = 'rejected', points = 0, reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id
  returning * into d;
  update public.profiles set xp = greatest(xp - old_points, 0) where id = d.user_id;
  return d;
end;
$$;

-- Fecha a temporada gravando o top N como vencedores.
create or replace function public.close_season(p_season uuid, p_winners integer default 3)
returns setof public.season_winners
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Apenas admin'; end if;
  if exists (select 1 from public.disposals where season_id = p_season and status = 'pending') then
    raise exception 'Ainda há descartes pendentes de revisão nesta temporada';
  end if;
  delete from public.season_winners where season_id = p_season;
  insert into public.season_winners (season_id, position, user_id, points)
  select p_season, l.ord::integer, l.user_id, l.points
  from public.leaderboard(p_season, p_winners) with ordinality as l(pos, user_id, display_name, course, points, disposals, ord);
  update public.seasons set closed = true where id = p_season;
  return query select * from public.season_winners where season_id = p_season order by position;
end;
$$;

revoke execute on function public.review_disposal(uuid, boolean) from anon, public;
revoke execute on function public.revoke_disposal(uuid, text) from anon, public;
revoke execute on function public.close_season(uuid, integer) from anon, public;
grant execute on function public.review_disposal(uuid, boolean) to authenticated;
grant execute on function public.revoke_disposal(uuid, text) to authenticated;
grant execute on function public.close_season(uuid, integer) to authenticated;
revoke execute on function public.leaderboard(uuid, integer) from anon, public;
revoke execute on function public.weekly_leaderboard(integer) from anon, public;
revoke execute on function public.course_leaderboard(uuid) from anon, public;
revoke execute on function public.public_feed(integer) from anon, public;
revoke execute on function public.current_season() from anon, public;
grant execute on function public.leaderboard(uuid, integer) to authenticated;
grant execute on function public.weekly_leaderboard(integer) to authenticated;
grant execute on function public.course_leaderboard(uuid) to authenticated;
grant execute on function public.public_feed(integer) to authenticated;
grant execute on function public.current_season() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos em bucket privado, pasta = id do usuário
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('disposals', 'disposals', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "ver as próprias fotos" on storage.objects for select to authenticated
  using (bucket_id = 'disposals' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
