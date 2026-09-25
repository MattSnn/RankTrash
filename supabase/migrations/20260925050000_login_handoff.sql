-- Login pelo Safari "de fora" (iPhone): o app instalado e o Safari não compartilham sessão.
-- 1) o app cria um pedido com um segredo (só o hash fica no banco) e abre o Safari em /entrar?h=<id>;
-- 2) no Safari, o aluno entra com a Microsoft e a página entrega o refresh token ao pedido;
-- 3) o app, com o segredo, resgata o token (uma vez só) e abre a própria sessão.
-- Pedidos valem 10 minutos.

create table public.login_handoffs (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  refresh_token text,
  created_at timestamptz not null default now()
);
alter table public.login_handoffs enable row level security;
-- sem policies: acesso só pelas funções abaixo
revoke all on public.login_handoffs from anon, authenticated;

create or replace function public.handoff_create(p_secret_hash text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
begin
  if p_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash inválido';
  end if;
  delete from public.login_handoffs where created_at < now() - interval '10 minutes';
  insert into public.login_handoffs (secret_hash) values (p_secret_hash) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.handoff_complete(p_id uuid, p_refresh_token text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  update public.login_handoffs
     set refresh_token = p_refresh_token
   where id = p_id
     and refresh_token is null
     and created_at > now() - interval '10 minutes';
  return found;
end;
$$;

create or replace function public.handoff_claim(p_id uuid, p_secret text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  token text;
begin
  delete from public.login_handoffs
   where id = p_id
     and refresh_token is not null
     and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
     and created_at > now() - interval '10 minutes'
  returning refresh_token into token;
  return token;
end;
$$;

revoke execute on function public.handoff_create(text) from public;
revoke execute on function public.handoff_complete(uuid, text) from public;
revoke execute on function public.handoff_claim(uuid, text) from public;
grant execute on function public.handoff_create(text) to anon, authenticated;
grant execute on function public.handoff_complete(uuid, text) to authenticated;
grant execute on function public.handoff_claim(uuid, text) to anon, authenticated;
