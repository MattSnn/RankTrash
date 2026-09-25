-- Origem da foto: câmera ao vivo ou galeria (galeria só liberada em modo teste).
alter table public.disposals
  add column if not exists source text not null default 'camera' check (source in ('camera', 'gallery'));
