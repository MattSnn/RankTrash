-- Lixeiras de exemplo perto do centro do campus Facens (Sorocaba).
-- As coordenadas são APROXIMADAS: o ideal é o admin cadastrar cada lixeira
-- pelo app, em pé ao lado dela, com "USAR MINHA LOCALIZAÇÃO".
insert into public.bins (name, description, lat, lng, radius_m) values
  ('Bloco A · Entrada', 'Coletores coloridos na entrada', -23.4693, -47.4303, 15),
  ('Bloco B · Corredor', '', -23.4688, -47.4295, 15),
  ('Praça de Alimentação', 'Perto das mesas', -23.4700, -47.4290, 20),
  ('Biblioteca', '', -23.4705, -47.4299, 15);

-- Para tornar alguém admin (depois que a pessoa fizer o 1º login):
-- update public.profiles set role = 'admin'
--  where id = (select id from auth.users where email = 'seu.email@facens.br');
