import type { Material } from '../../supabase/functions/_shared/materials.ts'
import type { AiResult } from '../../supabase/functions/_shared/gemini.ts'
import type { ScoreLine } from '../../supabase/functions/_shared/scoring.ts'

export type { Material, AiResult, ScoreLine }

export type Role = 'student' | 'admin'
export type DisposalStatus = 'approved' | 'pending' | 'rejected'

export interface Profile {
  id: string
  email: string
  display_name: string
  course: string
  role: Role
  xp: number
  streak: number
  last_disposal_date: string | null
  consent_at: string | null
  /** nome completo da conta Microsoft (para sugerir o nome de exibição) */
  full_name?: string
  banned_at?: string | null
  ban_reason?: string | null
}

/** Linha da aba USUÁRIOS. id nulo = e-mail banido cuja conta já foi apagada. */
export interface AdminUser {
  id: string | null
  email: string
  display_name: string
  course: string
  role: Role
  created_at: string
  last_sign_in_at: string | null
  banned_at: string | null
  ban_reason: string | null
  disposals: number
  season_points: number
}

export type AdminUserAction =
  | { action: 'delete_disposals'; user_id: string }
  | { action: 'ban'; user_id: string; reason: string; delete_disposals: boolean }
  | { action: 'unban'; user_id: string | null; email: string }
  | { action: 'delete_account'; user_id: string; ban: boolean; reason: string }

export interface Bin {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  radius_m: number
  accepts: Material[]
  active: boolean
  /** foto do lugar (enviada pelo admin), mostrada no popup do mapa */
  photo_url?: string | null
}

export interface Season {
  id: string
  name: string
  starts_at: string
  ends_at: string
  prize: string
  closed: boolean
}

export interface Disposal {
  id: string
  user_id: string
  bin_id: string | null
  item_label: string
  material: Material | null
  points: number
  status: DisposalStatus
  reason: string | null
  created_at: string
  ai: Partial<AiResult>
  breakdown: ScoreLine[]
  image_url?: string
  display_name?: string
  source?: 'camera' | 'gallery'
}

export interface LeaderRow {
  pos: number
  user_id: string
  display_name: string
  course: string
  points: number
  disposals: number
}

export interface CourseRow {
  pos: number
  course: string
  points: number
  players: number
}

export interface FeedItem {
  display_name: string
  item_label: string
  material: Material | null
  bin_name: string | null
  points: number
  created_at: string
}

export interface RegisterInput {
  image: Blob
  lat: number
  lng: number
  accuracy: number
  binId?: string
  source?: 'camera' | 'gallery'
}

export type RegisterResult =
  | {
      status: 'approved' | 'pending'
      points: number
      breakdown: ScoreLine[]
      ai: AiResult
      bin: { id: string; name: string }
      correctBin: string
      streak: number
      /** motivos da revisão (quando status = pending) */
      reasons?: string[]
      message?: string
    }
  | { status: 'rejected'; code: string; message: string; ai?: AiResult }
  | { status: 'error'; code: string; message: string; nearest?: { name: string; distance: number } }

export type LeaderScope = 'season' | 'week'

/** A conta da sessão salva não existe mais (apagada pelo admin): o app sai e volta ao login. */
export class AccountGoneError extends Error {
  constructor() {
    super('Sua conta foi removida. Entre de novo para criar outra.')
    this.name = 'AccountGoneError'
  }
}

export type ClaimResult = 'ok' | 'wrong' | 'pending' | 'expired'

export interface Api {
  demo: boolean
  getSessionEmail(): Promise<string | null>
  onAuthChange(cb: (email: string | null) => void): () => void
  /** Login com a conta Microsoft da faculdade (sai do app e volta logado). */
  signInWithMicrosoft(): Promise<void>
  /** Login pelo navegador de fora (iPhone): cria o pedido e devolve a URL de /entrar para abrir no Safari. */
  startExternalLogin(): Promise<string>
  /** O app resgata, com o código mostrado no Safari, a sessão feita lá. */
  claimExternalLogin(code: string): Promise<ClaimResult>
  hasPendingExternalLogin(): boolean
  cancelExternalLogin(): void
  /** Página /entrar (no navegador de fora): leva à Microsoft e, na volta, entrega a sessão ao app e mostra o código. */
  completeExternalLogin(handoffId: string): Promise<{ kind: 'redirecting' } | { kind: 'done'; code: string }>
  signOut(): Promise<void>

  getProfile(): Promise<Profile>
  updateProfile(patch: Partial<Pick<Profile, 'display_name' | 'course' | 'consent_at'>>): Promise<Profile>
  currentSeason(): Promise<Season>
  listBins(): Promise<Bin[]>
  myDisposals(limit?: number): Promise<Disposal[]>
  registerDisposal(input: RegisterInput): Promise<RegisterResult>
  leaderboard(scope: LeaderScope): Promise<LeaderRow[]>
  courseLeaderboard(): Promise<CourseRow[]>
  feed(): Promise<FeedItem[]>

  // admin
  saveBin(bin: Omit<Bin, 'id'> & { id?: string }): Promise<Bin>
  listAllBins(): Promise<Bin[]>
  deleteBin(id: string): Promise<void>
  /** Reduz e envia a foto de uma lixeira; devolve a URL pública. */
  uploadBinPhoto(file: File): Promise<string>
  pendingDisposals(): Promise<Disposal[]>
  userSeasonDisposals(userId: string): Promise<Disposal[]>
  reviewDisposal(id: string, approve: boolean): Promise<void>
  revokeDisposal(id: string): Promise<void>
  updateSeasonPrize(id: string, prize: string): Promise<void>
  closeSeason(id: string): Promise<LeaderRow[]>
  adminListUsers(search: string): Promise<AdminUser[]>
  adminUserAction(input: AdminUserAction): Promise<void>
}
