import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { featureEfectiva } from '../utils/features'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [estadoSub, setEstadoSub] = useState(null)
  const [org, setOrg] = useState(null) // { nombre, features } de organizations
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) { setProfile(null); setEstadoSub(null); setOrg(null); setLoading(false) }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // Cargar rol + permisos del perfil y estado de suscripcion cuando hay sesion
  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    Promise.all([
      supabase
        .from('profiles')
        .select('rol, permisos, organization_id, nombre')
        .eq('id', session.user.id)
        .maybeSingle(),
      supabase.rpc('estado_suscripcion'),
      // Nombre y feature flags de la propia org (RLS solo devuelve la fila propia).
      supabase.from('organizations').select('nombre, features').maybeSingle(),
    ]).then(([{ data: prof }, { data: estado }, { data: orgRow }]) => {
      if (cancelled) return
      setProfile(prof)
      // Sin RPC (migracion sin aplicar) o sin org: no bloquear desde el
      // frontend — la barrera real es RLS via current_org_id().
      setEstadoSub(estado ?? 'activa')
      // Sin columna (migracion sin aplicar) o sin org: featureOn usa defaults.
      setOrg(orgRow ?? null)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [session])

  const rol = profile?.rol ?? null
  const permisos = profile?.permisos ?? {}
  const esOwner = rol === 'owner'
  // Flag de plataforma (no de la empresa): solo se setea con service_role/SQL.
  // Acá solo decide visibilidad de UI; la Edge Function re-valida contra la
  // base con getUser(), así que un claim viejo del JWT no escala permisos.
  const esSuperadmin = session?.user?.app_metadata?.superadmin === true

  // Helpers de permisos por seccion
  const puedeVer    = (mod) => esOwner || permisos[mod] === 'ver' || permisos[mod] === 'editar'
  const puedeEditar = (mod) => esOwner || permisos[mod] === 'editar'

  // Feature flag efectivo de la org (jsonb de organizations + defaults).
  // A diferencia de los permisos, un flag apagado oculta el modulo para
  // TODOS los usuarios de la org, incluido el owner.
  const featureOn = (id) => featureEfectiva(org?.features, id)

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile, rol, permisos, esOwner, esSuperadmin, estadoSub,
        orgNombre: org?.nombre ?? null,
        puedeVer, puedeEditar, featureOn,
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
