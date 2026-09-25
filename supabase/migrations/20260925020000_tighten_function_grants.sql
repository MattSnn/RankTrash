-- handle_new_user só roda pelo trigger; is_admin é usado nas policies (precisa de authenticated).
revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;
