import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, type ReactNode } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import {
  DEFAULT_ZOOM,
  FACENS_CENTER,
  MAP_ATTRIBUTION,
  MAP_BOUNDS_PAD,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_MODE,
  MAP_TILE_FILTER,
  MAP_TILE_URL,
} from '../lib/campus'
import type { Bin } from '../lib/types'
import { iconSvg } from './PixelArt'

const binSvg = iconSvg('bin', 18)

function pinIcon(variant: 'visited' | 'new' | 'selected' | 'inactive') {
  return L.divIcon({
    className: '',
    html: `<div class="pin ${variant === 'new' ? '' : `pin--${variant}`}"><span>${binSvg}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  })
}

const ICON_CACHE = {
  visited: pinIcon('visited'),
  new: pinIcon('new'),
  selected: pinIcon('selected'),
  inactive: pinIcon('inactive'),
}

const meIcon = L.divIcon({ className: '', html: '<div class="me-dot"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

/** Base vetorial (MapLibre) como camada do Leaflet. Carregada sob demanda para não pesar o início do app. */
function VectorBase() {
  const map = useMap()
  useEffect(() => {
    let layer: L.Layer | undefined
    let cancelled = false
    void Promise.all([
      import('@maplibre/maplibre-gl-leaflet'),
      import('../lib/mapStyle'),
      import('maplibre-gl'),
      // o worker do MapLibre 6 é um arquivo separado: o Vite empacota e devolve a URL
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ]).then(([{ maplibreGL }, { MAP_STYLE, MAP_VECTOR_ATTRIBUTION }, maplibre, worker]) => {
      if (cancelled) return
      maplibre.setWorkerUrl(worker.default)
      layer = maplibreGL({ style: MAP_STYLE, attributionControl: false })
      layer.getAttribution = () => MAP_VECTOR_ATTRIBUTION
      layer.addTo(map)
      map.attributionControl?.addAttribution(MAP_VECTOR_ATTRIBUTION)
    })
    return () => {
      cancelled = true
      layer?.remove()
    }
  }, [map])
  return null
}

/**
 * Área navegável: o campus com margem, estendida para incluir todas as lixeiras
 * (ex.: uma lixeira de teste fora do campus continua alcançável).
 */
export function mapBoundsFor(bins: { lat: number; lng: number }[]): L.LatLngBounds {
  const b = L.latLngBounds(
    [FACENS_CENTER.lat - MAP_BOUNDS_PAD, FACENS_CENTER.lng - MAP_BOUNDS_PAD],
    [FACENS_CENTER.lat + MAP_BOUNDS_PAD, FACENS_CENTER.lng + MAP_BOUNDS_PAD],
  )
  for (const bin of bins) {
    b.extend(
      L.latLngBounds(
        [bin.lat - MAP_BOUNDS_PAD / 2, bin.lng - MAP_BOUNDS_PAD / 2],
        [bin.lat + MAP_BOUNDS_PAD / 2, bin.lng + MAP_BOUNDS_PAD / 2],
      ),
    )
  }
  return b
}

/** maxBounds do MapContainer só vale na criação; este componente atualiza quando as lixeiras mudam. */
function MaxBounds({ bounds }: { bounds: L.LatLngBounds }) {
  const map = useMap()
  useEffect(() => {
    map.setMaxBounds(bounds)
  }, [map, bounds])
  return null
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target)
      map.flyTo([target.lat, target.lng], Math.min(Math.max(map.getZoom(), 18), MAP_MAX_ZOOM), { duration: 0.8 })
  }, [map, target])
  return null
}

interface CampusMapProps {
  bins: Bin[]
  visited?: Set<string>
  selectedId?: string | null
  me?: { lat: number; lng: number } | null
  flyTo?: { lat: number; lng: number; key: number } | null
  onMapClick?: (lat: number, lng: number) => void
  renderPopup?: (bin: Bin) => ReactNode
  onBinClick?: (bin: Bin) => void
  /** lixeira que pode ser arrastada no mapa (edição do admin) */
  draggableId?: string | null
  onBinDrag?: (lat: number, lng: number) => void
}

export function CampusMap({
  bins,
  visited,
  selectedId,
  me,
  flyTo,
  onMapClick,
  renderPopup,
  onBinClick,
  draggableId,
  onBinDrag,
}: CampusMapProps) {
  const center = useMemo<[number, number]>(() => [FACENS_CENTER.lat, FACENS_CENTER.lng], [])
  const bounds = useMemo(() => mapBoundsFor(bins), [bins])
  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      zoomControl={false}
      attributionControl
      maxZoom={MAP_MAX_ZOOM}
      minZoom={MAP_MIN_ZOOM}
      maxBounds={bounds}
      maxBoundsViscosity={0.8}
      className={MAP_MODE === 'raster' && MAP_TILE_FILTER === 'dark' ? 'map--dark' : undefined}
    >
      {MAP_MODE === 'raster' && MAP_TILE_URL ? (
        <TileLayer url={MAP_TILE_URL} attribution={MAP_ATTRIBUTION} maxZoom={MAP_MAX_ZOOM} />
      ) : (
        <VectorBase />
      )}
      <MaxBounds bounds={bounds} />
      <ClickHandler onClick={onMapClick} />
      <FlyTo target={flyTo ?? null} />
      {bins.map((bin) => {
        const variant = !bin.active
          ? 'inactive'
          : bin.id === selectedId
            ? 'selected'
            : visited?.has(bin.id)
              ? 'visited'
              : 'new'
        return (
          <Marker
            key={bin.id}
            position={[bin.lat, bin.lng]}
            icon={ICON_CACHE[variant]}
            draggable={bin.id === draggableId}
            eventHandlers={{
              click: () => onBinClick?.(bin),
              dragend: (e) => {
                const p = (e.target as L.Marker).getLatLng()
                onBinDrag?.(p.lat, p.lng)
              },
            }}
          >
            {renderPopup && <Popup autoPanPaddingTopLeft={[16, 170]}>{renderPopup(bin)}</Popup>}
          </Marker>
        )
      })}
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />}
    </MapContainer>
  )
}
