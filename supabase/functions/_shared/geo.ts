// Geolocalização: distância, geofence das lixeiras e data local.

export interface LatLng {
  lat: number
  lng: number
}

export interface BinLike extends LatLng {
  id: string
  radius_m: number
}

/** Margem máxima de erro do GPS que "ajuda" o usuário a entrar no raio da lixeira. */
export const MAX_ACCURACY_BONUS_M = 30
/** Acima disso a leitura é considerada imprecisa demais para validar. */
export const MAX_ACCEPTED_ACCURACY_M = 60

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Distância máxima aceita para uma lixeira, considerando a precisão informada pelo GPS. */
export function allowedDistance(radiusM: number, accuracyM: number): number {
  return radiusM + Math.min(Math.max(accuracyM, 0), MAX_ACCURACY_BONUS_M)
}

export interface BinDistance<B extends BinLike> {
  bin: B
  distance: number
  inRange: boolean
}

/** Lixeiras ordenadas pela distância, marcando quais estão dentro do raio. */
export function rankBins<B extends BinLike>(bins: B[], pos: LatLng, accuracyM: number): BinDistance<B>[] {
  return bins
    .map((bin) => {
      const distance = haversineMeters(pos, bin)
      return { bin, distance, inRange: distance <= allowedDistance(bin.radius_m, accuracyM) }
    })
    .sort((a, b) => a.distance - b.distance)
}

export type GeofenceResult<B extends BinLike> =
  | { ok: true; bin: B; distance: number }
  | { ok: false; reason: 'imprecise' | 'out_of_range' | 'no_bins'; nearest?: BinDistance<B> }

/** Valida se a posição está em uma lixeira. Se `binId` vier, exige aquela lixeira. */
export function checkGeofence<B extends BinLike>(
  bins: B[],
  pos: LatLng,
  accuracyM: number,
  binId?: string | null,
): GeofenceResult<B> {
  if (bins.length === 0) return { ok: false, reason: 'no_bins' }
  const ranked = rankBins(bins, pos, accuracyM)
  if (accuracyM > MAX_ACCEPTED_ACCURACY_M) return { ok: false, reason: 'imprecise', nearest: ranked[0] }
  const candidate = binId ? ranked.find((r) => r.bin.id === binId) : ranked[0]
  if (!candidate || !candidate.inRange) return { ok: false, reason: 'out_of_range', nearest: ranked[0] }
  return { ok: true, bin: candidate.bin, distance: candidate.distance }
}

/** Data (AAAA-MM-DD) no fuso de São Paulo, usada para streak e limites diários. */
export function localDate(d: Date, timeZone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
