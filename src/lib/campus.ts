// Centro aproximado do campus Facens (Sorocaba/SP). Ajuste se necessário.
export const FACENS_CENTER = { lat: -23.4697, lng: -47.4297 }
export const DEFAULT_ZOOM = 17

// Mapa. Padrão: vetorial (MapLibre + OpenFreeMap, sem chave), nítido e com estilo próprio (src/lib/mapStyle.ts).
// Com VITE_MAP_TILE_URL definida, usa tiles raster (ex.: MapTiler/Stadia com chave, ou OSM).
const env = import.meta.env
export const MAP_TILE_URL: string | undefined = env.VITE_MAP_TILE_URL || undefined
export const MAP_MODE: 'vector' | 'raster' = MAP_TILE_URL ? 'raster' : 'vector'
export const MAP_ATTRIBUTION: string =
  env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
export const MAP_MAX_ZOOM = Number(env.VITE_MAP_MAX_ZOOM || 19)
export const MAP_MIN_ZOOM = 15
/** Até onde dá para arrastar o mapa a partir do centro do campus (graus, ~450 m). */
export const MAP_BOUNDS_PAD = 0.004
/** Raster: 'dark' inverte as cores de tiles claros para o tema escuro; 'none' mantém o original. */
export const MAP_TILE_FILTER: 'dark' | 'none' = env.VITE_MAP_TILE_FILTER === 'none' ? 'none' : 'dark'

export const COURSES = [
  'Administração',
  'Análise e Desenv. de Sistemas',
  'Arquitetura e Urbanismo',
  'Ciência da Computação',
  'Engenharia Agronômica',
  'Engenharia Civil',
  'Engenharia da Computação',
  'Engenharia de Produção',
  'Engenharia de Software',
  'Engenharia Elétrica',
  'Engenharia Mecânica',
  'Engenharia Mecatrônica',
  'Engenharia Química',
  'Outro',
]
