import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { genId } from '../utils/format'

// Tablas que se manejan como arrays (vehiculo principal se deriva de la flota)
const ARRAY_TABLES = ['combustible', 'mantenimiento', 'contactos', 'nomina', 'ingresos', 'gastos', 'marketing', 'viajes']

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
}

let _data = { ...defaultData }
let _loading = true
let _error = null
let _orgId = null
let _listeners = []

function notify() {
  _listeners.forEach(fn => fn())
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
    const arrays = await Promise.all(
      ARRAY_TABLES.map(t =>
        supabase
          .from(t)
          .select('*')
          .eq('organization_id', orgId)
          .order('created_at', { ascending: t === 'combustible' })
          .then(r => r.data || [])
      )
    )

    _data = {
      vehiculos: flota,
      vehiculo: principal(flota),
      ...Object.fromEntries(ARRAY_TABLES.map((t, i) => [t, arrays[i]]))
    }
    _error = null
  } catch {
    _error = 'No se pudo conectar a la base de datos.'
  } finally {
    _loading = false
    notify()
  }
}

// Sincroniza un array contra Supabase: detecta altas, bajas y cambios
async function syncArray(table, oldArr, newArr) {
  const orgId = await ensureOrgId()
  if (!orgId) return

  const oldMap = new Map((oldArr || []).map(r => [r.id, r]))
  const newMap = new Map((newArr || []).map(r => [r.id, r]))

  // bajas
  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      await supabase.from(table).delete().eq('id', id)
    }
  }

  // altas y cambios
  for (const [id, row] of newMap) {
    if (!oldMap.has(id)) {
      const fields = { ...row, organization_id: orgId }
      if (!fields.id) fields.id = genId()
      if (!fields.created_at) fields.created_at = localNow()
      await supabase.from(table).insert(fields)
    } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(row)) {
      const fields = { ...row }
      delete fields.created_at
      delete fields.organization_id
      await supabase.from(table).update(fields).eq('id', id)
    }
  }
}

// Cargar al haber sesion; limpiar al cerrar sesion
supabase.auth.onAuthStateChange((event) => {
  if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
    _orgId = null
    _loading = true
    loadFromSupabase()
  } else if (event === 'SIGNED_OUT') {
    _orgId = null
    _data = { ...defaultData }
    _loading = false
    notify()
  }
})

setInterval(loadFromSupabase, 30000)

export function useStore() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    _listeners.push(fn)
    return () => { _listeners = _listeners.filter(l => l !== fn) }
  }, [])

  const update = useCallback((key, value) => {
    const prev = _data[key]

    // La flota: ademas de guardar, re-deriva el vehiculo principal
    if (key === 'vehiculos') {
      _data = { ..._data, vehiculos: value, vehiculo: principal(value) }
      notify()
      syncArray('vehiculos', prev, value).catch(console.error)
      return
    }

    _data = { ..._data, [key]: value }
    notify()

    if (Array.isArray(value)) {
      syncArray(key, prev, value).catch(console.error)
    }
  }, [])

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify(_data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vanderbus_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const importData = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const orgId = await ensureOrgId()
          if (!orgId) throw new Error('No hay sesion activa')

          const parsed = JSON.parse(e.target.result)
          const newData = { ...defaultData, ...parsed }

          // flota
          if (Array.isArray(newData.vehiculos)) {
            await supabase.from('vehiculos').delete().eq('organization_id', orgId)
            const flota = newData.vehiculos.map(r => ({
              ...r,
              organization_id: orgId,
              id: r.id || crypto.randomUUID(),
              created_at: r.created_at || localNow(),
            }))
            if (flota.length) await supabase.from('vehiculos').insert(flota)
          }

          // arrays
          for (const table of ARRAY_TABLES) {
            await supabase.from(table).delete().eq('organization_id', orgId)
            const rows = (newData[table] || []).map(r => ({
              ...r,
              organization_id: orgId,
              id: r.id || genId(),
              created_at: r.created_at || localNow(),
            }))
            if (rows.length) await supabase.from(table).insert(rows)
          }

          _data = { ...newData, vehiculo: principal(newData.vehiculos) }
          notify()
          resolve()
        } catch (err) {
          reject(new Error('Error al importar: ' + err.message))
        }
      }
      reader.readAsText(file)
    })
  }, [])

  return { data: _data, loading: _loading, error: _error, update, exportData, importData }
}
