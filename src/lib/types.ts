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
}

export interface Bin {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  radius_m: number
  accepts: Material[]
  active: boolean
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
      message?: string
    }
  | { status: 'rejected'; code: string; message: string; ai?: AiResult }
  | { status: 'error'; code: string; message: string; nearest?: { name: string; distance: number } }

export type LeaderScope = 'season' | 'week'

export interface Api {
  demo: boolean
  getSessionEmail(): Promise<string | null>
  onAuthChange(cb: (email: string | null) => void): () => void
  sendLoginCode(email: string): Promise<void>
  verifyLoginCode(email: string, code: string): Promise<void>
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
  pendingDisposals(): Promise<Disposal[]>
  userSeasonDisposals(userId: string): Promise<Disposal[]>
  reviewDisposal(id: string, approve: boolean): Promise<void>
  revokeDisposal(id: string): Promise<void>
  updateSeasonPrize(id: string, prize: string): Promise<void>
  closeSeason(id: string): Promise<LeaderRow[]>
}
