import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Api, Bin, Disposal, LeaderRow, Profile, RegisterResult } from './types'

const DISPOSAL_FIELDS = 'id, user_id, bin_id, item_label, material, points, status, reason, created_at, ai, breakdown, image_path'

type DisposalRow = Disposal & { image_path: string | null }

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb: SupabaseClient = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
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
    async sendLoginCode(email) {
      check(
        await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: window.location.origin } }),
      )
    },
    async verifyLoginCode(email, code) {
      check(await sb.auth.verifyOtp({ email, token: code, type: 'email' }))
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async getProfile() {
      const { data: session } = await sb.auth.getSession()
      const id = await uid()
      const row = check(await sb.from('profiles').select('*').eq('id', id).single())
      return { ...(row as Profile), email: session.session?.user.email ?? '' }
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
      const { data, error } = await sb.functions.invoke('register-disposal', { body: form })
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
