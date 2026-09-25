-- Login pelo Safari: o retorno da Microsoft às vezes chega duas vezes. Se a mesma pessoa completar
-- o mesmo pedido de novo, atualiza a sessão e devolve o MESMO código (em vez de "pedido expirado").
alter table public.login_handoffs add column if not exists user_id uuid;

create or replace function public.handoff_complete(p_id uuid, p_refresh_token text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  h public.login_handoffs;
  new_code text := lpad(floor(random() * 10000)::int::text, 4, '0');
begin
  if auth.uid() is null then
    raise exception 'não autenticado';
  end if;
  select * into h from public.login_handoffs
   where id = p_id and created_at > now() - interval '10 minutes'
   for update;
  if not found then
    return null;
  end if;
  if h.refresh_token is null then
    update public.login_handoffs set refresh_token = p_refresh_token, code = new_code, user_id = auth.uid() where id = p_id;
    return new_code;
  end if;
  if h.user_id = auth.uid() then
    update public.login_handoffs set refresh_token = p_refresh_token where id = p_id;
    return h.code;
  end if;
  return null; -- outra pessoa tentando completar o pedido de alguém
end;
$$;
