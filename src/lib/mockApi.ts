// API simulada para o modo demo: dados em memória e "IA" sorteada.
// Usa as mesmas regras de pontuação/antifraude do servidor.
import {
  REJECT_MESSAGES,
  aiSignature,
  checkAiResult,
  checkPhotoHash,
  type RecentDisposal,
} from '../../supabase/functions/_shared/antifraud.ts'
import { checkGeofence, localDate } from '../../supabase/functions/_shared/geo.ts'
import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import { computePoints, nextStreak } from '../../supabase/functions/_shared/scoring.ts'
import { FACENS_CENTER } from './campus'
import { dhashOfBlob } from './image'
import type { AiResult, Api, Bin, Disposal, LeaderRow, Profile, Season } from './types'

const ME = 'demo-user'
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const id = () => Math.random().toString(36).slice(2, 10)

const off = (dLat: number, dLng: number) => ({ lat: FACENS_CENTER.lat + dLat, lng: FACENS_CENTER.lng + dLng })

const bins: Bin[] = [
  { name: 'Bloco A · Entrada', ...off(0.0004, -0.0006) },
  { name: 'Bloco B · Corredor', ...off(0.0009, 0.0002) },
  { name: 'Praça de Alimentação', ...off(-0.0003, 0.0007) },
  { name: 'Biblioteca', ...off(-0.0008, -0.0002) },
  { name: 'Estacionamento', ...off(-0.0012, 0.0012) },
  { name: 'Laboratórios', ...off(0.0014, -0.0011) },
  { name: 'Quadra', ...off(0.0002, 0.0016) },
].map((b, i) => ({
  id: `bin-${i + 1}`,
  description: '',
  radius_m: 15,
  accepts: [...MATERIALS],
  active: true,
  ...b,
}))

const now = new Date()
const season: Season = {
  id: 'season-demo',
  name: `Temporada ${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
  starts_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
  ends_at: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
  prize: '1º: Kit ecológico + fone · 2º: Garrafa térmica · 3º: Caneca Facens',
  closed: false,
}

let profile: Profile = {
  id: ME,
  email: 'voce@facens.br',
  display_name: 'Você',
  course: 'Engenharia da Computação',
  role: 'admin',
  xp: 132,
  streak: 2,
  last_disposal_date: localDate(new Date(Date.now() - 86400000)),
  consent_at: new Date().toISOString(),
}

const others: { user_id: string; display_name: string; course: string; points: number; week: number }[] = [
  { user_id: 'u1', display_name: 'Ana Lixo Zero', course: 'Engenharia Civil', points: 486, week: 120 },
  { user_id: 'u2', display_name: 'Pedro Latinha', course: 'Engenharia Mecânica', points: 431, week: 88 },
  { user_id: 'u3', display_name: 'Julia R.', course: 'Arquitetura e Urbanismo', points: 377, week: 140 },
  { user_id: 'u4', display_name: 'Caio_Recicla', course: 'Engenharia da Computação', points: 298, week: 60 },
  { user_id: 'u5', display_name: 'Bia', course: 'Engenharia de Produção', points: 240, week: 45 },
  { user_id: 'u6', display_name: 'Lucas M.', course: 'Engenharia Civil', points: 188, week: 30 },
  { user_id: 'u7', display_name: 'Mari', course: 'Engenharia Química', points: 150, week: 52 },
  { user_id: 'u8', display_name: 'Theo', course: 'Engenharia Elétrica', points: 96, week: 20 },
  { user_id: 'u9', display_name: 'Gabi', course: 'Engenharia da Computação', points: 61, week: 12 },
]

const mkAi = (item_label: string, material: AiResult['material'], extra: Partial<AiResult> = {}): AiResult => ({
  is_trash: true,
  item_label,
  material,
  brand: '',
  color: '',
  condition: 'vazia',
  bin_visible: true,
  is_screen_or_print: false,
  confidence: 0.93,
  tip: '',
  ...extra,
})

const SAMPLES: AiResult[] = [
  mkAi('Lata de refrigerante', 'aluminio', { brand: 'Coca-Cola', color: 'vermelha', condition: 'amassada', tip: 'Amasse a lata para ocupar menos espaço.' }),
  mkAi('Garrafa PET 500 ml', 'plastico', { brand: 'Crystal', color: 'transparente', tip: 'Tampe a garrafa: a tampa também é reciclável.' }),
  mkAi('Copo de café de papel', 'papel', { color: 'branco', bin_visible: false, tip: 'Copos de papel com plástico por dentro: confira a coleta local.' }),
  mkAi('Casca de banana', 'organico', { color: 'amarela', tip: 'Orgânicos podem virar adubo na composteira.' }),
  mkAi('Lata de energético', 'aluminio', { brand: 'Monster', color: 'preta', condition: 'intacta', tip: 'Latas são 100% recicláveis infinitas vezes.' }),
  mkAi('Embalagem de salgadinho', 'nao_reciclavel', { color: 'laranja', confidence: 0.55, tip: 'Embalagens metalizadas geralmente não são recicláveis.' }),
]

let myDisposals: (Disposal & { dhash?: string; signature?: string })[] = [
  {
    id: id(),
    user_id: ME,
    bin_id: 'bin-1',
    item_label: 'Lata de refrigerante',
    material: 'aluminio',
    points: 16,
    status: 'approved',
    reason: null,
    created_at: new Date(Date.now() - 86400000).toISOString(),
    ai: SAMPLES[0],
    breakdown: [],
  },
  {
    id: id(),
    user_id: ME,
    bin_id: 'bin-3',
    item_label: 'Garrafa PET 500 ml',
    material: 'plastico',
    points: 13,
    status: 'approved',
    reason: null,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    ai: SAMPLES[1],
    breakdown: [],
  },
]

const pending: Disposal[] = [
  {
    id: 'p1',
    user_id: 'u5',
    bin_id: 'bin-2',
    item_label: 'Embalagem de salgadinho',
    material: 'nao_reciclavel',
    points: 5,
    status: 'pending',
    reason: 'baixa confiança da IA',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    ai: SAMPLES[5],
    breakdown: [],
    display_name: 'Bia',
  },
]

function mySeasonPoints() {
  return myDisposals
    .filter((d) => d.status === 'approved' && d.created_at >= season.starts_at)
    .reduce((s, d) => s + d.points, 0)
}

function rank(rows: Omit<LeaderRow, 'pos'>[]): LeaderRow[] {
  const sorted = [...rows].sort((a, b) => b.points - a.points)
  return sorted.map((r) => ({ ...r, pos: sorted.findIndex((x) => x.points === r.points) + 1 }))
}

let sampleCursor = 0

export function createMockApi(): Api {
  let email: string | null = profile.email
  const listeners = new Set<(email: string | null) => void>()
  const emit = () => listeners.forEach((cb) => cb(email))

  const api: Api = {
    demo: true,
    async getSessionEmail() {
      return email
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signInWithMicrosoft() {
      await delay(400)
      email = 'voce@facens.br'
      profile = { ...profile, email }
      emit()
    },
    async signOut() {
      email = null
      emit()
    },

    async getProfile() {
      return profile
    },
    async updateProfile(patch) {
      profile = { ...profile, ...patch }
      return profile
    },
    async currentSeason() {
      return season
    },
    async listBins() {
      return bins.filter((b) => b.active)
    },
    async myDisposals() {
      return [...myDisposals]
    },
    async registerDisposal(input) {
      await delay(1600)
      const geo = checkGeofence(bins.filter((b) => b.active), input, input.accuracy, input.binId)
      if (!geo.ok) {
        return {
          status: 'error',
          code: geo.reason,
          message: geo.reason === 'imprecise' ? 'Sinal de GPS fraco. Tente em um lugar mais aberto.' : 'Você não está em uma lixeira cadastrada.',
        }
      }
      const nowD = new Date()
      const today = localDate(nowD)
      const mine: (RecentDisposal & { material: string | null })[] = myDisposals
        .filter((d) => d.status !== 'rejected')
        .map((d) => ({ user_id: ME, bin_id: d.bin_id, dhash: d.dhash ?? null, signature: d.signature ?? null, created_at: d.created_at, material: d.material }))

      const dhash = await dhashOfBlob(input.image)
      const photo = checkPhotoHash(dhash, mine, [])
      if (photo.reject) return { status: 'rejected', code: photo.reject, message: REJECT_MESSAGES[photo.reject] }

      const ai = SAMPLES[sampleCursor++ % SAMPLES.length]
      const signature = aiSignature(ai)
      const aiCheck = checkAiResult(ai, signature, geo.bin.id, mine, nowD)
      if (aiCheck.reject) return { status: 'rejected', code: aiCheck.reject, message: REJECT_MESSAGES[aiCheck.reject], ai }

      const todays = mine.filter((d) => localDate(new Date(d.created_at)) === today)
      const streak = nextStreak(profile.last_disposal_date, today, profile.streak)
      const score = computePoints({
        material: ai.material,
        firstVisitToBin: !mine.some((d) => d.bin_id === geo.bin.id),
        firstOfDay: todays.length === 0,
        streakDays: streak,
        sameMaterialToday: todays.filter((d) => d.material === ai.material).length,
      })
      const status = aiCheck.needsReview ? 'pending' : 'approved'
      myDisposals = [
        {
          id: id(),
          user_id: ME,
          bin_id: geo.bin.id,
          item_label: ai.item_label,
          material: ai.material,
          points: score.points,
          status,
          reason: aiCheck.reasons.join('; ') || null,
          created_at: nowD.toISOString(),
          ai,
          breakdown: score.breakdown,
          dhash,
          signature,
        },
        ...myDisposals,
      ]
      profile = {
        ...profile,
        xp: profile.xp + (status === 'approved' ? score.points : 0),
        streak,
        last_disposal_date: today,
      }
      return {
        status,
        points: score.points,
        breakdown: score.breakdown,
        ai,
        bin: { id: geo.bin.id, name: geo.bin.name },
        correctBin: MATERIAL_INFO[ai.material].binLabel,
        streak,
        message: status === 'pending' ? 'Registro enviado para revisão. Os pontos entram quando um admin aprovar.' : undefined,
      }
    },
    async leaderboard(scope) {
      const mineWeek = myDisposals
        .filter((d) => d.status === 'approved' && Date.now() - Date.parse(d.created_at) < 7 * 86400000)
        .reduce((s, d) => s + d.points, 0)
      const meRow = {
        user_id: ME,
        display_name: profile.display_name,
        course: profile.course,
        points: scope === 'week' ? mineWeek : mySeasonPoints(),
        disposals: myDisposals.length,
      }
      return rank([
        ...others.map((o) => ({ ...o, points: scope === 'week' ? o.week : o.points, disposals: Math.round(o.points / 11) })),
        meRow,
      ])
    },
    async courseLeaderboard() {
      const byCourse = new Map<string, { points: number; players: Set<string> }>()
      for (const r of [...others, { user_id: ME, course: profile.course, points: mySeasonPoints() }]) {
        const c = byCourse.get(r.course) ?? { points: 0, players: new Set() }
        c.points += r.points
        c.players.add(r.user_id)
        byCourse.set(r.course, c)
      }
      const rows = [...byCourse.entries()].map(([course, v]) => ({ course, points: v.points, players: v.players.size }))
      rows.sort((a, b) => b.points - a.points)
      return rows.map((r, i) => ({ ...r, pos: i + 1 }))
    },
    async feed() {
      const mineFeed = myDisposals
        .filter((d) => d.status === 'approved')
        .slice(0, 3)
        .map((d) => ({
          display_name: profile.display_name,
          item_label: d.item_label,
          material: d.material,
          bin_name: bins.find((b) => b.id === d.bin_id)?.name ?? null,
          points: d.points,
          created_at: d.created_at,
        }))
      const fake = [
        ['Ana Lixo Zero', 'Lata de refrigerante', 'aluminio', 'Bloco A · Entrada', 16],
        ['Pedro Latinha', 'Garrafa PET', 'plastico', 'Praça de Alimentação', 11],
        ['Julia R.', 'Folhas de caderno', 'papel', 'Biblioteca', 8],
        ['Caio_Recicla', 'Pilha AA', 'eletronico', 'Laboratórios', 23],
      ] as const
      return [
        ...mineFeed,
        ...fake.map(([display_name, item_label, material, bin_name, points], i) => ({
          display_name,
          item_label,
          material,
          bin_name,
          points,
          created_at: new Date(Date.now() - (i + 1) * 420000).toISOString(),
        })),
      ]
    },

    async saveBin(bin) {
      if (bin.id) {
        const i = bins.findIndex((b) => b.id === bin.id)
        bins[i] = { ...bins[i], ...bin } as Bin
        return bins[i]
      }
      const created = { ...bin, id: `bin-${id()}` } as Bin
      bins.push(created)
      return created
    },
    async listAllBins() {
      return [...bins]
    },
    async deleteBin(bid) {
      const i = bins.findIndex((b) => b.id === bid)
      if (i >= 0) bins.splice(i, 1)
    },
    async pendingDisposals() {
      return pending.filter((p) => p.status === 'pending')
    },
    async userSeasonDisposals(userId) {
      if (userId === ME) return myDisposals.filter((d) => d.status === 'approved')
      return []
    },
    async reviewDisposal(pid, approve) {
      const p = pending.find((x) => x.id === pid)
      if (p) p.status = approve ? 'approved' : 'rejected'
    },
    async revokeDisposal(did) {
      const d = myDisposals.find((x) => x.id === did)
      if (d && d.status === 'approved') {
        profile = { ...profile, xp: Math.max(0, profile.xp - d.points) }
        d.status = 'rejected'
        d.points = 0
      }
    },
    async updateSeasonPrize(_id, prize) {
      season.prize = prize
    },
    async closeSeason() {
      const top = (await api.leaderboard('season')).slice(0, 3)
      season.closed = true
      return top
    },
  }
  return api
}
