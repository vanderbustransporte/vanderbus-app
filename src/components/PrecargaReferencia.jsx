// Precarga de la ficha desde el catálogo de referencia GLOBAL
// (tabla `vehiculos_referencia`, ver utils/vehiculosRef.js y la migración
// 20260727120000). Es la RAMA "referencia" del paso 2 de Flota: el usuario
// escribe marca y modelo en UN buscador (datalist nativo) y prellena las specs
// del estimador, gratis y sin API. Sólo se monta cuando fuenteCatalogo() ===
// 'referencia' (tabla aplicada y con datos); si no, ConsumoSpecs muestra el
// buscador plano de src/data/motores.js.
//
// ── Por qué un buscador y no la cascada marca→modelo→año→versión ────────────
// (rediseño 2026-08-25) La cascada de 4 selects obligaba a 4 decisiones
// encadenadas — y en la práctica el año/versión exacto de la unidad del
// operario casi nunca coincide con la fila cargada. Con un buscador de texto
// libre + datalist, escribir "Renault Master" alcanza: el navegador filtra y
// muestra TODAS las versiones/años que hay cargados para ese modelo. El
// volumen del catálogo es chico (ver nota de vehiculosRef.js), así que se
// trae la tabla entera una vez y el filtrado es 100% client-side.
//
// ── "Año más cercano" (2026-08-25) ───────────────────────────────────────────
// Si el operario no quiere buscar el año exacto, el datalist también ofrece
// la etiqueta agregada "Marca Modelo — cualquier año" (sólo cuando hay más de
// una fila para esa marca+modelo). Elegirla resuelve sola contra la fila de
// año más cercano al que ya está cargado en el campo "Año" de la unidad
// (`vehiculoAnio`), o la más nueva si ese campo todavía está vacío —
// `filaMasCercana()` en utils/vehiculosRef.js documenta el criterio de
// desempate. Cuando el año usado no es EXACTO el que declaró la unidad, se
// avisa en una línea, mismo tono que el resto de la trazabilidad: se prellena
// igual (no bloquea nada) pero queda claro que hay que revisarlo.
//
// ── Desambiguación de versión (2026-09-02) ──────────────────────────────────
// El año resuelto puede tener MÁS DE UNA versión cargada, y son vehículos
// distintos (el Tector 2019 va de 9 a 11 toneladas según cuál). Antes se
// precargaba la primera que devolvía la base, sin avisar: specs equivocadas en
// silencio, que es el peor modo de falla para alguien que no puede detectarlo.
// Ahora, SÓLO en ese caso, se corta y se ofrecen las versiones para que elija —
// descriptas por tonelaje y carga útil (`descriptorFila`), no por el código de
// versión, que no le dice nada a un operario. Con una sola versión para ese año
// no hay ambigüedad y se precarga directo, igual que siempre: el paso extra
// aparece únicamente cuando hace falta.
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

import React, { useState, useEffect, useMemo } from 'react'
import { Field, Input } from './shared/Field'
import { CheckCircle, ShieldAlert, ExternalLink, TriangleAlert, ChevronRight } from 'lucide-react'
import {
  listarFichas, etiquetaFicha, specsDesdeReferencia, trazabilidad,
  agruparPorMarcaModelo, etiquetaAgregada, filaMasCercana,
  versionesDelAnio, descriptorFila,
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

export default function PrecargaReferencia({ fichaExt, vehiculoAnio, onPrecargar }) {
  const [fichas, setFichas] = useState([])  // catálogo completo (chico), traído una vez
  const [texto, setTexto]   = useState('')
  const [ficha, setFicha]   = useState(null)   // fila de referencia elegida (o null)
  const [traza, setTraza]   = useState(null)   // trazabilidad(ficha)
  const [specs, setSpecs]   = useState([])     // [[key, valorFormateado], …] lo que se prellenó
  // { objetivo, anioUsado } cuando la precarga vino de "año más cercano" y NO
  // fue exacta; null cuando no aplica (elección directa, o exacta igual).
  const [avisoAnio, setAvisoAnio] = useState(null)
  // { candidatas, exacto, objetivo } cuando el año resuelto tiene 2+ versiones
  // y hay que preguntar cuál; null el resto del tiempo.
  const [eleccionVersion, setEleccionVersion] = useState(null)

  // Catálogo completo al montar (una sola consulta: ver nota de vehiculosRef.js).
  useEffect(() => { let vivo = true; listarFichas().then(v => vivo && setFichas(v)); return () => { vivo = false } }, [])

  // Grupos marca+modelo con más de una fila: sólo ahí tiene sentido ofrecer
  // "cualquier año" (con una sola fila, la etiqueta completa ya alcanza).
  const grupos = useMemo(() => agruparPorMarcaModelo(fichas), [fichas])

  const limpiarFicha = () => { setFicha(null); setTraza(null); setSpecs([]); setAvisoAnio(null); setEleccionVersion(null) }

  const elegir = (row) => {
    const mapa = specsDesdeReferencia(row, { fichaExt })
    // Sólo las specs con valor real (specsDesdeReferencia devuelve '' para lo que
    // falta en la ficha): un dato ausente no se muestra ni pisa el form.
    const conValor = Object.entries(mapa).filter(([, v]) => v !== '' && v != null)
    setFicha(row)
    setTraza(trazabilidad(row))
    setSpecs(conValor.filter(([k]) => SPEC_META[k]).map(([k, v]) => [k, SPEC_META[k].fmt(v)]))
    onPrecargar(Object.fromEntries(conValor))
  }

  // El datalist dispara onChange con el texto EXACTO de la opción elegida (y
  // también con cualquier texto que el usuario tipee a mano). Dos formas de
  // matchear: la etiqueta completa de una fila (precarga directa, sin aviso) o
  // la etiqueta agregada "Marca Modelo — cualquier año" (resuelve por año más
  // cercano). Mientras se está tipeando ninguna de las dos matchea todavía y
  // no pasa nada, ni se limpia lo ya elegido a mitad de edición.
  const onChange = (e) => {
    const v = e.target.value
    setTexto(v)
    if (!v) { limpiarFicha(); return }

    const filaExacta = fichas.find(r => etiquetaFicha(r) === v)
    if (filaExacta) { setAvisoAnio(null); setEleccionVersion(null); elegir(filaExacta); return }

    const grupo = grupos.find(g => etiquetaAgregada(g[0]) === v)
    if (grupo) {
      const { fila, exacto } = filaMasCercana(grupo, vehiculoAnio)
      const candidatas = versionesDelAnio(grupo, fila.anio)
      if (candidatas.length > 1) {
        // Ambigüedad real: ese año tiene varias versiones y son vehículos
        // distintos. No se precarga NADA todavía — se pregunta.
        limpiarFicha()
        setEleccionVersion({ candidatas, exacto, objetivo: vehiculoAnio || null })
        return
      }
      aplicarFila(fila, exacto)
    }
  }

  // Aplica una fila ya desambiguada: precarga, deja el input mostrando la
  // etiqueta completa de lo que REALMENTE se aplicó (no se queda en "cualquier
  // año", que ya cumplió su propósito) y avisa si el año no fue el exacto.
  const aplicarFila = (fila, exacto) => {
    setTexto(etiquetaFicha(fila))
    setAvisoAnio(exacto ? null : { objetivo: vehiculoAnio || null, anioUsado: fila.anio })
    setEleccionVersion(null)
    elegir(fila)
  }

  const verificado = traza?.verificado === true

  return (
    <div>
      <Field label="Buscá la unidad (marca y modelo alcanza) — prellena y queda editable">
        <Input
          list="catalogo-referencia"
          value={texto}
          onChange={onChange}
          placeholder="Ej: Renault Master, Scania R450…"
        />
        <datalist id="catalogo-referencia">
          {fichas.map(r => <option key={r.id} value={etiquetaFicha(r)} />)}
          {grupos.map(g => <option key={etiquetaAgregada(g[0])} value={etiquetaAgregada(g[0])} />)}
        </datalist>
      </Field>

      {/* Elegir versión: aparece SÓLO cuando el año resuelto tiene 2+ versiones
          cargadas. Hasta que el usuario pique una no se precarga nada — es
          justamente el caso en que adivinar sale caro y en silencio. Cada opción
          se describe por tonelaje / carga útil, que es como se reconoce una
          unidad en el playón, con el código de versión como dato secundario. */}
      {eleccionVersion && (
        <div className="surface" style={{ padding: 14, marginTop: 12, background: 'var(--bg-overlay)', border: '1px solid var(--warning)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
            <TriangleAlert size={13} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
              {eleccionVersion.exacto
                ? <>El catálogo tiene <strong style={{ color: 'var(--text-1)' }}>{eleccionVersion.candidatas.length} versiones</strong> del {eleccionVersion.candidatas[0].anio}, y no son el mismo camión. <strong style={{ color: 'var(--text-1)' }}>Elegí la tuya</strong> para prellenar los datos correctos.</>
                : <>Tu unidad es del <strong style={{ color: 'var(--text-1)' }}>{eleccionVersion.objetivo || '—'}</strong> y el catálogo no tiene ese año. Lo más parecido es el <strong style={{ color: 'var(--text-1)' }}>{eleccionVersion.candidatas[0].anio}</strong>, que viene en <strong style={{ color: 'var(--text-1)' }}>{eleccionVersion.candidatas.length} versiones</strong> distintas. <strong style={{ color: 'var(--text-1)' }}>Elegí la que se parezca a la tuya</strong> y revisá los datos después.</>}
            </span>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {eleccionVersion.candidatas.map(c => {
              const desc = descriptorFila(c)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => aplicarFila(c, eleccionVersion.exacto)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '9px 11px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)' }}>
                      {desc || c.version}
                    </span>
                    <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {desc ? c.version : 'sin datos de peso en el catálogo'}
                    </span>
                  </span>
                  <ChevronRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Aviso de año aproximado: sólo cuando la precarga vino de "cualquier
          año" y NO coincidió exacto. No bloquea nada — el form queda editable
          igual que cualquier otra precarga — pero avisa en lenguaje llano. */}
      {avisoAnio && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: '9px 11px', borderRadius: 'var(--radius-sm)', background: 'var(--warning-dim)' }}>
          <TriangleAlert size={13} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
            {avisoAnio.objetivo
              ? <>Tu unidad es del <strong style={{ color: 'var(--text-1)' }}>{avisoAnio.objetivo}</strong> y el catálogo no tiene esa versión. Usamos los datos de la versión <strong style={{ color: 'var(--text-1)' }}>{avisoAnio.anioUsado}</strong> (la más parecida disponible) — revisá que coincida con tu unidad.</>
              : <>Todavía no cargaste el año de la unidad arriba, así que usamos la versión más nueva del catálogo: <strong style={{ color: 'var(--text-1)' }}>{avisoAnio.anioUsado}</strong>. Revisá que coincida con tu unidad.</>}
          </span>
        </div>
      )}

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
