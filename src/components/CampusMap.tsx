import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, type ReactNode } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { DEFAULT_ZOOM, FACENS_CENTER } from '../lib/campus'
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

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng.lat, e.latlng.lng) })
  return null
}

function FlyTo({ target }: { target: { lat: number; lng: number; key: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 18), { duration: 0.8 })
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
}

export function CampusMap({ bins, visited, selectedId, me, flyTo, onMapClick, renderPopup, onBinClick }: CampusMapProps) {
  const center = useMemo<[number, number]>(() => [FACENS_CENTER.lat, FACENS_CENTER.lng], [])
  return (
    <MapContainer center={center} zoom={DEFAULT_ZOOM} zoomControl={false} attributionControl maxZoom={20}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />
      <ClickHandler onClick={onMapClick} />
      <FlyTo target={flyTo ?? null} />
      {bins.map((bin) => {
        const variant = !bin.active ? 'inactive' : bin.id === selectedId ? 'selected' : visited?.has(bin.id) ? 'visited' : 'new'
        return (
          <Marker
            key={bin.id}
            position={[bin.lat, bin.lng]}
            icon={ICON_CACHE[variant]}
            eventHandlers={onBinClick ? { click: () => onBinClick(bin) } : undefined}
          >
            {renderPopup && <Popup autoPanPaddingTopLeft={[16, 170]}>{renderPopup(bin)}</Popup>}
          </Marker>
        )
      })}
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} />}
    </MapContainer>
  )
}
