import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) { setProfile(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cargar rol + permisos del perfil cuando hay sesion
  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('rol, permisos, organization_id, nombre')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) { setProfile(data); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [session])

  const rol = profile?.rol ?? null
  const permisos = profile?.permisos ?? {}
  const esOwner = rol === 'owner'

  // Helpers de permisos por seccion
  const puedeVer    = (mod) => esOwner || permisos[mod] === 'ver' || permisos[mod] === 'editar'
  const puedeEditar = (mod) => esOwner || permisos[mod] === 'editar'

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile, rol, permisos, esOwner,
        puedeVer, puedeEditar,
        loading, signIn, signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
