import { describe, expect, it } from 'vitest'
import { allowedDistance, checkGeofence, haversineMeters, localDate } from '../supabase/functions/_shared/geo.ts'

// ~1e-5 grau de latitude ≈ 1,11 m
const bin = (id: string, dLatMeters: number) => ({ id, lat: -23.47 + dLatMeters / 111320, lng: -47.43, radius_m: 15 })
const me = { lat: -23.47, lng: -47.43 }

describe('haversine', () => {
  it('calcula distâncias curtas com boa precisão', () => {
    expect(haversineMeters(me, bin('a', 100))).toBeCloseTo(100, 0)
  })
})

describe('geofence', () => {
  it('aceita dentro do raio e soma no máximo 30 m de margem do GPS', () => {
    expect(allowedDistance(15, 8)).toBe(23)
    expect(allowedDistance(15, 200)).toBe(45)
  })

  it('escolhe a lixeira mais próxima dentro do raio', () => {
    const r = checkGeofence([bin('far', 80), bin('near', 10)], me, 5)
    expect(r.ok && r.bin.id).toBe('near')
  })

  it('recusa fora do raio e informa a mais próxima', () => {
    const r = checkGeofence([bin('a', 50)], me, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe('out_of_range')
      expect(Math.round(r.nearest!.distance)).toBe(50)
    }
  })

  it('usa a margem do GPS: 30 m de distância passa com ±20 m', () => {
    expect(checkGeofence([bin('a', 30)], me, 20).ok).toBe(true)
    expect(checkGeofence([bin('a', 30)], me, 5).ok).toBe(false)
  })

  it('recusa leitura imprecisa demais', () => {
    const r = checkGeofence([bin('a', 0)], me, 80)
    expect(!r.ok && r.reason).toBe('imprecise')
  })

  it('exige a lixeira escolhida quando binId vem preenchido', () => {
    expect(checkGeofence([bin('a', 5), bin('b', 10)], me, 5, 'b').ok).toBe(true)
    expect(checkGeofence([bin('a', 5), bin('b', 90)], me, 5, 'b').ok).toBe(false)
  })

  it('não aceita sem lixeiras', () => {
    const r = checkGeofence([], me, 5)
    expect(!r.ok && r.reason).toBe('no_bins')
  })
})

describe('localDate', () => {
  it('usa o fuso de São Paulo', () => {
    // 02:00 UTC = 23:00 do dia anterior em SP
    expect(localDate(new Date('2026-09-26T02:00:00Z'))).toBe('2026-09-25')
  })
})
