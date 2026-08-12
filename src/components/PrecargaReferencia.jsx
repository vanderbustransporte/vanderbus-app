// Precarga de la ficha desde el catálogo de referencia GLOBAL
// (tabla `vehiculos_referencia`, ver utils/vehiculosRef.js y la migración
// 20260727120000). Es la RAMA "referencia" del paso 2 de Flota: el usuario elige
// marca → modelo → año → versión y prellena las specs del estimador, gratis y sin
// API. Sólo se monta cuando fuenteCatalogo() === 'referencia' (tabla aplicada y
// con datos); si no, ConsumoSpecs muestra el select plano de src/data/motores.js.
//
// ── Trazabilidad y verificación ──────────────────────────────────────────────
// El dato SIEMPRE se muestra y se prellena, esté verificado o no. `verificado`
// es una propiedad de la FILA de referencia (el doble check contra la ficha de la
// terminal), y al principio va a ser `false` en CASI TODAS las filas: por eso
// verificado=false es el estado NORMAL, no una excepción. Cuando es false, cada
// spec precargada lleva al lado un badge "sin verificar" (warning) BIEN visible,
// para que el usuario haga el doble check contra su propia ficha. Nunca se
// esconde un dato ni se lo pinta como confiable sin verificar.
//
// Sólo LECTURA: este componente no escribe la tabla de referencia. Lo que precarga
// va al form de la unidad (per-tenant, tabla `vehiculos`) y sigue 100% editable.

import React, { useState, useEffect } from 'react'
import { Field, Select } from './shared/Field'
import { CheckCircle, ShieldAlert, ExternalLink } from 'lucide-react'
import {
  listarMarcas, listarModelos, listarAnios, listarVersiones,
  obtenerFicha, specsDesdeReferencia, trazabilidad,
} from '../utils/vehiculosRef'
import { CLASES, CARROCERIAS, FUENTES_CONSUMO, COMBUSTIBLES_MOTOR } from '../data/clases'

// Etiqueta + formato de cada spec que puede venir precargada. El orden acá manda
// el orden de la lista de revisión. Enums se resuelven al label lindo; el resto
// se muestra crudo (así viven en el form: strings).
const enumLabel = (map, v) => (map[v]?.label) || v
const combLabel = v => (COMBUSTIBLES_MOTOR.find(c => c.id === v)?.label) || v

const SPEC_META = {
  motor_desc:          { label: 'Motorización',        fmt: v => v },
  clase:               { label: 'Clase',               fmt: v => enumLabel(CLASES, v) },
  motor_cilindrada_l:  { label: 'Cilindrada',          fmt: v => `${v} L` },
  motor_combustible:   { label: 'Combustible',         fmt: combLabel },
  consumo_urbano_l100: { label: 'Consumo urbano vacío', fmt: v => `${v} L/100km` },
  consumo_ruta_l100:   { label: 'Consumo ruta vacío',   fmt: v => `${v} L/100km` },
  consumo_mixto_l100:  { label: 'Consumo mixto',        fmt: v => `${v} L/100km` },
  fuente_consumo:      { label: 'Origen del consumo',   fmt: v => enumLabel(FUENTES_CONSUMO, v) },
  tara_kg:             { label: 'Tara (vacío)',         fmt: v => `${v} kg` },
  carga_max_kg:        { label: 'Carga útil máx.',      fmt: v => `${v} kg` },
  pbt_kg:              { label: 'PBT',                  fmt: v => `${v} kg` },
  carroceria:          { label: 'Carrocería',          fmt: v => enumLabel(CARROCERIAS, v) },
  tanque_l:            { label: 'Tanque',               fmt: v => `${v} L` },
}

// Badge de verificación. verificado=false es el estado NORMAL (recién sembrado,
// sin doble check): warning visible, no error. verificado=true: check verde.
function BadgeVerif({ verificado }) {
  const st = verificado
    ? { Icon: CheckCircle, color: 'var(--positive)', bg: 'var(--positive-dim)', txt: 'verificado' }
    : { Icon: ShieldAlert, color: 'var(--warning)',  bg: 'var(--warning-dim)',  txt: 'sin verificar' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0,
      padding: '2px 7px', borderRadius: 999, background: st.bg, color: st.color,
      fontSize: 10, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap',
    }}>
      <st.Icon size={11} /> {st.txt}
    </span>
  )
}

const RESET = { modelo: '', anio: '', version: '' }

export default function PrecargaReferencia({ fichaExt, onPrecargar }) {
  const [marcas, setMarcas]     = useState([])
  const [modelos, setModelos]   = useState([])
  const [anios, setAnios]       = useState([])
  const [versiones, setVersiones] = useState([])

  const [sel, setSel] = useState({ marca: '', modelo: '', anio: '', version: '' })
  const [ficha, setFicha] = useState(null)   // fila de referencia elegida (o null)
  const [traza, setTraza] = useState(null)   // trazabilidad(ficha)
  const [specs, setSpecs] = useState([])     // [[key, valorFormateado], …] lo que se prellenó

  // Marcas al montar.
  useEffect(() => { let vivo = true; listarMarcas().then(v => vivo && setMarcas(v)); return () => { vivo = false } }, [])

  const limpiarFicha = () => { setFicha(null); setTraza(null); setSpecs([]) }

  const elegirMarca = async (marca) => {
    setSel({ marca, ...RESET }); limpiarFicha()
    setModelos([]); setAnios([]); setVersiones([])
    if (marca) setModelos(await listarModelos(marca))
  }
  const elegirModelo = async (modelo) => {
    setSel(s => ({ ...s, modelo, anio: '', version: '' })); limpiarFicha()
    setAnios([]); setVersiones([])
    if (modelo) setAnios(await listarAnios(sel.marca, modelo))
  }
  const elegirAnio = async (anioStr) => {
    const anio = anioStr ? Number(anioStr) : ''
    setSel(s => ({ ...s, anio, version: '' })); limpiarFicha()
    setVersiones([])
    if (anio !== '') setVersiones(await listarVersiones(sel.marca, sel.modelo, anio))
  }
  const elegirVersion = async (version) => {
    setSel(s => ({ ...s, version }))
    if (!version) { limpiarFicha(); return }
    const row = await obtenerFicha({ marca: sel.marca, modelo: sel.modelo, anio: sel.anio, version })
    if (!row) { limpiarFicha(); return }
    const mapa = specsDesdeReferencia(row, { fichaExt })
    // Sólo las specs con valor real (specsDesdeReferencia devuelve '' para lo que
    // falta en la ficha): un dato ausente no se muestra ni pisa el form.
    const conValor = Object.entries(mapa).filter(([, v]) => v !== '' && v != null)
    setFicha(row)
    setTraza(trazabilidad(row))
    setSpecs(conValor.filter(([k]) => SPEC_META[k]).map(([k, v]) => [k, SPEC_META[k].fmt(v)]))
    onPrecargar(Object.fromEntries(conValor))
  }

  const verificado = traza?.verificado === true

  return (
    <div>
      <Field label="Buscar en el catálogo de referencia (prellena y queda editable)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={sel.marca} onChange={e => elegirMarca(e.target.value)}>
            <option value="">Marca…</option>
            {marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select value={sel.modelo} onChange={e => elegirModelo(e.target.value)} disabled={!sel.marca}>
            <option value="">Modelo…</option>
            {modelos.map(m => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Select value={sel.anio === '' ? '' : String(sel.anio)} onChange={e => elegirAnio(e.target.value)} disabled={!sel.modelo}>
            <option value="">Año…</option>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select value={sel.version} onChange={e => elegirVersion(e.target.value)} disabled={sel.anio === ''}>
            <option value="">Versión…</option>
            {versiones.map(v => <option key={v} value={v}>{v}</option>)}
          </Select>
        </div>
      </Field>

      {/* Panel de prellenado + trazabilidad. Se muestra al elegir una versión con
          ficha. Cada spec lleva su badge de verificación al lado: verificado=false
          (el caso normal al principio) = "sin verificar" visible, para forzar el
          doble check contra la ficha propia. */}
      {ficha && (
        <div className="surface" style={{ padding: 16, marginTop: 12, background: 'var(--bg-overlay)' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>
              {ficha.marca} {ficha.modelo} {ficha.anio} · {ficha.version}
            </span>
            <BadgeVerif verificado={verificado} />
          </div>

          <p style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
            {verificado
              ? <>Datos de referencia verificados contra la ficha ({traza?.verificadoPor || 'revisado'}). Aun así, confirmalos contra tu unidad antes de guardar.</>
              : <><strong style={{ color: 'var(--warning)' }}>Todavía sin verificar.</strong> Estos números salieron de la referencia global pero nadie los cotejó con la ficha oficial. Se prellenan igual para no arrancar de una pantalla en blanco: revisá cada uno contra la ficha de <strong style={{ color: 'var(--text-1)' }}>tu</strong> vehículo antes de darlos por buenos.</>}
          </p>

          {specs.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
              {specs.map(([k, valor]) => (
                <div key={k} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{SPEC_META[k].label}</div>
                    <div className="num" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valor}</div>
                  </div>
                  <BadgeVerif verificado={verificado} />
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 11.5, color: 'var(--text-3)' }}>La ficha de referencia no trae specs cargadas para completar. Cargalas a mano abajo.</p>
          )}

          {/* Origen del documento (distinto de fuente_consumo). Sólo si hay algo. */}
          {(traza?.fuente || traza?.pagina || traza?.extraidoPor === 'ia' || traza?.notas) && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {traza.fuente && <div>Fuente: <span style={{ color: 'var(--text-1)' }}>{traza.fuente}</span>{traza.pagina ? ` · pág. ${traza.pagina}` : ''}
                {traza.fuenteUrl && <> · <a href={traza.fuenteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>ver <ExternalLink size={11} /></a></>}
              </div>}
              {traza.extraidoPor === 'ia' && <div style={{ color: 'var(--warning)' }}>Extraído por IA de la ficha — revisión humana recomendada.</div>}
              {traza.notas && <div style={{ color: 'var(--text-3)' }}>{traza.notas}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
