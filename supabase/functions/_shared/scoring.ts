// Regras de pontuação. Rodam no servidor (Edge Function) e no modo demo.
import { MATERIAL_INFO, type Material } from './materials.ts'

export const STREAK_MULTIPLIER = 1.2
export const STREAK_MIN_DAYS = 3
export const FIRST_VISIT_BONUS = 5
export const FIRST_OF_DAY_BONUS = 3
/** Retorno decrescente para o mesmo material no mesmo dia. */
export const FULL_VALUE_PER_MATERIAL_PER_DAY = 5
export const HALF_VALUE_PER_MATERIAL_PER_DAY = 10

export interface ScoreInput {
  material: Material
  firstVisitToBin: boolean
  firstOfDay: boolean
  /** streak já contando o dia de hoje */
  streakDays: number
  /** quantos itens desse material o usuário já registrou hoje (antes deste) */
  sameMaterialToday: number
}

export interface ScoreLine {
  label: string
  value: string
}

export interface ScoreResult {
  points: number
  breakdown: ScoreLine[]
}

export function diminishingFactor(sameMaterialToday: number): number {
  if (sameMaterialToday < FULL_VALUE_PER_MATERIAL_PER_DAY) return 1
  if (sameMaterialToday < HALF_VALUE_PER_MATERIAL_PER_DAY) return 0.5
  return 0
}

export function computePoints(input: ScoreInput): ScoreResult {
  const info = MATERIAL_INFO[input.material]
  const breakdown: ScoreLine[] = [{ label: info.label, value: `+${info.basePoints}` }]
  let points = info.basePoints

  const factor = diminishingFactor(input.sameMaterialToday)
  if (factor < 1) {
    points *= factor
    breakdown.push({ label: 'Mesmo material hoje', value: `×${factor}` })
  }
  if (input.streakDays >= STREAK_MIN_DAYS) {
    points *= STREAK_MULTIPLIER
    breakdown.push({ label: `Streak ${input.streakDays} dias`, value: `×${STREAK_MULTIPLIER}` })
  }
  points = Math.round(points)
  if (input.firstVisitToBin) {
    points += FIRST_VISIT_BONUS
    breakdown.push({ label: 'Lixeira inexplorada', value: `+${FIRST_VISIT_BONUS}` })
  }
  if (input.firstOfDay) {
    points += FIRST_OF_DAY_BONUS
    breakdown.push({ label: '1º descarte do dia', value: `+${FIRST_OF_DAY_BONUS}` })
  }
  return { points, breakdown }
}

/** Novo streak dado o último dia com descarte e o dia de hoje (AAAA-MM-DD). */
export function nextStreak(lastDate: string | null, today: string, current: number): number {
  if (lastDate === today) return Math.max(current, 1)
  if (lastDate && addDays(lastDate, 1) === today) return current + 1
  return 1
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(xp, 0) / 10))
}

export function xpForLevel(level: number): number {
  return level * level * 10
}
