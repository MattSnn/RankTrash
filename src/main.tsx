import { StrictMode } from 'react'
import '@fontsource/press-start-2p'
import '@fontsource/vt323'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { SessionProvider } from './lib/session'
import './styles/theme.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
