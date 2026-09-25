import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from '../lib/api'
import { play, setSoundEnabled, soundEnabled } from '../lib/sfx'
import { useSession } from '../lib/session'
import type { FeedItem } from '../lib/types'
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

function Ticker() {
  const [items, setItems] = useState<FeedItem[]>([])
  useEffect(() => {
    let active = true
    const load = () =>
      api
        .feed()
        .then((f) => active && setItems(f))
        .catch(() => undefined)
    void load()
    const t = setInterval(load, 30000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [])

  const messages = items.length
    ? items.map((f) => `${f.display_name} descartou ${f.item_label}${f.bin_name ? ` em ${f.bin_name}` : ''} +${f.points} pts`)
    : ['Bem-vindo ao RankTrash', 'Descarte certo, ganhe pontos', 'Facens Lixo Zero']

  return (
    <div className="ticker" aria-label="Últimos descartes">
      <div className="ticker__track">
        {messages.map((m, i) => (
          <span key={i} className="ticker__item">
            {m}
          </span>
        ))}
      </div>
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
