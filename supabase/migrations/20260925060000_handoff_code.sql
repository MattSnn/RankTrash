-- Login pelo Safari: depois de entrar, o Safari mostra um código de 4 dígitos que o aluno digita no app.
-- Sem o código, um link /entrar repassado a outra pessoa não loga ninguém no celular de quem mandou.

alter table public.login_handoffs
  add column if not exists code text,
  add column if not exists attempts int not null default 0;

drop function if exists public.handoff_complete(uuid, text);
drop function if exists public.handoff_claim(uuid, text);

-- devolve o código a mostrar no Safari (null se o pedido não existe/expirou)
create function public.handoff_complete(p_id uuid, p_refresh_token text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  new_code text := lpad(floor(random() * 10000)::int::text, 4, '0');
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  update public.login_handoffs
     set refresh_token = p_refresh_token, code = new_code
   where id = p_id
     and refresh_token is null
     and created_at > now() - interval '10 minutes';
  return case when found then new_code end;
end;
$$;

-- status: ok (com token) | wrong (código errado) | pending (ainda não entrou no Safari) | expired
create function public.handoff_claim(p_id uuid, p_secret text, p_code text)
returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  h public.login_handoffs;
begin
  select * into h from public.login_handoffs
   where id = p_id
     and secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex')
     and created_at > now() - interval '10 minutes'
   for update;
  if not found then
    return jsonb_build_object('status', 'expired');
  end if;
  if h.refresh_token is null then
    return jsonb_build_object('status', 'pending');
  end if;
  if h.code is distinct from p_code then
    if h.attempts + 1 >= 5 then
      delete from public.login_handoffs where id = p_id;
      return jsonb_build_object('status', 'expired');
    end if;
    update public.login_handoffs set attempts = attempts + 1 where id = p_id;
    return jsonb_build_object('status', 'wrong');
  end if;
  delete from public.login_handoffs where id = p_id;
  return jsonb_build_object('status', 'ok', 'token', h.refresh_token);
end;
$$;

revoke execute on function public.handoff_complete(uuid, text) from public;
revoke execute on function public.handoff_claim(uuid, text, text) from public;
grant execute on function public.handoff_complete(uuid, text) to authenticated;
grant execute on function public.handoff_claim(uuid, text, text) to anon, authenticated;
