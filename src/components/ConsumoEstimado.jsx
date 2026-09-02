// Panel de consumo estimado de un viaje. Se usa dentro del modal de Viajes y
// lee el form en vivo: al tipear los km o el peso, el número se recalcula.
//
// Dos reglas de esta pantalla:
//
//  1. El resultado es un RANGO, no un número puntual, y el rango va grande y
//     arriba. Si un transportista cotiza un flete con esto y le erra, la
//     diferencia la pone él: la incertidumbre no puede estar escondida en un
//     tooltip.
//  2. Nunca mostrar el estimado solo. Siempre al lado va de dónde salió (ficha
//     del fabricante, benchmark, historial real) y qué se dio por sentado.
//
// (Rediseño 2026-08-25, Bloque B de la auditoría del estimador.) El panel se
// achicó a lo mínimo que un operario necesita ver de entrada: el rango, el
// costo, y una línea de dónde salió el número — la banda de confianza ya lo
// dice (`banda.nivel`: "N cargas reales medidas", "ficha completa, sin cargas
// reales", "estimado por clase, sin ficha de la unidad"...). Los "tres
// números" de la unidad (teórico/real/usado) y el desvío contra la ficha son
// info de LA UNIDAD, no de este viaje puntual: viven en Flota → editar unidad,
// no acá. El desglose (precio del litro, vacío vs. cargado, ralentí,
// aprovechamiento de peso/volumen) quedó afuera por la misma razón: son datos
// de apoyo, no el número que el operario vino a buscar.
//
// El modelo está en utils/consumo.js y la calibración en utils/calibracion.js,
// incluido lo que NO calculan.

import React, { useMemo, useState } from 'react'
import { Fuel, TriangleAlert, Info, ChevronDown, ChevronRight } from 'lucide-react'
import { formatARS } from '../utils/format'
import {
  estimarConsumo, consumoRealVehiculo, precioLitroReciente,
  specsVehiculo, baseTeorica, SUPUESTOS_NO_MODELADOS,
  fmtL100, fmtLitros,
} from '../utils/consumo'
import { calibracionVehiculo } from '../utils/calibracion'

export default function ConsumoEstimado({ vehiculo, viaje, combustible, viajes }) {
  const [verSupuestos, setVerSupuestos] = useState(false)

  const real = useMemo(
    () => consumoRealVehiculo(combustible, vehiculo?.id),
    [combustible, vehiculo?.id]
  )
  const precio = useMemo(
    () => precioLitroReciente(combustible, vehiculo?.id),
    [combustible, vehiculo?.id]
  )

  // Calibración: el consumo teórico de la ficha mezclado con el medido en las
  // cargas a tanque lleno de ESTA unidad. `teoricoBase` depende de la mezcla
  // urbano/ruta del viaje, por eso se calcula acá y no adentro del estimador.
  // No se muestra directamente (eso vive en Flota): sólo alimenta el cálculo.
  const cal = useMemo(() => {
    if (!vehiculo?.id) return null
    const specs = specsVehiculo(vehiculo)
    if (!specs.ok) return null
    const t = baseTeorica(specs, viaje.ruta_tipo)
    return calibracionVehiculo({ combustible, viajes, vehiculoId: vehiculo.id, specs, teoricoBase: t })
  }, [vehiculo, combustible, viajes, viaje.ruta_tipo])

  const est = useMemo(() => estimarConsumo({
    vehiculo,
    distanciaKm: viaje.distancia_km,
    pesoKg:      viaje.carga_peso_kg,
    volumenM3:   viaje.carga_volumen_m3,
    rutaTipo:    viaje.ruta_tipo,
    topografia:  viaje.topografia,
    horasRalenti: viaje.horas_ralenti,
    precioLitro: precio.precio,
    l100Real:    real.l100,
    calibracion: cal && cal.ok ? cal : null,
  }), [vehiculo, viaje.distancia_km, viaje.carga_peso_kg, viaje.carga_volumen_m3, viaje.ruta_tipo,
       viaje.topografia, viaje.horas_ralenti, precio.precio, real.l100, cal])

  const marco = {
    padding: 14, borderRadius: 'var(--radius)',
    background: 'var(--bg-overlay)', border: '1px solid var(--border)',
  }

  const titulo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Fuel size={14} style={{ color: 'var(--accent)' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Combustible estimado</span>
      {!vehiculo && <span style={{ fontSize: 11, color: 'var(--text-2)' }}>— elegí un vehículo</span>}
    </div>
  )

  // Sin datos suficientes. Se separan los tres casos a propósito: la distancia
  // es una acción real del usuario, pero el consumo NO hay que pedirlo a mano —
  // para eso está la calibración por historial. Pedir "cargá el consumo" induce
  // justo el error que queremos evitar (un número inventado en el campo portante).
  if (!est.ok) {
    const faltaVehiculo = !vehiculo
    const faltaDistancia = est.faltan.some(f => f.includes('distancia'))
    const faltaConsumo = est.faltan.some(f => f.includes('unidad'))
    return (
      <div style={marco}>
        {titulo}
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
          {faltaVehiculo ? (
            <p style={{ margin: 0 }}>Elegí un vehículo para estimar el consumo.</p>
          ) : (
            <>
              {faltaDistancia && (
                <p style={{ margin: 0 }}>Cargá la distancia del viaje para estimar el consumo.</p>
              )}
              {faltaConsumo && (
                <p style={{ margin: faltaDistancia ? '8px 0 0' : 0 }}>
                  Todavía no hay con qué estimar el consumo de esta unidad, y <strong style={{ color: 'var(--text-1)' }}>no hace falta cargarlo a mano</strong>.
                  El estimado se va a afinar solo con las <strong style={{ color: 'var(--text-1)' }}>primeras cargas de combustible a tanque lleno y con odómetro</strong> de
                  esta unidad: cuantas más cargas medibles, más preciso el número.
                  {' '}Si tenés el <strong style={{ color: 'var(--text-1)' }}>consumo homologado de fábrica</strong> (el dato oficial, no un número a ojo),
                  cargarlo en la ficha acelera el arranque — pero no es necesario.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const { banda, rangoLitros, rangoCosto } = est

  return (
    <div style={marco}>
      {titulo}

      {/* El rango, grande y primero. El número puntual queda debajo y en chico:
          es el centro del rango, no una promesa. La banda ya dice de dónde
          salió el número (nivel), así que no hace falta una línea aparte. */}
      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius)',
        background: 'var(--accent-dim)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px' }}>
          <span className="num" style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1.1, letterSpacing: '-.02em' }}>
            {rangoLitros.min.toFixed(0)} – {rangoLitros.max.toFixed(0)}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>litros</span>
          {rangoCosto && (
            <span className="num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginLeft: 'auto' }}>
              {formatARS(rangoCosto.min)} – {formatARS(rangoCosto.max)}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 5, lineHeight: 1.5 }}>
          Centro <span className="num" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmtLitros(est.litros)}</span>
          {' '}({fmtL100(est.l100)}) · banda <strong style={{ color: 'var(--text-1)' }}>±{Math.round(banda.pct * 100)}%</strong>
          {' '}— {banda.nivel}
        </div>
      </div>

      {est.sobrepeso && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--danger-dim)' }}>
          <TriangleAlert size={13} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
            El peso declarado supera la carga útil de la unidad. Además de la multa, el estimado se queda corto.
          </span>
        </div>
      )}

      {/* Supuestos: los del cálculo (por qué este número es este) y los que NO
          se modelan (por qué puede errarle). Colapsado para no tapar el número,
          pero con la cuenta a la vista para que se sepa que están. */}
      <button
        type="button"
        onClick={() => setVerSupuestos(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, padding: 0,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 11, color: 'var(--text-2)', fontWeight: 600,
        }}
      >
        {verSupuestos ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Info size={12} />
        Supuestos del cálculo ({est.supuestos.length + SUPUESTOS_NO_MODELADOS.length})
      </button>

      {verSupuestos && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
          {est.supuestos.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {est.supuestos.map((s, i) => <li key={i}>· {s}</li>)}
            </ul>
          )}
          <div style={{ marginTop: est.supuestos.length ? 8 : 0 }}>
            <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Fuera del modelo:</span>{' '}
            {SUPUESTOS_NO_MODELADOS.join(' · ').toLowerCase()}. El historial de cargas a
            tanque lleno sí los trae incorporados: por eso el estimado migra hacia el
            consumo medido a medida que se acumulan cargas.
          </div>
        </div>
      )}
    </div>
  )
}
