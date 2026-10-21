// Entrada da landing page (sobre.ranktrash.eco.br). Sem service worker nem manifest: o PWA é só o app.
import { StrictMode } from 'react'
import '@fontsource/press-start-2p'
import '@fontsource/vt323'
import { createRoot } from 'react-dom/client'
import '../styles/theme.css'
import './landing.css'
import { Landing } from './Landing'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
