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

### Frontend (PWA)

| Camada | Tecnologia |
|---|---|
| Framework | [React 19](https://react.dev) + [React Router 7](https://reactrouter.com) (SPA) |
| Linguagem | [TypeScript 6](https://www.typescriptlang.org) (`strict`), compartilhando as regras de negócio com o servidor |
| Build e dev server | [Vite 8](https://vite.dev) + `@vitejs/plugin-react`, com modos `demo` e real |
| PWA | [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app) (Workbox, service worker com atualização automática, manifest instalável) |
| Mapa | [Leaflet](https://leafletjs.com) + [React Leaflet](https://react-leaflet.js.org), renderizando vetores com [MapLibre GL](https://maplibre.org) via `@maplibre/maplibre-gl-leaflet`. Tiles do [OpenFreeMap](https://openfreemap.org) (sem chave) e estilo próprio em `src/lib/mapStyle.ts` |
| Câmera e foto | `getUserMedia` + Canvas (JPEG redimensionado) e hash perceptual (dHash) da foto calculado no cliente |
| Geolocalização | Geolocation API do navegador + cálculo de distância (Haversine) |
| Áudio | Web Audio API (efeitos 8-bit gerados em código, sem arquivos de áudio) |
| Visual | CSS próprio (`src/styles/theme.css`), tema pixel art, fontes [Press Start 2P](https://fontsource.org/fonts/press-start-2p) e [VT323](https://fontsource.org/fonts/vt323) via Fontsource, ícones e mascote em SVG/pixel |
| Cliente da API | [`@supabase/supabase-js`](https://github.com/supabase/supabase-js) (ou `mockApi` no modo demo) |

### Backend (Supabase)

| Camada | Tecnologia |
|---|---|
| Banco de dados | [PostgreSQL](https://www.postgresql.org) gerenciado pelo Supabase, com migrations SQL versionadas, funções PL/pgSQL (ranking, revisão, temporadas), triggers e a extensão `pgcrypto` |
| Segurança de dados | Row Level Security (RLS) em todas as tabelas e políticas no Storage |
| Autenticação | Supabase Auth + login com a conta Microsoft da faculdade (Microsoft Entra ID / OAuth 2.0), restrito aos domínios de `app_config.allowed_email_domains` |
| Storage | Supabase Storage (buckets de fotos de descarte e de lixeiras) |
| Serverless | Supabase Edge Functions em [Deno](https://deno.com) + TypeScript: `register-disposal` (valida e pontua), `ms-auth` (fluxo de login Microsoft) e `admin-users` (ações administrativas, com service role) |
| IA | [Google Gemini](https://ai.google.dev) via REST com saída JSON estruturada (`gemini-3.5-flash-lite` por padrão, `gemini-3.1-flash-lite` e `gemini-2.5-flash-lite` como reserva; configurável por `GEMINI_MODEL`) |
| Processamento de imagem | [`jpeg-js`](https://github.com/jpeg-js/jpeg-js) na Edge Function (decodifica o JPEG para o hash perceptual antifraude) |
| Regras de negócio | Módulos TypeScript puros em `supabase/functions/_shared` (pontuação, geofence, antifraude, materiais, parser do Gemini), reaproveitados no app, nos testes e no servidor |

### Infraestrutura, qualidade e ferramentas

| Parte | Tecnologia |
|---|---|
| Hospedagem do app | [Vercel](https://vercel.com) (site estático + rewrite de SPA em `vercel.json`) |
| Domínio e DNS | `ranktrash.eco.br` (registro.br) com DNS na [Cloudflare](https://www.cloudflare.com) |
| E-mail transacional | [Resend](https://resend.com) como SMTP do Supabase (reservado para avisos futuros) |
| Testes | [Vitest 5](https://vitest.dev) (pontuação, geofence, antifraude, nomes e parser do Gemini) |
| Lint e tipos | ESLint 10 (`typescript-eslint`, `eslint-plugin-react-hooks`) e `tsc --noEmit` |
| CLI | [Supabase CLI](https://supabase.com/docs/guides/cli) (migrations, secrets e deploy das funções) |
| Ícones do PWA | `scripts/gen-icons.mjs` (Playwright) gera os PNGs a partir do mascote |
| Runtime de desenvolvimento | Node.js + npm |

## Estrutura

```
src/
  components/   Layout (moldura "console"), CampusMap, Mascot, PixelArt (ícones pixel), InstallPrompt, PublicShell
  pages/        Login, ExternalLogin, Onboarding, MapPage, Register (câmera), Ranking, Profile, Admin, Rules, Legal, Suspended
  lib/          api (Supabase real ou mock), geolocalização, câmera/imagem, mapa, sons, PWA, sessão
supabase/
  migrations/   esquema, RLS, funções de ranking/revisão/temporada, buckets, login Microsoft
  functions/
    register-disposal/  Edge Function que valida e pontua um descarte
    ms-auth/            Edge Function do login com a conta Microsoft da faculdade
    admin-users/        Edge Function de ações do admin sobre usuários
    _shared/            regras puras (pontuação, geofence, antifraude, Gemini), usadas no app, nos testes e no servidor
  seed.sql      lixeiras de exemplo
tests/          testes (vitest) das regras
docs/           conceito do projeto e screenshots
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
3. **Login com a conta Microsoft da faculdade (Entra ID):**
   1. Em https://portal.azure.com → *Microsoft Entra ID* → *Registros de aplicativo* → **Novo registro**. Use o tipo *Contas em qualquer diretório organizacional (multilocatário)* e o URI de redirecionamento **Web** `https://SEU_REF.supabase.co/auth/v1/callback`.
   2. Em *Certificados e segredos*, crie um **segredo do cliente** e copie o *Valor*.
   3. Em *Configuração de token* → *Adicionar declaração opcional* → **ID**, marque `email` e `xms_edov`. Assim o e-mail chega verificado.
   4. No Supabase, em *Authentication → Sign In / Providers → Azure*, ative e cole o *ID do aplicativo (cliente)* e o segredo. Em *Azure Tenant URL*, use `https://login.microsoftonline.com/organizations`.

   Só entram e-mails dos domínios em `app_config.allowed_email_domains` (padrão `facens.br`). A regra fica no trigger `handle_new_user`, que também cria o perfil com o nome da conta (primeiro + último nome). Contas de outras instituições recebem o erro na volta ao app.
   Se a TI da instituição exigir aprovação de administrador para apps externos, peça o consentimento em `https://login.microsoftonline.com/organizations/adminconsent?client_id=ID_DO_APP`.
4. **Gemini:** gere uma chave em https://aistudio.google.com/apikey e configure a função:
   ```bash
   npx supabase secrets set GEMINI_API_KEY=sua-chave
   # opcional: npx supabase secrets set GEMINI_MODEL=gemini-3.5-flash-lite
   npx supabase functions deploy register-disposal
   ```
5. **App:** copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
6. **Admin:** e-mails em `app_config.admin_emails` viram admin no 1º login. Para promover alguém depois, rode no SQL Editor:
   ```sql
   update public.profiles set role = 'admin'
    where id = (select id from auth.users where email = 'seu.email@facens.br');
   ```
   Depois, cadastre as lixeiras reais pela aba **ADMIN**. O melhor jeito é ficar ao lado de cada lixeira e tocar em *USAR MINHA LOCALIZAÇÃO*.
7. **Deploy:** importe o repositório na Vercel (framework: Vite), configure as mesmas variáveis `VITE_*` e adicione um rewrite de SPA (o `vercel.json` já está no repo).

## Domínio (produção)

App: **https://ranktrash.eco.br** (Vercel). `www` redireciona para o domínio principal.

1. **DNS na Cloudflare:** o domínio foi registrado no registro.br. Na Cloudflare, adicione o site e troque os nameservers no registro.br pelos que a Cloudflare indicar.
2. **Registros da Vercel** (Cloudflare → DNS, proxy **desligado**/nuvem cinza):
   * `A` `@` → `76.76.21.21`
   * `CNAME` `www` → `cname.vercel-dns.com`
3. **Supabase → URL Configuration:** Site URL `https://ranktrash.eco.br`. Em Redirect URLs, deixe `https://ranktrash.eco.br/**` e `https://ranktrash.vercel.app/**`.
4. **E-mail (opcional):** o domínio também está verificado no Resend (SPF/DKIM na Cloudflare) e configurado como SMTP do Supabase. O login não usa e-mail, mas o SMTP fica pronto para avisos futuros.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `npm run dev:demo` | servidor de desenvolvimento (real / demo) |
| `npm run build` / `npm run build:demo` | build de produção com service worker |
| `npm test` | testes das regras (pontuação, geofence, antifraude, nomes, parser do Gemini) |
| `npm run lint` / `npm run typecheck` | qualidade de código |
| `node scripts/gen-icons.mjs` | regenera os ícones do PWA a partir do mascote (precisa do playwright) |

## Pendências conhecidas

* Job para apagar fotos com mais de 60 dias (prometido no termo de consentimento).
* O feed do letreiro é atualizado por polling (30 s), não em tempo real.
