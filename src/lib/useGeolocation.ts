import { useEffect, useState } from 'react'
import { haversineMeters, type LatLng } from '../../supabase/functions/_shared/geo.ts'

export interface GeoReading extends LatLng {
  accuracy: number
  timestamp: number
  simulated?: boolean
}

export interface GeoState {
  reading: GeoReading | null
  error: string | null
}

/** Janela em que a melhor leitura recente é mantida (GPS oscila bastante). */
const BEST_WINDOW_MS = 15000

/**
 * Acompanha o GPS e devolve a leitura mais precisa dos últimos segundos.
 * `simulateAt`: no modo demo, usa esta posição se o GPS falhar ou estiver longe do campus.
 */
export function useGeolocation(enabled: boolean, simulateAt?: LatLng | null): GeoState {
  const [state, setState] = useState<GeoState>({ reading: null, error: null })

  useEffect(() => {
    if (!enabled) return
    const simulate = () =>
      simulateAt &&
      setState({
        reading: { ...simulateAt, accuracy: 8, timestamp: Date.now(), simulated: true },
        error: null,
      })

    if (!('geolocation' in navigator)) {
      if (simulateAt) simulate()
      else setState({ reading: null, error: 'Este navegador não tem GPS.' })
      return
    }
    let history: GeoReading[] = []
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const r: GeoReading = {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          timestamp: p.timestamp || Date.now(),
        }
        if (simulateAt && haversineMeters(r, simulateAt) > 3000) {
          simulate()
          return
        }
        history = [...history.filter((h) => r.timestamp - h.timestamp < BEST_WINDOW_MS), r]
        const best = history.reduce((a, b) => (b.accuracy < a.accuracy ? b : a))
        setState({ reading: best, error: null })
      },
      (err) => {
        if (simulateAt) return simulate()
        setState((s) => ({
          reading: s.reading,
          error:
            err.code === err.PERMISSION_DENIED
              ? 'Permita o acesso à localização para registrar descartes.'
              : 'Não foi possível obter sua localização.',
        }))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [enabled, simulateAt])

  return state
}
