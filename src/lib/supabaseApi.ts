import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { formatPersonName, looksLikeEmailName } from './names'
import type { Api, Bin, Disposal, LeaderRow, Profile, RegisterResult } from './types'

const DISPOSAL_FIELDS =
  'id, user_id, bin_id, item_label, material, points, status, reason, created_at, ai, breakdown, image_path, source'

type DisposalRow = Disposal & { image_path: string | null }

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    // PKCE: a Microsoft devolve ?code= para o app, que troca pela sessão sozinho (detectSessionInUrl)
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
  })

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
      const { data } = await sb.auth.getSession()
      return data.session?.user.email ?? null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session?.user.email ?? null))
      return () => data.subscription.unsubscribe()
    },
    async signInWithMicrosoft() {
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'openid email profile',
          redirectTo: window.location.origin,
          queryParams: { prompt: 'select_account', domain_hint: 'facens.br' },
        },
      })
      if (error) throw new Error(error.message)
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async getProfile() {
      const { data: session } = await sb.auth.getSession()
      const id = await uid()
      const row = check(await sb.from('profiles').select('*').eq('id', id).single()) as Profile
      const user = session.session?.user
      const email = user?.email ?? ''
      // perfis antigos ficaram com o RA/parte do e-mail como nome: usa o nome da conta Microsoft
      const realName = formatPersonName(user?.user_metadata?.full_name ?? user?.user_metadata?.name)
      if (realName && looksLikeEmailName(row.display_name, email)) {
        const { error } = await sb.from('profiles').update({ display_name: realName }).eq('id', id)
        if (!error) row.display_name = realName
      }
      return { ...row, email }
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
  }
  return api
}
