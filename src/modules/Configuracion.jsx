import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Field, Input, BtnPrimary } from '../components/shared/Field'
import { formatARS } from '../utils/format'
import { calcularTarifa } from '../utils/tarifas'
import { Settings, Check } from 'lucide-react'

const CAMPOS = ['tarifa_sin_peon', 'tarifa_con_peon', 'minimo_horas', 'porcentaje_sena', 'alias_bancario']

// Extrae solo los campos que edita este formulario, con string vacío por defecto
function pick(s) {
  const out = {}
  for (const k of CAMPOS) out[k] = s?.[k] != null ? String(s[k]) : ''
  return out
}

export default function Configuracion() {
  const { data, updateSettings } = useStore()
  const { esOwner } = useAuth()
  const { addToast } = useToast()
  const orgSettings = data.orgSettings || {}

  const [form, setForm]   = useState(() => pick(orgSettings))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Re-sincronizar desde el store mientras el usuario no haya tocado nada
  useEffect(() => { if (!dirty) setForm(pick(orgSettings)) }, [orgSettings, dirty])

  if (!esOwner) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-sm px-1" style={{ color: 'var(--text-2)' }}>
          No tenés permisos para ver la configuración de la empresa.
        </p>
      </div>
    )
  }

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  const handleSave = async () => {
    setSaving(true)
    // '' → null: evita mandar cadena vacía a columnas numéricas (Postgres las rechaza)
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, typeof v === 'string' && v.trim() === '' ? null : v])
    )
    const { error } = await updateSettings(payload)
    setSaving(false)
    if (error) {
      addToast({ message: 'No se pudo guardar la configuración', Icon: Settings, color: 'var(--danger)' })
      return
    }
    setDirty(false)
    addToast({ message: 'Configuración guardada', Icon: Check, color: 'var(--positive)' })
  }

  // Preview del cálculo: 4 horas con peón
  const ejemplo = calcularTarifa(form, { horas: 4, conPeon: true })

  return (
    <div className="max-w-3xl mx-auto">

      {/* ── Header ── */}
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Settings size={18} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="mod-h1">Configuración</h1>
            <p className="mod-sub">Tarifas y datos de la empresa</p>
          </div>
        </div>
        <BtnPrimary onClick={handleSave} disabled={saving || !dirty} style={dirty && !saving ? undefined : { opacity: 0.55, cursor: 'default' }}>
          <Check size={15} /> {saving ? 'Guardando…' : 'Guardar'}
        </BtnPrimary>
      </div>

      {/* ── Tarifas de viajes ── */}
      <div className="surface db-in db-d1" style={{ padding: 24, marginBottom: 16 }}>
        <p className="db-slabel" style={{ marginBottom: 16 }}>Tarifas de viajes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tarifa sin peón ($/hora)">
            <Input type="number" step="0.01" min="0" value={form.tarifa_sin_peon} onChange={e => set('tarifa_sin_peon', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Tarifa con peón ($/hora)">
            <Input type="number" step="0.01" min="0" value={form.tarifa_con_peon} onChange={e => set('tarifa_con_peon', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Mínimo de horas">
            <Input type="number" step="0.5" min="0" value={form.minimo_horas} onChange={e => set('minimo_horas', e.target.value)} placeholder="Ej: 2" />
          </Field>
          <Field label="Porcentaje de seña (%)">
            <Input type="number" step="1" min="0" max="100" value={form.porcentaje_sena} onChange={e => set('porcentaje_sena', e.target.value)} placeholder="Ej: 30" />
          </Field>
        </div>

        {/* Preview del cálculo */}
        <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 'var(--radius)', background: 'var(--accent-dim)', border: '1px solid transparent' }}>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
            Ejemplo — <strong style={{ color: 'var(--text-1)' }}>4 h con peón</strong>: total{' '}
            <span className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatARS(ejemplo.total)}</span>{' '}
            · seña <span className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatARS(ejemplo.sena)}</span>
          </p>
        </div>
      </div>

      {/* ── Datos de cobro ── */}
      <div className="surface db-in db-d2" style={{ padding: 24 }}>
        <p className="db-slabel" style={{ marginBottom: 16 }}>Datos de cobro</p>
        <Field label="Alias bancario / CBU">
          <Input value={form.alias_bancario} onChange={e => set('alias_bancario', e.target.value)} placeholder="Ej: vanderbus.mp" />
        </Field>
      </div>
    </div>
  )
}
