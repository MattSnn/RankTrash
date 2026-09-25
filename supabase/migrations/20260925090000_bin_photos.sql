-- Foto da lixeira (enviada pelo admin), mostrada no popup do mapa para o aluno achar o lugar.
alter table public.bins add column if not exists photo_url text check (photo_url is null or char_length(photo_url) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bin-photos', 'bin-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- leitura é pública (bucket público); só admin envia, troca ou apaga
create policy "admin envia foto de lixeira" on storage.objects for insert to authenticated
  with check (bucket_id = 'bin-photos' and public.is_admin());
create policy "admin troca foto de lixeira" on storage.objects for update to authenticated
  using (bucket_id = 'bin-photos' and public.is_admin());
create policy "admin apaga foto de lixeira" on storage.objects for delete to authenticated
  using (bucket_id = 'bin-photos' and public.is_admin());
