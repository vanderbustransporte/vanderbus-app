import React, { useState } from 'react'
import { Building2, PlusCircle, Copy, Check, X, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Field, Input } from '../components/shared/Field'

const ACCENT = 'var(--accent)'

// Panel de plataforma (solo superadmin): UI para la Edge Function
// provisionar-empresa. El alta crea auth.user del owner + organizations +
// profiles + org_settings en una transacción; la org nace activa en plan trial.
// La autorización real la hace la función (getUser + app_metadata.superadmin);
// acá solo se decide si el módulo se muestra.

function CopiarBtn({ texto }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1600)
    } catch { /* clipboard denegado: el valor queda visible para copiar a mano */ }
  }
  return (
    <button
      onClick={copiar}
      title="Copiar"
      style={{
        padding: '4px 8px', borderRadius: 'var(--radius-sm)', flexShrink: 0,
        border: '1px solid var(--border)', background: 'var(--bg-elevated)',
        color: copiado ? 'var(--positive)' : 'var(--text-2)', cursor: 'pointer',
      }}
    >
      {copiado ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function ResultRow({ label, value, copiable = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', width: 110, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {value}
      </span>
      {copiable && <CopiarBtn texto={value} />}
    </div>
  )
}

const FORM_VACIO = { empresa: '', email: '', nombre: '', password: '' }

export default function Superadmin() {
  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resultado, setResultado] = useState(null)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleProvisionar = async () => {
    if (!form.empresa.trim() || !form.email.trim()) {
      setErrorMsg('Empresa y email del owner son requeridos.')
      return
    }
    setSaving(true)
    setErrorMsg('')
    const body = { empresa: form.empresa.trim(), email: form.email.trim(), nombre: form.nombre.trim() }
    if (form.password) body.password = form.password
    const { data, error } = await supabase.functions.invoke('provisionar-empresa', { body })
    setSaving(false)
    if (error || data?.error) {
      // Con status no-2xx supabase-js deja el body en error.context (Response).
      let msg = data?.error || error?.message || 'Error al provisionar la empresa.'
      if (error?.context) {
        try { msg = (await error.context.json()).error ?? msg } catch { /* body no-JSON */ }
      }
      setErrorMsg(msg)
      return
    }
    setResultado({ ...data, passwordPropia: !!form.password })
    setForm(FORM_VACIO)
  }

  // ── Resultado del alta ──
  if (resultado) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--positive-dim, var(--accent-dim))', border: '1px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Check size={18} style={{ color: 'var(--positive)' }} />
          </div>
          <div>
            <h1 className="mod-h1">Empresa creada</h1>
            <p className="mod-sub">Alta atómica completada — org activa en plan trial</p>
          </div>
        </div>

        <div className="surface db-in db-d1" style={{ padding: 24, marginBottom: 16 }}>
          <ResultRow label="Organización" value={resultado.organization_id} />
          <ResultRow label="Owner (user)" value={resultado.user_id} />
          <ResultRow label="Email" value={resultado.email} />
          {resultado.password
            ? <ResultRow label="Contraseña" value={resultado.password} />
            : <ResultRow label="Contraseña" value="(la que ingresaste en el formulario)" copiable={false} />}
        </div>

        {resultado.password && (
          <div
            className="db-in db-d2 flex items-start gap-2"
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)', color: 'var(--warning)', fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span><strong>Esta contraseña no se vuelve a mostrar.</strong> Copiala y entregásela al cliente por un canal seguro.</span>
          </div>
        )}

        <button className="glass-btn-primary db-in db-d3" onClick={() => setResultado(null)}>
          <PlusCircle size={15} /> Provisionar otra empresa
        </button>
      </div>
    )
  }

  // ── Formulario de alta ──
  return (
    <div className="max-w-3xl mx-auto">
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--accent-dim)', border: '1px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Building2 size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Alta de empresa</h1>
            <p className="mod-sub">Provisiona un cliente nuevo: organización + owner + configuración</p>
          </div>
        </div>
        <button className="glass-btn-primary" onClick={handleProvisionar} disabled={saving}>
          <PlusCircle size={15} /> {saving ? 'Provisionando…' : 'Provisionar'}
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', color: 'var(--danger)' }}>
          <X size={15} style={{ flexShrink: 0 }} /> {errorMsg}
        </div>
      )}

      <div className="surface db-in db-d1" style={{ padding: 24, marginBottom: 16 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field label="Nombre de la empresa" required>
              <Input value={form.empresa} onChange={e => setF('empresa', e.target.value)} placeholder="Ej: Transportes del Sur SRL" />
            </Field>
          </div>
          <Field label="Email del owner" required>
            <Input type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="dueño@empresa.com" />
          </Field>
          <Field label="Nombre del owner">
            <Input value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Ej: Juan Pérez" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Contraseña inicial (opcional)">
              <Input value={form.password} onChange={e => setF('password', e.target.value)} placeholder="Vacío = se genera una segura y se muestra una sola vez" />
            </Field>
          </div>
        </div>
      </div>

      <div
        className="surface db-in db-d2"
        style={{ padding: '14px 16px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}
      >
        El alta es atómica: si algo falla no queda ningún usuario ni organización a medias.
        El owner entra sin mail de confirmación, con la empresa activa en plan trial,
        y puede crear su propio staff desde el módulo Usuarios.
      </div>
    </div>
  )
}
