import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Profile } from './types'

interface SessionValue {
  loading: boolean
  email: string | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await api.getProfile())
    } catch {
      setProfile(null)
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

  return <SessionContext.Provider value={{ loading, email, profile, refreshProfile }}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession fora do SessionProvider')
  return value
}
