// Edge Function: login com a conta Microsoft da Facens, feito por nós (e não pelo provedor Azure do Supabase).
// Motivo: o provedor do Supabase exige a declaração "email" no token, que falta em muitas contas de aluno
// (atributo "mail" vazio no diretório). Aqui usamos email || preferred_username || upn (= RA@facens.br).
//
//   GET /ms-auth/start?return=<url do app>  → Microsoft (só o diretório da Facens)
//   GET /ms-auth/callback?code&state         → cria/acha a conta e volta ao app com #ms_token=<token de uso único>
//
// Secrets: AZURE_CLIENT_SECRET (obrigatório). Sem ele, volta ao app com ?ms_unavailable=1 (o app usa o login antigo).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { decodeBase64Url, encodeBase64Url } from 'jsr:@std/encoding@1/base64url'

const CLIENT_ID = 'e14965b3-2453-49a8-8573-a9a62bba2232' // público (ID do aplicativo no Azure)
const FACENS_TENANT = '59d4f249-0520-46cf-b6b2-873d5da543fe'
const STATE_TTL_S = 600
const COOKIE = 'rt_ms_nonce'

const ALLOWED_RETURN = [
  /^https:\/\/(www\.)?ranktrash\.eco\.br(\/|$)/,
  /^https:\/\/ranktrash[a-z0-9-]*\.vercel\.app(\/|$)/,
  /^http:\/\/localhost(:\d+)?(\/|$)/,
]

const enc = new TextEncoder()

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data))))
}

function redirect(url: string, headers: Record<string, string> = {}) {
  return new Response(null, { status: 302, headers: { location: url, 'cache-control': 'no-store', ...headers } })
}

/** Volta ao app acrescentando parâmetros na query (mantém ?h= da página /entrar). */
function back(returnTo: string, params: Record<string, string>, hash = '') {
  const u = new URL(returnTo)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return redirect(u.toString() + hash)
}

function readCookie(req: Request, name: string): string | null {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return m ? m[1] : null
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const secret = Deno.env.get('AZURE_CLIENT_SECRET')
  const self = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ms-auth`
  const redirectUri = `${self}/callback`

  // ---------- início ----------
  if (url.pathname.endsWith('/start')) {
    const returnTo = url.searchParams.get('return') ?? ''
    if (!ALLOWED_RETURN.some((re) => re.test(returnTo))) return new Response('return inválido', { status: 400 })
    if (!secret) return back(returnTo, { ms_unavailable: '1' })

    const nonce = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)))
    const payload = encodeBase64Url(enc.encode(JSON.stringify({ n: nonce, r: returnTo, e: Math.floor(Date.now() / 1000) + STATE_TTL_S })))
    const state = `${payload}.${await hmac(secret, payload)}`
    const auth = new URL(`https://login.microsoftonline.com/${FACENS_TENANT}/oauth2/v2.0/authorize`)
    auth.search = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: redirectUri,
      scope: 'openid profile email',
      state,
      prompt: 'select_account',
      domain_hint: 'facens.br',
    }).toString()
    return redirect(auth.toString(), {
      'set-cookie': `${COOKIE}=${nonce}; Max-Age=${STATE_TTL_S}; Path=/functions/v1/ms-auth; HttpOnly; Secure; SameSite=Lax`,
    })
  }

  // ---------- volta da Microsoft ----------
  if (url.pathname.endsWith('/callback')) {
    if (!secret) return new Response('login indisponível', { status: 503 })
    const [payload, sig] = (url.searchParams.get('state') ?? '').split('.')
    if (!payload || !sig || sig !== (await hmac(secret, payload))) return new Response('state inválido', { status: 400 })
    const st = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { n: string; r: string; e: number }
    const returnTo = st.r
    if (!ALLOWED_RETURN.some((re) => re.test(returnTo))) return new Response('return inválido', { status: 400 })
    if (st.e < Date.now() / 1000) return back(returnTo, { error_description: 'O login demorou demais. Tente de novo.' })
    // cookie ausente é tolerado (alguns navegadores bloqueiam); se existir, tem de bater
    const cookieNonce = readCookie(req, COOKIE)
    if (cookieNonce && cookieNonce !== st.n) return back(returnTo, { error_description: 'Login iniciado em outro navegador. Tente de novo.' })

    const msError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
    if (msError) return back(returnTo, { error_description: msError.slice(0, 300) })
    const code = url.searchParams.get('code')
    if (!code) return back(returnTo, { error_description: 'Resposta da Microsoft sem código.' })

    try {
      const tokenRes = await fetch(`https://login.microsoftonline.com/${FACENS_TENANT}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: secret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          scope: 'openid profile email',
        }),
      })
      const tokens = await tokenRes.json()
      if (!tokenRes.ok || !tokens.id_token) {
        console.error('ms token', tokenRes.status, tokens.error, tokens.error_codes)
        return back(returnTo, { error_description: tokens.error_description?.slice(0, 200) ?? 'Falha ao falar com a Microsoft.' })
      }
      // id_token recebido direto da Microsoft (TLS + client_secret): basta ler e conferir destino e diretório
      const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(tokens.id_token.split('.')[1])))
      if (claims.aud !== CLIENT_ID || claims.tid !== FACENS_TENANT) {
        return back(returnTo, { error_description: 'Use sua conta da Facens.' })
      }
      const email = String(claims.email || claims.preferred_username || claims.upn || '').trim().toLowerCase()
      const name = String(claims.name ?? '').trim()

      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data: cfg } = await db.from('app_config').select('allowed_email_domains, allowed_emails').limit(1).single()
      const domains: string[] = cfg?.allowed_email_domains ?? ['facens.br']
      if (!email.includes('@') || (domains.length && !domains.includes(email.split('@')[1]) && !(cfg?.allowed_emails ?? []).includes(email))) {
        return back(returnTo, { error_description: `E-mail fora do domínio permitido (${domains.join(', ')}).` })
      }
      const { data: banned } = await db.from('banned_emails').select('email').eq('email', email).maybeSingle()
      if (banned) return back(returnTo, { error_description: 'Conta banida do RankTrash.' })

      const { data: existingId } = await db.rpc('auth_user_id_by_email', { p_email: email })
      if (existingId) {
        const { data: u } = await db.auth.admin.getUserById(existingId as string)
        if (name && u.user) {
          await db.auth.admin.updateUserById(u.user.id, { user_metadata: { ...u.user.user_metadata, full_name: name, name } })
        }
      } else {
        const { error } = await db.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: name, name } })
        if (error) {
          console.error('createUser', error.message)
          return back(returnTo, { error_description: 'Não foi possível criar sua conta agora.' })
        }
      }

      const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: 'magiclink', email })
      if (linkError || !link.properties?.hashed_token) {
        console.error('generateLink', linkError?.message)
        return back(returnTo, { error_description: 'Não foi possível entrar agora.' })
      }
      console.log('ms-auth ok', existingId ? 'existente' : 'nova conta')
      return back(returnTo, {}, `#ms_token=${encodeURIComponent(link.properties.hashed_token)}`)
    } catch (e) {
      console.error('ms-auth', (e as Error).message)
      return back(returnTo, { error_description: 'Falha no login. Tente de novo.' })
    }
  }

  return new Response('not found', { status: 404 })
})
