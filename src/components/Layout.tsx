import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../lib/api'
import { play, setSoundEnabled, soundEnabled } from '../lib/sfx'
import { useSession } from '../lib/session'
import { InstallBanner } from './InstallPrompt'
import { MascotEyes } from './Mascot'
import { Icon } from './PixelArt'

export function LoadingBar({ label = 'CARREGANDO' }: { label?: string }) {
  return (
    <div className="center-screen">
      <p className="title-font" style={{ fontSize: 10 }}>
        {label}
      </p>
      <div className="loading-bar">
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
    </div>
  )
}

const TICKER_SPEED = 60 // px/s, igual para qualquer tamanho de texto
const TICKER_FALLBACK = ['Bem-vindo ao RankTrash', 'Descarte certo, ganhe pontos', 'Facens Lixo Zero']

/** Letreiro: uma mensagem por vez, atravessando a caixa inteira. O feed novo só entra entre mensagens. */
function Ticker() {
  const box = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const messages = useRef<string[]>(TICKER_FALLBACK)
  const [turn, setTurn] = useState(0) // conta as passagens (reinicia a animação mesmo com 1 mensagem)

  useEffect(() => {
    let active = true
    const load = () =>
      api
        .feed()
        .then((f) => {
          if (!active || !f.length) return
          messages.current = f.map(
            (i) => `${i.display_name} descartou ${i.item_label}${i.bin_name ? ` em ${i.bin_name}` : ''} +${i.points} pts`,
          )
        })
        .catch(() => undefined)
    void load()
    const t = setInterval(load, 30000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  const list = messages.current
  const message = list[turn % list.length]

  useEffect(() => {
    const el = text.current
    const wrap = box.current
    if (!el || !wrap) return
    const next = () => setTurn((t) => t + 1)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(next, 5000)
      return () => clearTimeout(t)
    }
    const from = wrap.clientWidth
    const to = -el.offsetWidth
    const anim = el.animate([{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], {
      duration: ((from - to) / TICKER_SPEED) * 1000,
      easing: 'linear',
      fill: 'forwards',
    })
    anim.onfinish = next
    return () => anim.cancel()
  }, [turn])

  return (
    <div className="ticker" ref={box} aria-label="Últimos descartes">
      <span key={turn} ref={text} className="ticker__item">
        {message}
      </span>
    </div>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile } = useSession()
  const [sound, setSound] = useState(soundEnabled())

  const toggleSound = () => {
    setSoundEnabled(!sound)
    setSound(!sound)
    if (!sound) play('click')
  }

  return (
    <div className="app">
      {api.demo && <div className="demo-flag">MODO DEMO</div>}
      <header className="topbar">
        <NavLink to="/perfil" className="corner-btn left orange px-border" aria-label="Perfil">
          <Icon name="user" size={22} />
        </NavLink>
        <div className="plate">
          RANK <MascotEyes size={34} /> TRASH
        </div>
        <button className="corner-btn right px-border" onClick={toggleSound} aria-label={sound ? 'Desligar som' : 'Ligar som'}>
          <Icon name={sound ? 'soundOn' : 'soundOff'} size={22} />
        </button>
      </header>
      <div className="bezel">
        <main className="screen">{children}</main>
      </div>
      <InstallBanner />
      <Ticker />
      <nav className="nav">
        <NavLink to="/" end onClick={() => play('click')}>
          <Icon name="map" />
          MAPA
        </NavLink>
        <NavLink to="/ranking" onClick={() => play('click')}>
          <Icon name="trophy" />
          RANKING
        </NavLink>
        <NavLink to="/registrar" className="nav__main" onClick={() => play('click')}>
          <Icon name="camera" size={26} />
          DESCARTAR
        </NavLink>
        <NavLink to="/perfil" onClick={() => play('click')}>
          <Icon name="user" />
          PERFIL
        </NavLink>
        {profile?.role === 'admin' ? (
          <NavLink to="/admin" onClick={() => play('click')}>
            <Icon name="shield" />
            ADMIN
          </NavLink>
        ) : (
          <NavLink to="/sobre" onClick={() => play('click')}>
            <Icon name="star" />
            REGRAS
          </NavLink>
        )}
      </nav>
    </div>
  )
}
