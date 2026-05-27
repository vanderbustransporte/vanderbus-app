import { useState, useCallback, useEffect } from 'react'

const API = 'http://localhost:3001/api'
const H = { 'Content-Type': 'application/json' }

const ARRAY_TABLES = ['combustible', 'mantenimiento', 'contactos', 'nomina', 'ingresos', 'gastos', 'marketing', 'viajes']

const defaultData = {
  vehiculo: {
    marca: '', modelo: '', anio: '', patente: '', motor: '', chasis: '',
    kilometraje: '', combustible: 'Gasoil', vtv: '', seguro: '',
    aseguradora: '', poliza: '', habilitacion: '', capacidad: '', observaciones: ''
  },
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
let _listeners = []

function notify() {
  _listeners.forEach(fn => fn())
}

async function loadFromAPI() {
  try {
    const [vehiculo, ...arrays] = await Promise.all([
      fetch(`${API}/vehiculo`).then(r => r.json()),
      ...ARRAY_TABLES.map(t => fetch(`${API}/${t}`).then(r => r.json()))
    ])
    _data = {
      vehiculo: (vehiculo && Object.keys(vehiculo).length > 1) ? vehiculo : defaultData.vehiculo,
      ...Object.fromEntries(ARRAY_TABLES.map((t, i) => [t, arrays[i] || []]))
    }
    _error = null
  } catch {
    _error = 'No se pudo conectar al servidor en localhost:3001. Verificá que el backend esté corriendo.'
  } finally {
    _loading = false
    notify()
  }
}

function syncArray(table, oldArr, newArr) {
  const oldMap = new Map((oldArr || []).map(r => [r.id, r]))
  const newMap = new Map((newArr || []).map(r => [r.id, r]))

  for (const id of oldMap.keys()) {
    if (!newMap.has(id)) {
      fetch(`${API}/${table}/${id}`, { method: 'DELETE' }).catch(console.error)
    }
  }
  for (const [id, row] of newMap) {
    if (!oldMap.has(id)) {
      fetch(`${API}/${table}`, { method: 'POST', headers: H, body: JSON.stringify(row) }).catch(console.error)
    } else if (JSON.stringify(oldMap.get(id)) !== JSON.stringify(row)) {
      fetch(`${API}/${table}/${id}`, { method: 'PUT', headers: H, body: JSON.stringify(row) }).catch(console.error)
    }
  }
}

loadFromAPI()
setInterval(loadFromAPI, 30000)

export function useStore() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const fn = () => rerender(n => n + 1)
    _listeners.push(fn)
    return () => { _listeners = _listeners.filter(l => l !== fn) }
  }, [])

  const update = useCallback((key, value) => {
    const prev = _data[key]
    _data = { ..._data, [key]: value }
    notify()

    if (key === 'vehiculo') {
      fetch(`${API}/vehiculo`, { method: 'PUT', headers: H, body: JSON.stringify(value) }).catch(console.error)
    } else if (Array.isArray(value)) {
      syncArray(key, prev, value)
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
          const parsed = JSON.parse(e.target.result)
          const newData = { ...defaultData, ...parsed }

          await fetch(`${API}/vehiculo`, { method: 'PUT', headers: H, body: JSON.stringify(newData.vehiculo) })

          for (const table of ARRAY_TABLES) {
            const existing = await fetch(`${API}/${table}`).then(r => r.json())
            await Promise.all(existing.map(r => fetch(`${API}/${table}/${r.id}`, { method: 'DELETE' })))
            for (const row of (newData[table] || [])) {
              await fetch(`${API}/${table}`, { method: 'POST', headers: H, body: JSON.stringify(row) })
            }
          }

          _data = newData
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