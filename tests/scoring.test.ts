import { describe, expect, it } from 'vitest'
import { computePoints, diminishingFactor, levelFromXp, nextStreak, xpForLevel } from '../supabase/functions/_shared/scoring.ts'

const base = { material: 'aluminio' as const, firstVisitToBin: false, firstOfDay: false, streakDays: 1, sameMaterialToday: 0 }

describe('computePoints', () => {
  it('usa a pontuação base do material', () => {
    expect(computePoints(base).points).toBe(10)
    expect(computePoints({ ...base, material: 'organico' }).points).toBe(3)
  })

  it('aplica multiplicadores e bônus fixos', () => {
    // 10 * 1.2 = 12, +5 +3
    const r = computePoints({ ...base, streakDays: 3, firstVisitToBin: true, firstOfDay: true })
    expect(r.points).toBe(20)
    expect(r.breakdown).toHaveLength(4)
  })

  it('tem retorno decrescente para o mesmo material no dia', () => {
    expect(computePoints({ ...base, sameMaterialToday: 4 }).points).toBe(10)
    expect(computePoints({ ...base, sameMaterialToday: 5 }).points).toBe(5)
    expect(computePoints({ ...base, sameMaterialToday: 10 }).points).toBe(0)
    expect(diminishingFactor(9)).toBe(0.5)
  })

  it('streak só multiplica a partir de 3 dias', () => {
    expect(computePoints({ ...base, streakDays: 2 }).points).toBe(10)
    expect(computePoints({ ...base, streakDays: 3 }).points).toBe(12)
  })
})

describe('nextStreak', () => {
  it('mantém no mesmo dia, soma no dia seguinte e reinicia após pular', () => {
    expect(nextStreak('2026-09-25', '2026-09-25', 4)).toBe(4)
    expect(nextStreak('2026-09-24', '2026-09-25', 4)).toBe(5)
    expect(nextStreak('2026-09-22', '2026-09-25', 4)).toBe(1)
    expect(nextStreak(null, '2026-09-25', 0)).toBe(1)
    expect(nextStreak('2026-09-30', '2026-10-01', 2)).toBe(3)
  })
})

describe('níveis', () => {
  it('nível = floor(sqrt(xp/10))', () => {
    expect(levelFromXp(0)).toBe(0)
    expect(levelFromXp(9)).toBe(0)
    expect(levelFromXp(10)).toBe(1)
    expect(levelFromXp(xpForLevel(7))).toBe(7)
    expect(levelFromXp(xpForLevel(7) - 1)).toBe(6)
  })
})
