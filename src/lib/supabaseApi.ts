import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { fileToJpeg } from './image'
import { formatPersonName, looksLikeEmailName } from './names'
import {
  AccountGoneError,
  type AdminUser,
  type Api,
  type Bin,
  type ClaimResult,
  type Disposal,
  type LeaderRow,
  type Profile,
  type RegisterResult,
} from './types'

const DISPOSAL_FIELDS =
  'id, user_id, bin_id, item_label, material, points, status, reason, created_at, ai, breakdown, image_path, source'

type DisposalRow = Disposal & { image_path: string | null }

const HANDOFF_KEY = 'ranktrash:handoff'
const HANDOFF_PATH = '/entrar'
const MICROSOFT_LOGIN = {
  scopes: 'openid email profile',
  queryParams: { prompt: 'select_account', domain_hint: 'facens.br' },
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    // PKCE: a Microsoft devolve ?code= para o app, que troca pela sessão sozinho (detectSessionInUrl).
    // Em /entrar quem troca o código é o cliente da ponte (abaixo), não este.
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: (u) => u.pathname !== HANDOFF_PATH,
      flowType: 'pkce',
    },
  })

  const MS_START = `${url}/functions/v1/ms-auth/start`
  const msStart = (returnTo: string) => `${MS_START}?return=${encodeURIComponent(returnTo)}`

  /** Login antigo pelo provedor Azure do Supabase (usado se a função ms-auth ainda não estiver configurada). */
  async function nativeMicrosoftLogin(client: SupabaseClient, redirectTo: string) {
    const { error } = await client.auth.signInWithOAuth({ provider: 'azure', options: { ...MICROSOFT_LOGIN, redirectTo } })
    if (error) throw new Error(error.message)
  }

  /** Lê e limpa da URL o token da ms-auth (#ms_token=...) ou o aviso de que ela não está configurada. */
  function takeMsReturn(): { token: string | null; unavailable: boolean } {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)
    const token = hash.get('ms_token')
    const unavailable = query.get('ms_unavailable') === '1'
    if (token || unavailable) {
      query.delete('ms_unavailable')
      const qs = query.toString()
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
    return { token, unavailable }
  }

  // Volta do login (fora da página /entrar, que tem cliente próprio): troca o token pela sessão antes de tudo.
  const msReturn: Promise<void> =
    window.location.pathname === HANDOFF_PATH
      ? Promise.resolve()
      : (async () => {
          const { token, unavailable } = takeMsReturn()
          if (token) {
            const { error } = await sb.auth.verifyOtp({ token_hash: token, type: 'magiclink' })
            if (error) console.error('login', error.message)
          } else if (unavailable) {
            await nativeMicrosoftLogin(sb, window.location.origin)
          }
        })()

  /** Cliente da página /entrar: sessão só na aba (sessionStorage) e sem renovar, porque ela é entregue ao app. */
  function bridgeClient(): SupabaseClient {
    return createClient(url, anonKey, {
      auth: {
        storage: window.sessionStorage,
        storageKey: 'ranktrash-bridge',
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  }

  async function uid(): Promise<string> {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('Sessão expirada')
    return id
  }

  function check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message)
    return res.data
  }

  async function withImages(rows: DisposalRow[]): Promise<Disposal[]> {
    const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p)
    if (paths.length === 0) return rows
    const { data } = await sb.storage.from('disposals').createSignedUrls(paths, 3600)
    const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]))
    return rows.map((r) => ({ ...r, image_url: r.image_path ? urls.get(r.image_path) ?? undefined : undefined }))
  }

  const api: Api = {
    demo: false,

    async getSessionEmail() {
      await msReturn
      const { data } = await sb.auth.getSession()
      return data.session?.user.email ?? null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.email ?? null))
      return () => data.subscription.unsubscribe()
    },
    async signInWithMicrosoft() {
      // login próprio (Edge Function ms-auth): funciona também para contas sem a declaração "email"
      window.location.href = msStart(`${window.location.origin}/`)
    },
    async startExternalLogin() {
      const secret = randomSecret()
      const id = check(await sb.rpc('handoff_create', { p_secret_hash: await sha256Hex(secret) })) as string
      localStorage.setItem(HANDOFF_KEY, JSON.stringify({ id, secret }))
      return `${window.location.origin}${HANDOFF_PATH}?h=${id}`
    },
    async claimExternalLogin(code) {
      const raw = localStorage.getItem(HANDOFF_KEY)
      if (!raw) return 'expired'
      const { id, secret } = JSON.parse(raw) as { id: string; secret: string }
      const res = check(await sb.rpc('handoff_claim', { p_id: id, p_secret: secret, p_code: code })) as {
        status: ClaimResult
        token?: string
      }
      if (res.status === 'expired') localStorage.removeItem(HANDOFF_KEY)
      if (res.status !== 'ok' || !res.token) return res.status
      localStorage.removeItem(HANDOFF_KEY)
      const { error } = await sb.auth.refreshSession({ refresh_token: res.token })
      if (error) throw new Error(error.message)
      return 'ok'
    },
    hasPendingExternalLogin() {
      return localStorage.getItem(HANDOFF_KEY) != null
    },
    cancelExternalLogin() {
      localStorage.removeItem(HANDOFF_KEY)
    },
    async completeExternalLogin(handoffId) {
      const bridge = bridgeClient()
      const here = `${window.location.origin}${HANDOFF_PATH}?h=${handoffId}`
      const { token, unavailable } = takeMsReturn()
      const code = new URLSearchParams(window.location.search).get('code') // volta do login antigo
      let session: Session | null
      if (token) {
        const { data, error } = await bridge.auth.verifyOtp({ token_hash: token, type: 'magiclink' })
        if (error) throw new Error(error.message)
        session = data.session
      } else if (code) {
        const { data, error } = await bridge.auth.exchangeCodeForSession(code)
        if (error) throw new Error(error.message)
        session = data.session
      } else if (unavailable) {
        await nativeMicrosoftLogin(bridge, here)
        return { kind: 'redirecting' }
      } else {
        window.location.href = msStart(here)
        return { kind: 'redirecting' }
      }
      if (!session) throw new Error('Não foi possível entrar.')
      const { data: shownCode, error } = await bridge.rpc('handoff_complete', {
        p_id: handoffId,
        p_refresh_token: session.refresh_token,
      })
      // a sessão pertence ao app: some daqui sem revogar (signOut revogaria o token entregue)
      window.sessionStorage.removeItem('ranktrash-bridge')
      window.history.replaceState(null, '', HANDOFF_PATH)
      if (error || !shownCode) throw new Error('O pedido de login expirou. Volte ao app e toque em entrar de novo.')
      return { kind: 'done', code: shownCode as string }
    },
    async signOut() {
      // local: funciona mesmo se a conta já foi apagada (o logout no servidor falharia)
      await sb.auth.signOut({ scope: 'local' })
    },

    async getProfile() {
      const { data: session } = await sb.auth.getSession()
      const id = await uid()
      const { data: found, error: profileError } = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
      if (profileError) throw new Error(profileError.message)
      if (!found) {
        // perfil sumiu: confere no Auth se a conta ainda existe
        const { error: userError } = await sb.auth.getUser()
        if (!userError || [401, 403, 404].includes(userError.status ?? 0)) throw new AccountGoneError()
        throw new Error(userError.message)
      }
      const row = found as Profile
      const user = session.session?.user
      const email = user?.email ?? ''
      // perfis antigos ficaram com o RA/parte do e-mail como nome: usa o nome da conta Microsoft
      const realName = formatPersonName(user?.user_metadata?.full_name ?? user?.user_metadata?.name)
      if (realName && looksLikeEmailName(row.display_name, email)) {
        const { error } = await sb.from('profiles').update({ display_name: realName }).eq('id', id)
        if (!error) row.display_name = realName
      }
      return { ...row, email, full_name: user?.user_metadata?.full_name ?? user?.user_metadata?.name }
    },
    async updateProfile(patch) {
      const id = await uid()
      check(await sb.from('profiles').update(patch).eq('id', id))
      return api.getProfile()
    },
    async currentSeason() {
      return check(await sb.rpc('current_season'))
    },
    async listBins() {
      return check(await sb.from('bins').select('*').eq('active', true).order('name')) as Bin[]
    },
    async myDisposals(limit = 100) {
      const id = await uid()
      const rows = check(
        await sb.from('disposals').select(DISPOSAL_FIELDS).eq('user_id', id).order('created_at', { ascending: false }).limit(limit),
      ) as DisposalRow[]
      return rows
    },
    async registerDisposal(input) {
      const form = new FormData()
      form.append('image', input.image, 'foto.jpg')
      form.append('lat', String(input.lat))
      form.append('lng', String(input.lng))
      form.append('accuracy', String(input.accuracy))
      if (input.binId) form.append('bin_id', input.binId)
      form.append('source', input.source ?? 'camera')
      // limite no app: nunca fica "analisando" para sempre
      const TIMEOUT_MS = 75_000
      const timeout = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), TIMEOUT_MS))
      const call = sb.functions.invoke('register-disposal', { body: form })
      const raced = await Promise.race([call, timeout])
      if (raced === 'timeout') {
        return { status: 'error', code: 'timeout', message: 'A análise demorou demais. Verifique a internet e tente de novo.' }
      }
      const { data, error } = raced
      if (error) {
        // Erros 4xx da função trazem o JSON com a mensagem amigável
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          try {
            return (await ctx.json()) as RegisterResult
          } catch {
            /* cai no erro genérico */
          }
        }
        return { status: 'error', code: 'network', message: 'Falha de conexão. Tente de novo.' }
      }
      return data as RegisterResult
    },
    async leaderboard(scope) {
      const res = scope === 'week' ? await sb.rpc('weekly_leaderboard') : await sb.rpc('leaderboard')
      return check(res) as LeaderRow[]
    },
    async courseLeaderboard() {
      return check(await sb.rpc('course_leaderboard'))
    },
    async feed() {
      return check(await sb.rpc('public_feed', { p_limit: 15 }))
    },

    async saveBin(bin) {
      if (bin.id) {
        const { id, ...rest } = bin
        return check(await sb.from('bins').update(rest).eq('id', id).select('*').single()) as Bin
      }
      return check(await sb.from('bins').insert({ ...bin, created_by: await uid() }).select('*').single()) as Bin
    },
    async uploadBinPhoto(file) {
      const blob = await fileToJpeg(file)
      const path = `${crypto.randomUUID()}.jpg`
      check(await sb.storage.from('bin-photos').upload(path, blob, { contentType: 'image/jpeg' }))
      return sb.storage.from('bin-photos').getPublicUrl(path).data.publicUrl
    },
    async deleteBin(id) {
      // descartes antigos continuam no histórico (bin_id vira null)
      check(await sb.from('bins').delete().eq('id', id))
    },
    async listAllBins() {
      return check(await sb.from('bins').select('*').order('name')) as Bin[]
    },
    async pendingDisposals() {
      const rows = check(
        await sb.from('disposals').select(`${DISPOSAL_FIELDS}, profiles(display_name)`).eq('status', 'pending').order('created_at'),
      ) as unknown as (DisposalRow & { profiles: { display_name: string } | null })[]
      return withImages(rows.map((r) => ({ ...r, display_name: r.profiles?.display_name })))
    },
    async userSeasonDisposals(userId) {
      const season = await api.currentSeason()
      const rows = check(
        await sb
          .from('disposals')
          .select(DISPOSAL_FIELDS)
          .eq('user_id', userId)
          .eq('season_id', season.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
      ) as DisposalRow[]
      return withImages(rows)
    },
    async reviewDisposal(id, approve) {
      check(await sb.rpc('review_disposal', { p_id: id, p_approve: approve }))
    },
    async revokeDisposal(id) {
      check(await sb.rpc('revoke_disposal', { p_id: id }))
    },
    async updateSeasonPrize(id, prize) {
      check(await sb.from('seasons').update({ prize }).eq('id', id))
    },
    async closeSeason(id) {
      check(await sb.rpc('close_season', { p_season: id }))
      return check(await sb.rpc('leaderboard', { p_season: id, p_limit: 3 })) as LeaderRow[]
    },
    async adminListUsers(search) {
      return check(await sb.rpc('admin_list_users', { p_search: search })) as AdminUser[]
    },
    async adminUserAction(input) {
      const { data, error } = await sb.functions.invoke('admin-users', { body: input })
      if (error) {
        // a função devolve { error } com a mensagem; o supabase-js embrulha num FunctionsHttpError
        const detail = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(detail?.error ?? error.message)
      }
      if (data?.error) throw new Error(data.error)
    },
  }
  return api
}
