import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { genId } from '../utils/format'

// Tablas que se manejan como arrays (vehiculo principal se deriva de la flota)
// `choferes` puede NO existir todavía (migración 20260718130000 sin aplicar):
// la carga la tolera como vacía y se la excluye de Realtime hasta que exista.
const ARRAY_TABLES = ['combustible', 'mantenimiento', 'contactos', 'nomina', 'ingresos', 'gastos', 'marketing', 'viajes', 'choferes']

// Ventana temporal: las tablas de movimientos cargan solo los ultimos N meses
// (created_at es TEXT 'YYYY-MM-DD HH:mm:ss', compara bien como string).
// contactos y vehiculos se cargan completos (son la agenda y la flota, no crecen
// por dia); el Dashboard agrega server-side via rpc dashboard_resumen(), y el
// export de Backup baja TODO fresco de la base, asi que nada depende de tener
// la historia completa en memoria.
const MESES_VENTANA = 24
const TABLAS_VENTANA = ['combustible', 'mantenimiento', 'nomina', 'ingresos', 'gastos', 'marketing', 'viajes']

function cutoffVentana() {
  const d = new Date()
  d.setMonth(d.getMonth() - MESES_VENTANA)
  return d.toISOString().slice(0, 10)
}

const emptyVehiculo = {
  marca: '', modelo: '', anio: '', patente: '', motor: '', chasis: '',
  kilometraje: '', combustible: 'Gasoil', vtv: '', seguro: '',
  aseguradora: '', poliza: '', habilitacion: '', capacidad: '', observaciones: ''
}

const defaultData = {
  vehiculo: emptyVehiculo,   // vehiculo "principal" (derivado de la flota) - retrocompat
  vehiculos: [],             // la flota completa
  combustible: [],
  mantenimiento: [],
  contactos: [],
  nomina: [],
  ingresos: [],
  gastos: [],
  marketing: [],
  viajes: [],
  choferes: [],
  orgSettings: {},           // configuracion de la empresa (org_settings, fila unica)
}

// Tablas que la carga detectó como inexistentes (42P01, migración sin aplicar):
// se tratan como vacías y NO se suscriben a Realtime — un binding a una tabla
// fuera de la publicación pone el canal entero en error y mata los eventos de
// las demás tablas.
let _tablasAusentes = new Set()

let _data = { ...defaultData }
let _loading = true
let _error = null
let _orgId = null
let _listeners = []
let _errorListeners = []

function notify() {
  _listeners.forEach(fn => fn())
}

// Canal de errores de guardado: la UI (App) se suscribe y muestra un toast.
function emitSaveError(msg) {
  _errorListeners.forEach(fn => fn(msg))
}

export function onStoreError(fn) {
  _errorListeners.push(fn)
  return () => { _errorListeners = _errorListeners.filter(f => f !== fn) }
}

// Lectura puntual del estado ACTUAL del store, para callbacks diferidos (ej. el
// "Deshacer" de un toast). Un closure de render captura el _data de ese momento;
// si entre el borrado y el deshacer hubo un refetch (Realtime/poll), pasarle ese
// array viejo a update() desharía cambios concurrentes de otras sesiones. El
// callback debe armar el array nuevo sobre getData(), no sobre su closure.
export function getData() {
  return _data
}

// Vehiculo "principal": el primer vehiculo activo de la flota (para el Dashboard)
function principal(flota) {
  return (flota || []).find(x => x.activo !== false) || (flota || [])[0] || emptyVehiculo
}

// Fecha-hora local en horario de Argentina
function localNow() {
  return new Date()
    .toLocaleString('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' })
    .replace('T', ' ')
}

// Resuelve (y cachea) la empresa del usuario logueado
async function ensureOrgId() {
  if (_orgId) return _orgId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle()
  _orgId = profile?.organization_id ?? null
  return _orgId
}

async function loadFromSupabase() {
  const orgId = await ensureOrgId()
  if (!orgId) {
    _loading = false
    notify()
    return
  }

  try {
    // flota
    const { data: flotaData } = await supabase
      .from('vehiculos')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })
    const flota = flotaData || []

    // arrays (combustible ascendente, el resto descendente)
    const cutoff = cutoffVentana()
    const arrays = await Promise.all(
      ARRAY_TABLES.map(t => {
        let q = supabase.from(t).select('*').eq('organization_id', orgId)
        if (t === 'mantenimiento') {
          // Ventana + filas viejas con vencimiento programado: las necesita
          // chequeoVencimientos aunque el registro tenga anios.
          q = q.or(`created_at.gte.${cutoff},proximo_fecha.not.is.null,proximo_km.not.is.null`)
        } else if (TABLAS_VENTANA.includes(t)) {
          q = q.gte('created_at', cutoff)
        }
        return q
          .order('created_at', { ascending: t === 'combustible' })
          .then(r => {
            if (r.error?.code === '42P01') _tablasAusentes.add(t)
            else _tablasAusentes.delete(t)
            return r.data || []
          })
      })
    )

    // configuracion de la empresa (fila unica en org_settings)
    const { data: settings } = await supabase
      .from('org_settings')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle()

    _data = {
      vehiculos: flota,
      vehiculo: principal(flota),
      ...Object.fromEntries(ARRAY_TABLES.map((t, i) => [t, arrays[i]])),
      orgSettings: settings || {},
    }
    _error = null
  } catch {
    _error = 'No se pudo conectar a la base de datos.'
  } finally {
    _loading = false
    notify()
  }
}

// Sincroniza un array contra Supabase: detecta altas, bajas y cambios.
// Lanza si Supabase rechaza alguna operación (RLS, columna inexistente, red, etc.)
// para que el llamador pueda revertir la UI optimista y avisar al usuario.
async function syncArray(table, oldArr, newArr) {
  const orgId = await ensureOrgId()
  if (!orgId) throw new Error('No hay sesión activa')

  const oldMap = new Map((oldArr || []).map(r => [r.id, r]))
  const newMap = new Map((newArr || []).map(r => [r.id, r]))

  // bajas
  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    }
  }

  // altas y cambios
  for (const [id, row] of newMap) {
    if (!oldMap.has(id)) {
      const fields = { ...row, organization_id: orgId }
      if (!fields.id) fields.id = genId()
      if (!fields.created_at) fields.created_at = localNow()
      const { error } = await supabase.from(table).insert(fields)
      if (error) throw error
    } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(row)) {
      const fields = { ...row }
      delete fields.created_at
      delete fields.organization_id
      const { error } = await supabase.from(table).update(fields).eq('id', id)
      if (error) throw error
    }
  }
}

// ── Realtime: reemplaza el poll ciego de 30s ──────────────────────────────────
// Suscripcion a cambios de las tablas de la org (INSERT/UPDATE filtrados por
// organization_id y ademas gateados por RLS en el server). Cualquier evento
// dispara un refetch debounced. Los DELETE llegan SIN filtro (el evento solo
// trae la PK, verificado empiricamente): tambien refrescan, con el costo menor
// de algun refetch de mas si otra org borra filas — RLS sigue guardando los datos.
let _channel = null
let _reloadTimer = null

function reloadDebounced() {
  clearTimeout(_reloadTimer)
  _reloadTimer = setTimeout(loadFromSupabase, 1500)
}

function suscribirRealtime(orgId) {
  if (_channel || !orgId) return
  let ch = supabase.channel(`org-data-${orgId}`)
  for (const t of ['vehiculos', ...ARRAY_TABLES.filter(t => !_tablasAusentes.has(t)), 'org_settings']) {
    ch = ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: t, filter: `organization_id=eq.${orgId}` },
      reloadDebounced
    )
  }
  _channel = ch.subscribe()
}

function desuscribirRealtime() {
  if (_channel) { supabase.removeChannel(_channel); _channel = null }
  clearTimeout(_reloadTimer)
}

// Cargar al haber sesion; limpiar al cerrar sesion
supabase.auth.onAuthStateChange((event) => {
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
    _orgId = null
    _loading = true
    loadFromSupabase().then(() => suscribirRealtime(_orgId))
  } else if (event === 'SIGNED_OUT') {
    desuscribirRealtime()
    _orgId = null
    _data = { ...defaultData }
    _loading = false
    notify()
  }
})

// Poll de RESPALDO (antes era el mecanismo principal, cada 30s): cubre deletes
// de otras sesiones y eventos Realtime perdidos por cortes de conexion.
setInterval(loadFromSupabase, 300000)

export function useStore() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    _listeners.push(fn)
    return () => { _listeners = _listeners.filter(l => l !== fn) }
  }, [])

  const update = useCallback((key, value) => {
    const prev = _data[key]

    // Si el guardado falla, avisar y re-sincronizar la UI con el estado REAL de
    // la base (loadFromSupabase no dispara el flash de "Cargando" porque no setea
    // _loading al inicio). Esto descarta el cambio optimista fallido sin pisar
    // ediciones concurrentes que sí se hayan guardado.
    const onError = (err) => {
      console.error('[save]', key, err)
      emitSaveError('No se pudieron guardar los cambios. Reintentá.')
      loadFromSupabase()
    }

    // La flota: ademas de guardar, re-deriva el vehiculo principal
    if (key === 'vehiculos') {
      _data = { ..._data, vehiculos: value, vehiculo: principal(value) }
      notify()
      syncArray('vehiculos', prev, value).catch(onError)
      return
    }

    _data = { ..._data, [key]: value }
    notify()

    if (Array.isArray(value)) {
      syncArray(key, prev, value).catch(onError)
    }
  }, [])

  // Configuracion de la empresa: merge optimista + upsert (fila unica por organization_id)
  const updateSettings = useCallback(async (patch) => {
    const orgId = await ensureOrgId()
    if (!orgId) return { error: new Error('No hay sesion activa') }

    const prev = _data.orgSettings || {}
    const merged = { ...prev, ...patch }
    _data = { ..._data, orgSettings: merged }
    notify()

    const { error } = await supabase
      .from('org_settings')
      .upsert({ ...merged, organization_id: orgId }, { onConflict: 'organization_id' })
    if (error) {
      // Revertir la UI optimista: el dato NO quedó guardado en la base
      console.error('[save] org_settings', error)
      _data = { ..._data, orgSettings: prev }
      notify()
    }
    return { error }
  }, [])

  // El store en memoria solo tiene la ventana de MESES_VENTANA: el backup baja
  // SIEMPRE la historia completa fresca de la base.
  const exportData = useCallback(async () => {
    const orgId = await ensureOrgId()
    if (!orgId) return

    const [{ data: flota }, ...resto] = await Promise.all([
      supabase.from('vehiculos').select('*').eq('organization_id', orgId).order('created_at', { ascending: true }),
      ...ARRAY_TABLES.map(t =>
        supabase.from(t).select('*').eq('organization_id', orgId).order('created_at', { ascending: t === 'combustible' })
      ),
    ])
    // 42P01 = tabla de una migración sin aplicar (ej. choferes): se exporta
    // vacía en vez de abortar el backup entero.
    if (resto.some(r => r.error && r.error.code !== '42P01')) {
      emitSaveError('No se pudo generar el backup completo. Reintentá.')
      return
    }

    const completo = {
      vehiculos: flota || [],
      vehiculo: principal(flota || []),
      ...Object.fromEntries(ARRAY_TABLES.map((t, i) => [t, resto[i].data || []])),
      orgSettings: _data.orgSettings || {},
    }

    const blob = new Blob([JSON.stringify(completo, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vanderbus_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Import transaccional: la RPC importar_backup reemplaza TODO el contenido
  // de la org en una sola transacción — si cualquier fila falla, no se toca
  // nada (antes eran delete+insert sueltos: un fallo a mitad perdía datos).
  const importData = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const orgId = await ensureOrgId()
          if (!orgId) throw new Error('No hay sesion activa')

          const parsed = JSON.parse(e.target.result)
          const payload = {}
          for (const t of ['vehiculos', ...ARRAY_TABLES]) {
            const rows = parsed[t] ?? []
            if (!Array.isArray(rows)) throw new Error(`"${t}" no es una lista de filas`)
            payload[t] = rows
          }

          const { data: resumen, error } = await supabase.rpc('importar_backup', { p_data: payload })
          if (error) throw error

          await loadFromSupabase()
          resolve(resumen)
        } catch (err) {
          reject(new Error('No se importó nada (los datos quedaron como estaban): ' + err.message))
        }
      }
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
      reader.readAsText(file)
    })
  }, [])

  return { data: _data, loading: _loading, error: _error, update, updateSettings, exportData, importData }
}
