import React, { useState, useEffect } from 'react'
import { Building2, PlusCircle, Copy, Check, X, AlertTriangle, ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Field, Input } from '../components/shared/Field'
import { FEATURES, featureEfectiva } from '../utils/features'

const ACCENT = 'var(--accent)'

// Panel de plataforma (solo superadmin): lista de empresas con feature flags
// y alta de clientes nuevos (Edge Function provisionar-empresa).
// La autorización real está en el backend (la Edge Function revalida el flag
// superadmin con getUser(); las RPCs listar_empresas/set_org_features tienen
// guarda es_superadmin()); acá solo se decide si el módulo se muestra.

const ESTADO_STYLE = {
  activa:     { color: 'var(--positive)', bg: 'var(--positive-dim, var(--accent-dim))' },
  suspendida: { color: 'var(--warning)',  bg: 'var(--warning-dim)' },
  cancelada:  { color: 'var(--danger)',   bg: 'var(--danger-dim)' },
}

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

function PanelHeader({ icon: Icon, iconColor = ACCENT, iconBg = 'var(--accent-dim)', title, subtitle, children }) {
  return (
    <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: iconBg, border: '1px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 className="mod-h1">{title}</h1>
          <p className="mod-sub">{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function FeatureToggle({ feature, activo, saving, onToggle }) {
  const Icon = activo ? ToggleRight : ToggleLeft
  return (
    <button
      onClick={onToggle}
      disabled={saving}
      title={feature.descripcion}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)', background: 'var(--bg-elevated)',
        cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{feature.label}</span>
      <Icon size={22} style={{ color: activo ? 'var(--positive)' : 'var(--text-3)', flexShrink: 0 }} />
    </button>
  )
}

function EmpresaCard({ org, onSetFeatures }) {
  const [saving, setSaving] = useState(false)
  const estado = ESTADO_STYLE[org.estado_sub] ?? ESTADO_STYLE.cancelada
  const fecha = org.created_at ? new Date(org.created_at).toLocaleDateString('es-AR') : '—'

  const toggle = async (featureId) => {
    const nuevo = { ...(org.features ?? {}) }
    nuevo[featureId] = !featureEfectiva(org.features, featureId)
    setSaving(true)
    await onSetFeatures(org.id, nuevo)
    setSaving(false)
  }

  return (
    <div className="surface db-in db-d2" style={{ padding: 18, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: 'var(--accent-dim)', border: '1px solid transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Building2 size={16} style={{ color: ACCENT }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {org.nombre}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999,
              background: estado.bg, color: estado.color,
            }}>
              {org.estado_sub}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999,
              background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border)',
            }}>
              {org.plan}
            </span>
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {org.id} · alta {fecha}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FEATURES.map(f => (
          <FeatureToggle
            key={f.id}
            feature={f}
            activo={featureEfectiva(org.features, f.id)}
            saving={saving}
            onToggle={() => toggle(f.id)}
          />
        ))}
      </div>
    </div>
  )
}

const FORM_VACIO = { empresa: '', email: '', nombre: '', password: '' }

export default function Superadmin() {
  const [modo, setModo] = useState('lista') // 'lista' | 'alta'
  const [empresas, setEmpresas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [listaError, setListaError] = useState('')

  const [form, setForm] = useState(FORM_VACIO)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [resultado, setResultado] = useState(null)
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const cargarEmpresas = async () => {
    setCargando(true)
    setListaError('')
    const { data, error } = await supabase.rpc('listar_empresas')
    if (error) {
      // Hint típico: la migración 20260711120000 no está aplicada en la base.
      setListaError(error.message || 'No se pudo listar las empresas.')
      setEmpresas([])
    } else {
      setEmpresas(data ?? [])
    }
    setCargando(false)
  }

  useEffect(() => { cargarEmpresas() }, [])

  const handleSetFeatures = async (orgId, nuevo) => {
    const { data, error } = await supabase.rpc('set_org_features', { p_org: orgId, p_features: nuevo })
    if (error) {
      setListaError(error.message || 'No se pudieron guardar los flags.')
      return
    }
    setEmpresas(es => es.map(o => o.id === orgId ? { ...o, features: data } : o))
  }

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

  const volverALista = () => {
    setResultado(null)
    setModo('lista')
    setErrorMsg('')
    cargarEmpresas()
  }

  // ── Resultado del alta ──
  if (resultado) {
    return (
      <div className="max-w-3xl mx-auto">
        <PanelHeader
          icon={Check} iconColor="var(--positive)" iconBg="var(--positive-dim, var(--accent-dim))"
          title="Empresa creada" subtitle="Alta atómica completada — org activa en plan trial"
        />

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

        <div className="db-in db-d3" style={{ display: 'flex', gap: 8 }}>
          <button className="glass-btn-primary" onClick={volverALista}>
            <ArrowLeft size={15} /> Volver a empresas
          </button>
          <button
            onClick={() => setResultado(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              color: 'var(--text-2)', background: 'var(--bg-overlay)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <PlusCircle size={14} /> Provisionar otra
          </button>
        </div>
      </div>
    )
  }

  // ── Formulario de alta ──
  if (modo === 'alta') {
    return (
      <div className="max-w-3xl mx-auto">
        <PanelHeader icon={Building2} title="Alta de empresa" subtitle="Provisiona un cliente nuevo: organización + owner + configuración">
          <button
            onClick={volverALista}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
              borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              color: 'var(--text-2)', background: 'var(--bg-overlay)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}
          >
            <X size={14} /> Cancelar
          </button>
          <button className="glass-btn-primary" onClick={handleProvisionar} disabled={saving}>
            <PlusCircle size={15} /> {saving ? 'Provisionando…' : 'Provisionar'}
          </button>
        </PanelHeader>

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

  // ── Lista de empresas ──
  return (
    <div className="max-w-5xl mx-auto">
      <PanelHeader
        icon={Building2} title="Empresas"
        subtitle={cargando ? 'Cargando…' : `${empresas.length} ${empresas.length === 1 ? 'cliente' : 'clientes'} en la plataforma`}
      >
        <button className="glass-btn-primary" onClick={() => { setErrorMsg(''); setModo('alta') }}>
          <PlusCircle size={15} /> Nueva empresa
        </button>
      </PanelHeader>

      {listaError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'var(--danger-dim)', border: '1px solid var(--danger-dim)', color: 'var(--danger)' }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{listaError} <span style={{ opacity: 0.8 }}>(¿está aplicada la migración 20260711120000_features_por_org?)</span></span>
        </div>
      )}

      {cargando ? (
        <div className="text-sm px-1" style={{ color: 'var(--text-2)' }}>Cargando empresas…</div>
      ) : empresas.length === 0 && !listaError ? (
        <div className="surface db-in db-d4" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius)' }}>
          <Building2 size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-2)', fontSize: 14 }}>No hay empresas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresas.map(org => (
            <EmpresaCard key={org.id} org={org} onSetFeatures={handleSetFeatures} />
          ))}
        </div>
      )}
    </div>
  )
}
