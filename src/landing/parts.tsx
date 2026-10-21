// Peças da landing page: moldura de celular, lixeira em pixel art e hooks de animação ao rolar.
import { useEffect, useRef, useState } from 'react'
import { PixelArt } from '../components/PixelArt'

export interface Shot {
  src: string
  alt: string
}

/** Moldura de "console" do app com as telas empilhadas; `index` escolhe a tela visível (troca com fade). */
export function Phone({ shots, index = 0, className = '', eager = false }: { shots: Shot[]; index?: number; className?: string; eager?: boolean }) {
  return (
    <div className={`phone ${className}`}>
      <span className="phone__speaker" aria-hidden />
      <div className="phone__screen">
        {shots.map((s, i) => (
          <img
            key={s.src}
            src={s.src}
            alt={i === index ? s.alt : ''}
            aria-hidden={i !== index}
            className={i === index ? 'is-on' : undefined}
            width={780}
            height={1688}
            loading={eager || i === 0 ? 'eager' : 'lazy'}
            decoding="async"
          />
        ))}
      </div>
    </div>
  )
}

const BIN = [
  '....KKKK....',
  '..KKKKKKKK..',
  '.KCCCCCCCCK.',
  'KKKKKKKKKKKK',
  '.KCCCCCCCCK.',
  '.KCWCCWCCWK.',
  '.KCWCCWCCWK.',
  '.KCWCCWCCWK.',
  '.KCWCCWCCWK.',
  '.KCCCCCCCCK.',
  '..KCCCCCCK..',
  '..KKKKKKKK..',
]

/** Lixeira em pixel art na cor do material (CONAMA 275). */
export function PixelBin({ color, size = 56 }: { color: string; size?: number }) {
  return <PixelArt rows={BIN} palette={{ K: '#0a0f1f', C: color, W: 'rgba(255,255,255,0.35)' }} size={size} />
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Elementos com `data-reveal` ganham a classe `is-in` quando entram na tela (uma vez). */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
      els.forEach((el) => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/** Índice do item que está no meio da tela (para o celular fixo do "como funciona"). */
export function useActiveIndex() {
  const refs = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index))
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    refs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])
  return { refs, active }
}

/** Troca automática de tela (para o celular do topo). Parada com "reduzir movimento". */
export function useCycle(length: number, ms: number) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = window.setInterval(() => setI((v) => (v + 1) % length), ms)
    return () => window.clearInterval(t)
  }, [length, ms])
  return i
}
