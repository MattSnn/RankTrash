// Renderiza sprites em pixel art a partir de "mapas" de caracteres.
import { memo } from 'react'

export type Palette = Record<string, string>

interface PixelArtProps {
  rows: string[]
  palette: Palette
  size?: number | string
  className?: string
  title?: string
}

function toPaths(rows: string[]): Map<string, string> {
  const paths = new Map<string, string>()
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === '.' || ch === ' ') continue
      paths.set(ch, (paths.get(ch) ?? '') + `M${x} ${y}h1v1h-1z`)
    }
  })
  return paths
}

export const PixelArt = memo(function PixelArt({ rows, palette, size = 32, className, title }: PixelArtProps) {
  const w = Math.max(...rows.map((r) => r.length))
  const h = rows.length
  const paths = toPaths(rows)
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={typeof size === 'number' ? (size * h) / w : size}
      shapeRendering="crispEdges"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {[...paths.entries()].map(([ch, d]) => (
        <path key={ch} d={d} fill={palette[ch] ?? 'currentColor'} />
      ))}
    </svg>
  )
})

// Ícones monocromáticos 9x9 ("K" = currentColor)
export const ICONS = {
  bin: ['...KKK...', 'KKKKKKKKK', '.........', '.KKKKKKK.', '.K.K.K.K.', '.K.K.K.K.', '.K.K.K.K.', '.KKKKKKK.', '.........'],
  map: ['..KKKKK..', '.KKKKKKK.', 'KKK...KKK', 'KKK...KKK', '.KKKKKKK.', '..KKKKK..', '...KKK...', '....K....', '.........'],
  trophy: ['KKKKKKKKK', 'K.KKKKK.K', 'K.KKKKK.K', '.KKKKKKK.', '..KKKKK..', '...KKK...', '....K....', '...KKK...', '..KKKKK..'],
  user: ['...KKK...', '..KKKKK..', '..KKKKK..', '...KKK...', '.........', '.KKKKKKK.', 'KKKKKKKKK', 'KKKKKKKKK', 'KKKKKKKKK'],
  camera: ['.........', '...KKK...', 'KKKKKKKKK', 'KKK...KKK', 'KK.....KK', 'KK.....KK', 'KKK...KKK', 'KKKKKKKKK', '.........'],
  shield: ['KKKKKKKKK', 'KKKKKKKKK', 'KKKKKKK.K', 'KKKKKK.KK', 'K.KKK.KKK', 'KK.K.KKKK', '.KK.KKKK.', '..KKKKK..', '....K....'],
  soundOn: ['....K....', '...KK..K.', 'KKKKK...K', 'KKKKK.K.K', 'KKKKK.K.K', 'KKKKK...K', '...KK..K.', '....K....', '.........'],
  soundOff: ['....K....', '...KK....', 'KKKKK.K.K', 'KKKKK..K.', 'KKKKK..K.', 'KKKKK.K.K', '...KK....', '....K....', '.........'],
  flame: ['....K....', '...KK....', '...KKK.K.', '..KKKKKK.', '.KKK.KKKK', '.KK...KKK', '.KK...KK.', '..KK.KK..', '...KKK...'],
  star: ['....K....', '....K....', '...KKK...', 'KKKKKKKKK', '.KKKKKKK.', '..KKKKK..', '..KK.KK..', '.KK...KK.', '.K.....K.'],
  target: ['...KKK...', '.KK...KK.', '.K..K..K.', 'K..KKK..K', 'K.KK.KK.K', 'K..KKK..K', '.K..K..K.', '.KK...KK.', '...KKK...'],
  check: ['.........', '........K', '.......KK', '......KK.', 'K....KK..', 'KK..KK...', '.KKKK....', '..KK.....', '.........'],
  cross: ['.........', 'KK.....KK', '.KK...KK.', '..KK.KK..', '...KKK...', '..KK.KK..', '.KK...KK.', 'KK.....KK', '.........'],
  share: ['....K....', '...KKK...', '..K.K.K..', '....K....', 'KK..K..KK', 'K...K...K', 'K.......K', 'K.......K', 'KKKKKKKKK'],
  addBox: ['KKKKKKKKK', 'K.......K', 'K...K...K', 'K...K...K', 'K.KKKKK.K', 'K...K...K', 'K...K...K', 'K.......K', 'KKKKKKKKK'],
  dots: ['....K....', '....K....', '.........', '.........', '....K....', '....K....', '.........', '.........', '....K....'],
  more: ['.........', '.........', '.........', '.........', 'KK.KK.KK.', 'KK.KK.KK.', '.........', '.........', '.........'],
  phone: ['..KKKKK..', '..K...K..', '..K...K..', '..K...K..', '..K...K..', '..K...K..', '..K...K..', '..KK.KK..', '..KKKKK..'],
} satisfies Record<string, string[]>

export type IconName = keyof typeof ICONS

/** SVG em string (para usar em HTML fora do React, ex.: marcadores do Leaflet). */
export function iconSvg(name: IconName, size: number, color = 'currentColor'): string {
  const rows = ICONS[name]
  const d = [...toPaths(rows).values()].join('')
  return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="${color}"/></svg>`
}

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  return <PixelArt rows={ICONS[name]} palette={{}} size={size} className={className} />
}
