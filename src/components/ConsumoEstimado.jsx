// Panel de consumo estimado de un viaje. Se usa dentro del modal de Viajes y
// lee el form en vivo: al tipear los km o el peso, el número se recalcula.
//
// Tres reglas de esta pantalla:
//
//  1. El resultado es un RANGO, no un número puntual, y el rango va grande y
//     arriba. Si un transportista cotiza un flete con esto y le erra, la
//     diferencia la pone él: la incertidumbre no puede estar escondida en un
//     tooltip.
//  2. Nunca mostrar el estimado solo. Siempre al lado va de dónde salió (ficha
//     del fabricante, benchmark, historial real) y qué se dio por sentado.
//  3. Los tres números de la unidad —teórico, real medido y usado— se muestran
//     juntos con el n de cargas y el desvío. El desvío es información valiosa
//     por sí sola: una unidad sostenidamente 20% arriba del teórico tiene algo
//     (inyectores, chofer, neumáticos, o combustible que se va por otro lado).
//
// El modelo está en utils/consumo.js y la calibración en utils/calibracion.js,
// incluido lo que NO calculan.

import React, { useMemo, useState } from 'react'
import { Fuel, TriangleAlert, Info, Gauge, ChevronDown, ChevronRight } from 'lucide-react'
import { formatARS, formatDate } from '../utils/format'
import {
  estimarConsumo, consumoRealVehiculo, precioLitroReciente,
  specsVehiculo, baseTeorica, SUPUESTOS_NO_MODELADOS,
  fmtL100, fmtLitros, fmtPct,
} from '../utils/consumo'
import { calibracionVehiculo } from '../utils/calibracion'

function Dato({ label, valor, color, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="db-slabel" style={{ marginBottom: 4 }}>{label}</div>
      <div className="nums" style={{ fontSize: 17, fontWeight: 700, color: color || 'var(--text-1)', lineHeight: 1.2 }}>{valor}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// Barra de aprovechamiento (peso o volumen). Pasada de 100% se pone en danger:
// es sobrepeso, y eso es una multa, no un detalle de consumo.
function Barra({ label, pct, detalle }) {
  const exceso = pct > 1
  const color = exceso ? 'var(--danger)' : pct > 0.85 ? 'var(--warning)' : 'var(--accent)'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>
        <span>{label}</span>
        <span className="num" style={{ color, fontWeight: 600 }}>{fmtPct(pct)}{detalle ? ` · ${detalle}` : ''}</span>
      </div>
      <div style={{ height: 5, borderRadius: 999, background: 'var(--bg-overlay)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 1) * 100}%`, background: color, borderRadius: 999 }} />
      </div>
    </div>
  )
}

// Los tres números de la unidad. `usado` se resalta porque es el que estima;
// los otros dos están para poder discutirlo.
function TresNumeros({ cal, teorico }) {
  const celda = (label, valor, sub, destacado) => (
    <div style={{
      padding: '9px 11px', borderRadius: 'var(--radius-sm)', minWidth: 0,
      background: destacado ? 'var(--accent-dim)' : 'var(--bg-elevated)',
      border: `1px solid ${destacado ? 'transparent' : 'var(--border)'}`,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: destacado ? 'var(--accent)' : 'var(--text-3)' }}>{label}</div>
      <div className="num" style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginTop: 3 }}>{valor}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )

  const hayReal = cal && cal.ok && cal.real != null
  return (
    <div style={{ marginTop: 14 }}>
      <div className="db-slabel" style={{ marginBottom: 7 }}>Consumo de la unidad (vacía, en este tipo de recorrido)</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        {celda('Teórico', fmtL100(teorico), 'de la ficha, corregido por la fuente', !hayReal)}
        {celda(
          'Real medido',
          hayReal ? fmtL100(cal.real) : '—',
          hayReal
            ? `${cal.n} ${cal.n === 1 ? 'carga medible' : 'cargas medibles'} a tanque lleno${cal.nVentana < cal.n ? ` (promedio de las últimas ${cal.nVentana})` : ''}`
            : 'hace falta al menos una carga a tanque lleno con odómetro',
          false,
        )}
        {celda(
          'Usado',
          fmtL100(hayReal ? cal.usadoBase : teorico),
          hayReal ? `el medido pesa ${Math.round(cal.w * 100)}%` : 'todavía es el teórico',
          hayReal,
        )}
      </div>

      {hayReal && cal.desvio != null && Math.abs(cal.desvio) > 0.10 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)' }}>
          <Gauge size={13} style={{ color: 'var(--text-2)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Esta unidad consume un{' '}
            <strong style={{ color: cal.desvio > 0 ? 'var(--warning)' : 'var(--positive)' }}>
              {fmtPct(Math.abs(cal.desvio))} {cal.desvio > 0 ? 'más' : 'menos'}
            </strong>{' '}
            de lo que dice su ficha.
            {cal.desvio > 0.15 && ' Si el desvío se sostiene conviene mirar inyectores, presión de neumáticos, estilo de manejo — o si el combustible se está yendo por otro lado.'}
          </span>
        </div>
      )}

      {(cal?.avisos || []).length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 0, listStyle: 'none', fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
          {cal.avisos.map((a, i) => <li key={i}>· {a}</li>)}
        </ul>
      )}
    </div>
  )
}

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
  const { cal, teorico } = useMemo(() => {
    if (!vehiculo?.id) return { cal: null, teorico: null }
    const specs = specsVehiculo(vehiculo)
    if (!specs.ok) return { cal: null, teorico: null }
    const t = baseTeorica(specs, viaje.ruta_tipo)
    const c = calibracionVehiculo({
      combustible, viajes, vehiculoId: vehiculo.id, specs, teoricoBase: t,
    })
    return { cal: c, teorico: t }
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

  // Sin datos suficientes: se dice exactamente qué falta y dónde se carga, en
  // vez de un guión que no le enseña nada a nadie.
  if (!est.ok) {
    return (
      <div style={marco}>
        {titulo}
        <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
          Falta {est.faltan.join(' y ')} para poder estimarlo.
          {est.faltan.some(f => f.includes('unidad')) && (
            <> Las specs de consumo se cargan una sola vez por unidad en <strong style={{ color: 'var(--text-1)' }}>Flota → editar vehículo → Consumo y pesos</strong>, y se pueden precargar desde el catálogo de motores.</>
          )}
        </p>
      </div>
    )
  }

  const { aprovechamiento: ap, banda, rangoLitros, rangoCosto } = est

  return (
    <div style={marco}>
      {titulo}

      {/* El rango, grande y primero. El número puntual queda debajo y en chico:
          es el centro del rango, no una promesa. */}
      <div style={{
        padding: '12px 14px', borderRadius: 'var(--radius)',
        background: 'var(--accent-dim)', marginBottom: 14,
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
          {' '}· banda <strong style={{ color: 'var(--text-1)' }}>±{Math.round(banda.pct * 100)}%</strong> ({banda.nivel})
          {' '}· {fmtL100(est.l100)} en el viaje
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 14 }}>
        <Dato
          label="Precio del litro"
          valor={est.precioLitro != null ? formatARS(est.precioLitro) : '—'}
          color={est.precioLitro != null ? 'var(--positive)' : 'var(--text-3)'}
          sub={est.precioLitro != null
            ? `${precio.propio ? 'última carga de la unidad' : 'última carga de la flota'}${precio.fecha ? ` (${formatDate(precio.fecha)})` : ''}`
            : 'Cargá una carga de combustible con importe para tener costo'}
        />
        <Dato
          label="Vacío vs. cargado"
          valor={fmtLitros(est.litrosVacio)}
          sub={est.litrosPorCarga > 0.05
            ? `+${est.litrosPorCarga.toFixed(1)} L por la carga`
            : 'sin carga declarada'}
        />
        {est.litrosRalenti > 0 && (
          <Dato
            label="Ralentí"
            valor={fmtLitros(est.litrosRalenti)}
            sub={`${est.horasRalenti} h de motor detenido`}
          />
        )}
      </div>

      {teorico != null && <TresNumeros cal={cal} teorico={teorico} />}

      {(ap.peso != null || ap.volumen != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          {ap.peso != null && (
            <Barra
              label="Aprovechamiento de peso"
              pct={ap.peso}
              detalle={est.specs.cargaMax ? `${Math.round(est.specs.cargaMax).toLocaleString('es-AR')} kg útiles` : null}
            />
          )}
          {ap.volumen != null && (
            <div style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5, alignSelf: 'center' }}>
              <span className="num" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{ap.volumen} m³</span> declarados.
              El volumen no cambia el consumo en un furgón cerrado: se usa para ver si el viaje cubica antes de pesar.
            </div>
          )}
        </div>
      )}

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
