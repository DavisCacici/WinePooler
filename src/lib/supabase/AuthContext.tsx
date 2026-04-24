import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './client'
import { normalizeRole, type AppRole } from './auth'

interface AuthContextType {
  session: Session | null
  user: User | null
  role: AppRole | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AppRole | null>(null)
  const [loading, setLoading] = useState(true)

  const updateAuthState = (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null

    setSession(nextSession)
    setUser(nextUser)
    // Prefer native Supabase role; fallback to user_metadata for initial signup session
    setRole(normalizeRole(nextUser?.role) ?? normalizeRole(nextUser?.user_metadata?.role))
  }

  useEffect(() => {
    // Load persisted session from Supabase (stored in localStorage)
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthState(session)
      setLoading(false)
    })

    // Subscribe to auth state changes — handles token refresh and session expiry
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
