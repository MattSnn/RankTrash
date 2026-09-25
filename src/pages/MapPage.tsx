import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { haversineMeters } from '../../supabase/functions/_shared/geo.ts'
import { MATERIAL_INFO, MATERIALS } from '../../supabase/functions/_shared/materials.ts'
import { CampusMap, mapBoundsFor } from '../components/CampusMap'
import { Mascot } from '../components/Mascot'
import { Icon } from '../components/PixelArt'
import { api } from '../lib/api'
import { FACENS_CENTER } from '../lib/campus'
import type { Bin } from '../lib/types'
import { useGeolocation } from '../lib/useGeolocation'

function Radar() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden>
      <polygon
        points="50,4 83,17 96,50 83,83 50,96 17,83 4,50 17,17"
        fill="rgba(11,30,58,.85)"
        stroke="#3d8fd1"
        strokeWidth="2"
      />
      {[34, 24, 14].map((r) => (
        <polygon
          key={r}
          points={Array.from({ length: 8 }, (_, i) => {
            const a = (Math.PI / 4) * i - Math.PI / 2
            return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`
          }).join(' ')}
          fill="none"
          stroke="#3d8fd1"
          strokeWidth="1"
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i
        return (
          <line
            key={i}
            x1="50"
            y1="50"
            x2={50 + 46 * Math.cos(a)}
            y2={50 + 46 * Math.sin(a)}
            stroke="#3d8fd1"
            strokeWidth="1"
          />
        )
      })}
      <g className="radar__sweep">
        <line x1="50" y1="50" x2="50" y2="6" stroke="#8fe39a" strokeWidth="3" />
      </g>
      <circle cx="50" cy="50" r="7" fill="#fde8b0" stroke="#0a0f1f" strokeWidth="2" />
    </svg>
  )
}

export function MapPage() {
  const [bins, setBins] = useState<Bin[]>([])
  const [visited, setVisited] = useState<Set<string>>(new Set())
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [geoOn, setGeoOn] = useState(false)
  const [awayKm, setAwayKm] = useState<number | null>(null)
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null)
  const { reading } = useGeolocation(geoOn, api.demo && bins[0] ? bins[0] : null)

  useEffect(() => {
    void api.listBins().then(setBins)
    void api
      .myDisposals(500)
      .then((ds) => setVisited(new Set(ds.filter((d) => d.status !== 'rejected' && d.bin_id).map((d) => d.bin_id!))))
  }, [])

  /** Vai até a minha posição; fora da área do mapa, avisa a distância e mostra o campus. */
  function goToMe(pos: { lat: number; lng: number }) {
    if (mapBoundsFor(bins).contains([pos.lat, pos.lng])) {
      setAwayKm(null)
      setFlyTo({ ...pos, key: Date.now() })
    } else {
      setAwayKm(haversineMeters(pos, FACENS_CENTER) / 1000)
      setFlyTo({ ...FACENS_CENTER, key: Date.now() })
    }
  }

  useEffect(() => {
    if (reading) goToMe(reading)
    // só centraliza na primeira leitura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading != null])

  const unexplored = useMemo(() => bins.filter((b) => !visited.has(b.id)).length, [bins, visited])

  return (
    <div className="map-wrap">
      <CampusMap
        bins={bins}
        visited={visited}
        me={reading}
        flyTo={flyTo}
        renderPopup={(bin) => (
          <div>
            <h3>{bin.name}</h3>
            {bin.photo_url && (
              <button className="bin-photo-thumb" onClick={() => setPhoto({ url: bin.photo_url!, name: bin.name })}>
                <img src={bin.photo_url} alt={`Foto de ${bin.name}`} loading="lazy" />
                <span>VER FOTO</span>
              </button>
            )}
            {bin.description && <p>{bin.description}</p>}
            <p>
              {visited.has(bin.id) ? '✔ Já visitada' : '★ Inexplorada: +5 pts na 1ª visita'}
              {reading && (
                <>
                  <br />
                  Você está a {Math.round(haversineMeters(reading, bin))} m
                </>
              )}
            </p>
            {bin.accepts.length < MATERIALS.length && (
              <p style={{ fontSize: 15 }}>Aceita: {bin.accepts.map((m) => MATERIAL_INFO[m].label).join(', ')}</p>
            )}
            <Link to={`/registrar?bin=${bin.id}`} className="btn btn--green btn--sm">
              DESCARTAR AQUI
            </Link>
          </div>
        )}
      />
      <div className="map-overlay-top">
        <Mascot size={54} mood="idle" />
        <div className="banner">
          {awayKm != null
            ? `VOCÊ ESTÁ A ${awayKm < 10 ? awayKm.toFixed(1).replace('.', ',') : Math.round(awayKm)} KM DA FACENS`
            : bins.length === 0
              ? 'NENHUMA LIXEIRA AINDA'
              : unexplored > 0
                ? `${unexplored} LIXEIRAS INEXPLORADAS`
                : 'TODAS AS LIXEIRAS VISITADAS!'}
        </div>
      </div>
      <div className="side-tabs" aria-hidden>
        <span style={{ background: 'var(--green)' }}>
          <Icon name="bin" size={12} /> {visited.size}
        </span>
        <span style={{ background: 'var(--red)' }}>
          <Icon name="bin" size={12} /> {unexplored}
        </span>
      </div>
      {photo && (
        <div className="photo-viewer" role="dialog" aria-label={`Foto de ${photo.name}`} onClick={() => setPhoto(null)}>
          <img src={photo.url} alt={`Foto de ${photo.name}`} />
          <p className="title-font">{photo.name.toUpperCase()}</p>
          <button className="btn btn--sm">FECHAR</button>
        </div>
      )}
      <button
        className="radar"
        aria-label="Centralizar na minha localização"
        onClick={() => {
          setGeoOn(true)
          if (reading) goToMe(reading)
        }}
      >
        <Radar />
      </button>
    </div>
  )
}
