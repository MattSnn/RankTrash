import { Navigate, Route, Routes } from 'react-router-dom'
import { InstallGate } from './components/InstallPrompt'
import { Layout, LoadingBar } from './components/Layout'
import { useSession } from './lib/session'
import { Admin } from './pages/Admin'
import { ExternalLogin } from './pages/ExternalLogin'
import { Legal } from './pages/Legal'
import { Login } from './pages/Login'
import { MapPage } from './pages/MapPage'
import { Onboarding } from './pages/Onboarding'
import { Profile } from './pages/Profile'
import { Ranking } from './pages/Ranking'
import { Register } from './pages/Register'
import { Rules } from './pages/Rules'

export function App() {
  // telas públicas, sem login e sem o aviso de instalar (abertas no navegador)
  const path = window.location.pathname
  if (path === '/entrar') return <ExternalLogin />
  if (path === '/privacidade' || path === '/termos') return <Legal />
  return (
    <>
      <InstallGate />
      <Screens />
    </>
  )
}

function Screens() {
  const { loading, email, profile } = useSession()

  if (loading) return <LoadingBar label="INICIANDO TRACKER" />
  if (!email) return <Login />
  if (!profile) return <LoadingBar label="CARREGANDO PERFIL" />
  if (!profile.consent_at) return <Onboarding />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/registrar" element={<Register />} />
        <Route path="/ranking" element={<Ranking />} />
        <Route path="/perfil" element={<Profile />} />
        <Route path="/sobre" element={<Rules />} />
        <Route path="/admin" element={profile.role === 'admin' ? <Admin /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
