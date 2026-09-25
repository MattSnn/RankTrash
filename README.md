# RankTrash ♻️🕹️

PWA gamificado para a campanha **Lixo Zero da Facens**. O aluno fotografa o resíduo na lixeira, a IA (Google Gemini) identifica o item e o material, o GPS confirma a lixeira e o aluno ganha pontos para subir no ranking mensal.

* 📄 Conceito completo, regras e material para o relatório da UPX: [`docs/CONCEITO.md`](docs/CONCEITO.md)
* 🖼️ Screenshots (modo demo): [`docs/screenshots/`](docs/screenshots)

## Rodar agora (modo demo, sem backend)

```bash
npm install
npm run dev:demo
```

Abra http://localhost:5173. No modo demo tudo é simulado: dados, IA (sorteia um item) e GPS (se você estiver longe do campus). Mesmo assim, as regras reais de pontuação e antifraude são aplicadas. Tente enviar a mesma foto duas vezes, por exemplo.

> Para testar a câmera no celular, o navegador exige HTTPS. Use `npm run dev:demo -- --host` com um túnel (ex.: `npx localtunnel --port 5173`) ou faça o deploy na Vercel.

## Stack

| Parte | Tecnologia |
|---|---|
| App | React 19 + Vite + TypeScript + `vite-plugin-pwa` |
| Mapa | Leaflet + tiles escuros do CARTO |
| Backend | Supabase (Auth por código de e-mail, Postgres com RLS, Storage, Edge Functions) |
| IA | Google Gemini (`gemini-2.5-flash` por padrão, configurável) |
| Deploy | Vercel (site estático) |

## Estrutura

```
src/
  components/   Layout (moldura "console"), CampusMap, Mascot, PixelArt (ícones pixel)
  pages/        Login, Onboarding, MapPage, Register (câmera), Ranking, Profile, Admin, Rules
  lib/          api (Supabase real ou mock), geolocalização, câmera, sons, sessão
supabase/
  migrations/   esquema, RLS, funções de ranking/revisão/temporada, bucket
  functions/
    register-disposal/  Edge Function que valida e pontua um descarte
    _shared/            regras puras (pontuação, geofence, antifraude, Gemini), usadas no app, nos testes e no servidor
  seed.sql      lixeiras de exemplo
tests/          testes (vitest) das regras
```

## Configurar o backend de verdade

1. **Supabase:** crie um projeto em https://supabase.com (grátis).
2. **Banco:** com a [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   npx supabase init          # se perguntar, não sobrescreva a pasta supabase/
   npx supabase link --project-ref SEU_REF
   npx supabase db push       # aplica supabase/migrations
   ```
   Opcional: rode `supabase/seed.sql` no SQL Editor para criar lixeiras de exemplo.
3. **Login por código:** em *Authentication → Email Templates*, nos modelos **Magic Link** e **Confirm signup**:
   * **Assunto:** `Seu código RankTrash: {{ .Token }}`
   * **Corpo:** cole o HTML de [`supabase/templates/login-code.html`](supabase/templates/login-code.html) (só o código, sem link: o link abriria no navegador, fora do app instalado).

   Se o e-mail dos alunos não for `@facens.br`, ajuste `app_config.allowed_email_domains` no banco **e** `VITE_ALLOWED_EMAIL_DOMAINS`.
   O remetente, o limite de envios e o envio para qualquer e-mail dependem de um **SMTP próprio** (*Authentication → Emails → SMTP Settings*; Resend e Brevo têm plano grátis).
4. **Gemini:** gere uma chave em https://aistudio.google.com/apikey e configure a função:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=sua-chave
   # opcional: npx supabase secrets set GEMINI_MODEL=gemini-2.5-flash
   npx supabase functions deploy register-disposal
   ```
5. **App:** copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
6. **Admin:** depois do 1º login, rode no SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
    where id = (select id from auth.users where email = 'seu.email@facens.br');
   ```
   Depois, cadastre as lixeiras reais pela aba **ADMIN**. O melhor jeito é ficar ao lado de cada lixeira e tocar em *USAR MINHA LOCALIZAÇÃO*.
7. **Deploy:** importe o repositório na Vercel (framework: Vite), configure as mesmas variáveis `VITE_*` e adicione um rewrite de SPA (o `vercel.json` já está no repo).

## Domínio e e-mail (produção)

App: **https://ranktrash.eco.br** (Vercel). `www` redireciona para o domínio principal.

1. **DNS na Cloudflare:** o domínio foi registrado no registro.br. Na Cloudflare, adicione o site e troque os nameservers no registro.br pelos que a Cloudflare indicar.
2. **Registros da Vercel** (Cloudflare → DNS, proxy **desligado**/nuvem cinza):
   * `A` `@` → `76.76.21.21`
   * `CNAME` `www` → `cname.vercel-dns.com`
3. **Resend:** adicione o domínio `ranktrash.eco.br`, crie na Cloudflare os registros que ele pedir (SPF/DKIM, nuvem cinza), espere ficar *Verified* e gere uma API key.
4. **Supabase → Authentication → Emails → SMTP:** host `smtp.resend.com`, porta `465`, usuário `resend`, senha = API key do Resend, remetente `login@ranktrash.eco.br` (nome `RankTrash`). Em *Rate Limits*, suba o limite de e-mails por hora.
5. **Modelos Magic Link e Confirm signup:** assunto `Seu código RankTrash: {{ .Token }}`, corpo = [`supabase/templates/login-code.html`](supabase/templates/login-code.html).
6. **URL Configuration:** Site URL `https://ranktrash.eco.br`. Em Redirect URLs, deixe `https://ranktrash.eco.br/**` e `https://ranktrash.vercel.app/**`.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `npm run dev:demo` | servidor de desenvolvimento (real / demo) |
| `npm run build` / `npm run build:demo` | build de produção com service worker |
| `npm test` | testes das regras (pontuação, geofence, antifraude, parser do Gemini) |
| `npm run lint` / `npm run typecheck` | qualidade de código |
| `node scripts/gen-icons.mjs` | regenera os ícones do PWA a partir do mascote (precisa do playwright) |

## Pendências conhecidas

* Job para apagar fotos com mais de 60 dias (prometido no termo de consentimento).
* O feed do letreiro é atualizado por polling (30 s), não em tempo real.
* Os e-mails de login dependem do SMTP do Supabase, que no plano grátis tem limite baixo por hora. Para o piloto, configure um SMTP próprio.
