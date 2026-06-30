import React, { useState, useEffect } from 'react'
import { Users, UserPlus, Edit2, Save, X, RefreshCw, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Field, Input, Select } from '../components/shared/Field'
import { useAuth } from '../context/AuthContext'

const ACCENT = '#A78BFA'

const SECCIONES = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'viajes',        label: 'Viajes' },
  { id: 'combustible',   label: 'Combustible' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'vehiculo',      label: 'Vehículo' },
  { id: 'nomina',        label: 'Nómina' },
  { id: 'finanzas',      label: 'Finanzas' },
  { id: 'marketing',     label: 'Marketing' },
  { id: 'seguimiento',   label: 'Seguimiento GPS' },
]

const emptyPermisos = Object.fromEntries(SECCIONES.map(s => [s.id, 'ninguno']))

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function permisosSummary(permisos) {
  const editar = SECCIONES.filter(s => permisos?.[s.id] === 'editar').length
  const ver    = SECCIONES.filter(s => permisos?.[s.id] === 'ver').length
  if (editar === 0 && ver === 0) return 'Sin acceso'
  const parts = []
  if (editar) parts.push(`${editar} editar`)
  if (ver)    parts.push(`${ver} ver`)
  return parts.join(', ')
}

function PermisosGrid({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {SECCIONES.map(s => (
        <div
          key={s.id}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{s.label}</span>
          <Select
            value={value[s.id] ?? 'ninguno'}
            onChange={e => onChange({ ...value, [s.id]: e.target.value })}
            style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
          >
            <option value="ninguno">Ninguno</option>
            <option value="ver">Ver</option>
            <option value="editar">Editar</option>
          </Select>
        </div>
      ))}
    </div>
  )
}

function UsuarioCard({ u, currentUserId, onEdit }) {
  const isMe = u.id === currentUserId
  const summary = permisosSummary(u.permisos)
  return (
    <div className="surface db-in db-d2" style={{ padding: 18, borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 9,
          background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Users size={16} style={{ color: ACCENT }} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {u.nombre || '(sin nombre)'}
          </div>
          <div style={{ marginTop: 3 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 9999,
              background: u.rol === 'owner' ? `${ACCENT}1A` : 'var(--bg-elevated)',
              color: u.rol === 'owner' ? ACCENT : 'var(--text-2)',
              border: `1px solid ${u.rol === 'owner' ? ACCENT + '33' : 'var(--border)'}`,
            }}>
              {u.rol === 'owner' ? 'Owner' : 'Staff'}
            </span>
          </div>
        </div>
        {isMe && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 9999,
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: '1px solid var(--accent-dim)', flexShrink: 0,
          }}>
            Tú
          </span>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
        Acceso: <span style={{ color: 'var(--text-1)', fontWeight: 500 }}>{summary}</span>
      </div>

      {!isMe && (
        <button
          onClick={() => onEdit(u)}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 'var(--radius)',
            border: `1px solid ${ACCENT}33`, color: ACCENT, background: `${ACCENT}14`,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Edit2 size={13} /> Editar permisos
        </button>
      )}
    </div>
  )
}

function FormHeader({ icon: Icon, title, subtitle, onCancel, onSave, saving, saveLabel }) {
  return (
    <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} style={{ color: ACCENT }} />
        </div>
        <div>
          <h1 className="mod-h1">{title}</h1>
          <p className="mod-sub">{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
            borderRadius: 'var(--radius)', border: '1px solid var(--border)',
            color: 'var(--text-2)', background: 'var(--bg-overlay)',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <X size={14} /> Cancelar
        </button>
        <button
          className="glass-btn-primary"
          style={{ background: `${ACCENT}18`, boxShadow: `0 4px 15px ${ACCENT}22` }}
          onClick={onSave}
          disabled={saving}
        >
          <Save size={15} /> {saving ? 'Guardando…' : saveLabel}
        </button>
      </div>
    </div>
  )
}

export default function Usuarios() {
  const { user } = useAuth()
  const [usuarios, setUsuarios]   = useState([])
  const [cargando, setCargando]   = useState(true)
  const [modo, setModo]           = useState('lista') // 'lista' | 'nuevo' | 'editar'
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [errorMsg, setErrorMsg]   = useState('')

  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'staff', permisos: { ...emptyPermisos } })
  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const [editForm, setEditForm] = useState({ rol: 'staff', permisos: { ...emptyPermisos } })

  const cargarUsuarios = async () => {
    setCargando(true)
    const { data } = await supabase.from('profiles').select('id, nombre, rol, permisos')
    setUsuarios(data ?? [])
    setCargando(false)
  }

  useEffect(() => { cargarUsuarios() }, [])

  const handleNuevo = () => {
    setForm({ nombre: '', email: '', password: '', rol: 'staff', permisos: { ...emptyPermisos } })
    setErrorMsg('')
    setModo('nuevo')
  }

  const handleEditar = (u) => {
    setEditTarget(u)
    setEditForm({ rol: u.rol, permisos: { ...emptyPermisos, ...(u.permisos ?? {}) } })
    setErrorMsg('')
    setModo('editar')
  }

  const handleCancelar = () => { setModo('lista'); setErrorMsg('') }

  const handleCrear = async () => {
    if (!form.nombre || !form.email || !form.password) {
      setErrorMsg('Nombre, email y contraseña son requeridos.')
      return
    }
    setSaving(true)
    setErrorMsg('')
    const { data, error } = await supabase.functions.invoke('Crear-Usuario', {
      body: { email: form.email, password: form.password, nombre: form.nombre, rol: form.rol, permisos: form.permisos },
    })
    setSaving(false)
    if (error || data?.error) {
      setErrorMsg(data?.error || error?.message || 'Error al crear el usuario.')
      return
    }
    await cargarUsuarios()
    setModo('lista')
  }

  const handleGuardarEdicion = async () => {
    if (!editTarget) return
    setSaving(true)
    setErrorMsg('')
    const { error } = await supabase
      .from('profiles')
      .update({ rol: editForm.rol, permisos: editForm.permisos })
      .eq('id', editTarget.id)
    setSaving(false)
    if (error) {
      setErrorMsg(error.message || 'Error al guardar.')
      return
    }
    await cargarUsuarios()
    setModo('lista')
  }

  // ── Formulario: Nuevo usuario ──
  if (modo === 'nuevo') {
    return (
      <div className="max-w-3xl mx-auto">
        <FormHeader
          icon={UserPlus} title="Nuevo usuario" subtitle="Crear cuenta y asignar accesos"
          onCancel={handleCancelar} onSave={handleCrear} saving={saving} saveLabel="Crear usuario"
        />

        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--danger)' }}>
            {errorMsg}
          </div>
        )}

        <div className="surface db-in db-d4" style={{ padding: 24, marginBottom: 16 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Nombre completo" required>
                <Input value={form.nombre} onChange={e => setF('nombre', e.target.value)} placeholder="Ej: Juan Pérez" />
              </Field>
            </div>
            <Field label="Email" required>
              <Input type="email" value={form.email} onChange={e => setF('email', e.target.value)} placeholder="usuario@empresa.com" />
            </Field>
            <Field label="Contraseña" required>
              <div style={{ display: 'flex', gap: 6 }}>
                <Input value={form.password} onChange={e => setF('password', e.target.value)} placeholder="Contraseña" style={{ flex: 1 }} />
                <button
                  onClick={() => setF('password', genPassword())}
                  title="Generar contraseña aleatoria"
                  style={{
                    padding: '0 12px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                    color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0,
                    transition: 'border-color 150ms, color 150ms',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)' }}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </Field>
            <Field label="Rol">
              <Select value={form.rol} onChange={e => setF('rol', e.target.value)}>
                <option value="owner">Owner</option>
                <option value="staff">Staff</option>
              </Select>
            </Field>
          </div>
        </div>

        <div className="surface db-in db-d4" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldCheck size={15} style={{ color: ACCENT }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Permisos por sección</span>
          </div>
          <PermisosGrid value={form.permisos} onChange={v => setF('permisos', v)} />
        </div>
      </div>
    )
  }

  // ── Formulario: Editar permisos ──
  if (modo === 'editar') {
    return (
      <div className="max-w-3xl mx-auto">
        <FormHeader
          icon={Edit2} title={`Editar: ${editTarget?.nombre}`} subtitle="Rol y permisos de acceso"
          onCancel={handleCancelar} onSave={handleGuardarEdicion} saving={saving} saveLabel="Guardar"
        />

        {errorMsg && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'var(--danger-dim)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--danger)' }}>
            {errorMsg}
          </div>
        )}

        <div className="surface db-in db-d4" style={{ padding: 24, marginBottom: 16 }}>
          <Field label="Rol">
            <Select value={editForm.rol} onChange={e => setEditForm(f => ({ ...f, rol: e.target.value }))}>
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
            </Select>
          </Field>
        </div>

        <div className="surface db-in db-d4" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <ShieldCheck size={15} style={{ color: ACCENT }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>Permisos por sección</span>
          </div>
          <PermisosGrid value={editForm.permisos} onChange={v => setEditForm(f => ({ ...f, permisos: v }))} />
        </div>
      </div>
    )
  }

  // ── Lista ──
  return (
    <div className="max-w-5xl mx-auto">
      <div className="db-in db-d0" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `${ACCENT}18`, border: `1px solid ${ACCENT}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Users size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="mod-h1">Usuarios y permisos</h1>
            <p className="mod-sub">{usuarios.length} {usuarios.length === 1 ? 'usuario' : 'usuarios'} en la empresa</p>
          </div>
        </div>
        <button
          className="glass-btn-primary"
          style={{ background: `${ACCENT}18`, boxShadow: `0 4px 15px ${ACCENT}22` }}
          onClick={handleNuevo}
        >
          <UserPlus size={15} /> Agregar usuario
        </button>
      </div>

      {cargando ? (
        <div className="text-sm px-1" style={{ color: 'var(--text-2)' }}>Cargando usuarios…</div>
      ) : usuarios.length === 0 ? (
        <div className="surface db-in db-d4" style={{ padding: 48, textAlign: 'center', borderRadius: 'var(--radius)' }}>
          <Users size={32} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 16 }}>No hay usuarios cargados.</p>
          <button
            className="glass-btn-primary"
            style={{ background: `${ACCENT}18`, boxShadow: `0 4px 15px ${ACCENT}22` }}
            onClick={handleNuevo}
          >
            <UserPlus size={15} /> Agregar el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {usuarios.map(u => (
            <UsuarioCard key={u.id} u={u} currentUserId={user?.id} onEdit={handleEditar} />
          ))}
        </div>
      )}
    </div>
  )
}
