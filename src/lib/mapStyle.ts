// Estilo do mapa vetorial (MapLibre) nas cores do app: campus em destaque, entorno apagado, sem ícones.
// Tiles: OpenFreeMap (grátis, sem chave), esquema OpenMapTiles.
import type { StyleSpecification } from 'maplibre-gl'

const C = {
  bg: '#08162c',
  campus: '#10284b',
  campusLine: '#3d8fd1',
  water: '#0d2f5c',
  green: '#0c2238',
  building: '#1a3a66',
  buildingLine: '#5aa7e3',
  path: '#8fb2d9',
  minor: '#2b4f80',
  major: '#23426d',
  label: '#fde8b0',
  halo: '#08162c',
}

const CAMPUS = ['university', 'college', 'school']

export const MAP_VECTOR_ATTRIBUTION =
  '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

export const MAP_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    omt: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': C.bg } },
    {
      id: 'park',
      type: 'fill',
      source: 'omt',
      'source-layer': 'park',
      paint: { 'fill-color': C.green, 'fill-opacity': 0.6 },
    },
    {
      id: 'water',
      type: 'fill',
      source: 'omt',
      'source-layer': 'water',
      paint: { 'fill-color': C.water },
    },
    {
      id: 'campus',
      type: 'fill',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', CAMPUS]],
      paint: { 'fill-color': C.campus },
    },
    {
      id: 'campus-line',
      type: 'line',
      source: 'omt',
      'source-layer': 'landuse',
      filter: ['in', ['get', 'class'], ['literal', CAMPUS]],
      paint: { 'line-color': C.campusLine, 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
    },
    {
      id: 'road-major',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.major,
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 2, 19, 22],
      },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service']]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.minor,
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 14, 1, 19, 12],
      },
    },
    {
      id: 'path',
      type: 'line',
      source: 'omt',
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]],
      paint: {
        'line-color': C.path,
        'line-opacity': 0.55,
        'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.6, 19, 2],
        'line-dasharray': [2, 1.5],
      },
    },
    {
      id: 'building',
      type: 'fill',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': C.building, 'fill-opacity': 0.9 },
    },
    {
      id: 'building-line',
      type: 'line',
      source: 'omt',
      'source-layer': 'building',
      minzoom: 15,
      paint: { 'line-color': C.buildingLine, 'line-width': 1, 'line-opacity': 0.55 },
    },
    {
      // só nomes (sem ícones) e só de perto, para não poluir
      id: 'poi-label',
      type: 'symbol',
      source: 'omt',
      'source-layer': 'poi',
      minzoom: 17,
      filter: ['all', ['has', 'name'], ['<=', ['get', 'rank'], 25]],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 8,
      },
      paint: { 'text-color': C.label, 'text-opacity': 0.75, 'text-halo-color': C.halo, 'text-halo-width': 1.5 },
    },
  ],
}
