import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import { AccountGoneError, type Profile } from './types'

/** Aviso para a tela de login (ex.: conta removida), lido uma vez. */
export const LOGIN_NOTICE_KEY = 'ranktrash:login-notice'

interface SessionValue {
  loading: boolean
  email: string | null
  profile: Profile | null
  /** falha ao carregar o perfil (ex.: sem internet); a tela oferece tentar de novo */
  profileError: string | null
  refreshProfile: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    setProfileError(null)
    try {
      setProfile(await api.getProfile())
    } catch (e) {
      setProfile(null)
      if (e instanceof AccountGoneError) {
        try {
          sessionStorage.setItem(LOGIN_NOTICE_KEY, e.message)
        } catch {
          /* sem storage: só sai */
        }
        await api.signOut() // volta ao login
      } else {
        setProfileError((e as Error).message || 'Não foi possível carregar seu perfil.')
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    const load = async (e: string | null) => {
      if (!active) return
      setEmail(e)
      if (e) await refreshProfile()
      else setProfile(null)
      if (active) setLoading(false)
    }
    void api.getSessionEmail().then(load)
    const unsubscribe = api.onAuthChange((e) => void load(e))
    return () => {
      active = false
      unsubscribe()
    }
  }, [refreshProfile])

  return <SessionContext.Provider value={{ loading, email, profile, profileError, refreshProfile }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession fora do SessionProvider')
  return value
}
