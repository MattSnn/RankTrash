// Centro aproximado do campus Facens (Sorocaba/SP). Ajuste se necessário.
export const FACENS_CENTER = { lat: -23.4697, lng: -47.4297 }
export const DEFAULT_ZOOM = 17

// Tiles do mapa. Padrão: OpenStreetMap (sem chave) escurecido por CSS.
// Para trocar (ex.: MapTiler/Stadia com chave), defina as variáveis na Vercel.
const env = import.meta.env
export const MAP_TILE_URL: string = env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const MAP_ATTRIBUTION: string =
  env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
export const MAP_MAX_ZOOM = Number(env.VITE_MAP_MAX_ZOOM || 19)
/** 'dark' inverte as cores de tiles claros para o tema escuro; 'none' mantém o original. */
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
