import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../components/common/Toast.jsx'
import { clearStoredAuth, isSupabaseConfigured, supabase } from '../lib/supabase.js'
import useSessionTimeout, { INACTIVITY_TIMEOUT_MS } from '../hooks/useSessionTimeout.js'

const AuthContext = createContext(null)

const INACTIVE_MESSAGE = 'Usuário inativo. Contate o administrador.'
const INACTIVITY_MESSAGE = 'Sessão encerrada após 30 minutos de inatividade.'
const INVALID_SESSION_MESSAGE = 'Sua sessão expirou. Entre novamente para continuar.'

function hasSessionUser(session) {
  return Boolean(session && session.user)
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_active, is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const navigate = useNavigate()
  const toast = useToast()

  const hardSignOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut({ scope: 'local' })
      }
    } catch (err) {
      console.warn('[AuthContext] Falha ao encerrar sessão no Supabase:', err)
    } finally {
      clearStoredAuth()
      setSession(null)
      setProfile(null)
    }
  }, [])

  const validateSession = useCallback(async () => {
    if (!supabase) {
      await hardSignOut()
      return null
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !hasSessionUser(sessionData?.session)) {
      await hardSignOut()
      return null
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData?.user) {
      await hardSignOut()
      return null
    }

    setSession(sessionData.session)
    return sessionData.session
  }, [hardSignOut])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return undefined
    }

    let mounted = true

    validateSession()
      .catch((err) => {
        console.warn('[AuthContext] Falha ao validar a sessão:', err)
        return null
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession && newSession.user ? newSession : null)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [validateSession])

  useEffect(() => {
    if (!session?.user) {
      setProfile(null)
      return undefined
    }

    let active = true

    loadProfile(session.user.id)
      .then((data) => {
        if (!active) return
        if (data && data.is_active === false) {
          setProfile(null)
          hardSignOut()
          return
        }
        setProfile(data)
      })
      .catch(() => {
        if (active) setProfile(null)
      })

    return () => {
      active = false
    }
  }, [session, hardSignOut])

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const loadedProfile = await loadProfile(data.user.id)
    if (loadedProfile && loadedProfile.is_active === false) {
      await hardSignOut()
      throw new Error(INACTIVE_MESSAGE)
    }

    setSession(data.session ?? null)
    setProfile(loadedProfile ?? null)
    return data
  }, [hardSignOut])

  const signOut = useCallback(async () => {
    await hardSignOut()
  }, [hardSignOut])

  const handleInactivity = useCallback(async () => {
    await hardSignOut()
    toast.info(INACTIVITY_MESSAGE)
    navigate('/login', { replace: true })
  }, [hardSignOut, toast, navigate])

  useSessionTimeout({
    enabled: Boolean(session?.user),
    timeoutMs: INACTIVITY_TIMEOUT_MS,
    onTimeout: handleInactivity,
  })

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.is_admin === true,
      loading,
      signIn,
      signOut,
      validateSession,
      forceSignOut: hardSignOut,
      invalidSessionMessage: INVALID_SESSION_MESSAGE,
    }),
    [session, profile, loading, signIn, signOut, validateSession, hardSignOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  }
  return context
}
