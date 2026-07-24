// Panel de consumo estimado de un viaje. Se usa dentro del modal de Viajes y
// lee el form en vivo: al tipear los km o el peso, el número se recalcula.
//
// Regla de la pantalla: nunca mostrar el estimado solo. Siempre al lado va de
// dónde salió (specs de la ficha vs. historial real) y qué se dio por sentado.
// El modelo está en utils/consumo.js, incluido lo que NO calcula.

import React, { useMemo } from 'react'
import { Fuel, TriangleAlert, Info, Gauge } from 'lucide-react'
import { formatARS, formatDate } from '../utils/format'
import {
  estimarConsumo, consumoRealVehiculo, precioLitroReciente,
  fmtL100, fmtLitros, fmtPct,
} from '../utils/consumo'

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

export default function ConsumoEstimado({ vehiculo, viaje, combustible }) {
  const real = useMemo(
    () => consumoRealVehiculo(combustible, vehiculo?.id),
    [combustible, vehiculo?.id]
  )
  const precio = useMemo(
    () => precioLitroReciente(combustible, vehiculo?.id),
    [combustible, vehiculo?.id]
  )

  const est = useMemo(() => estimarConsumo({
    vehiculo,
    distanciaKm: viaje.distancia_km,
    pesoKg:      viaje.carga_peso_kg,
    volumenM3:   viaje.carga_volumen_m3,
    rutaTipo:    viaje.ruta_tipo,
    precioLitro: precio.precio,
    l100Real:    real.l100,
  }), [vehiculo, viaje.distancia_km, viaje.carga_peso_kg, viaje.carga_volumen_m3, viaje.ruta_tipo, precio.precio, real.l100])

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

  const { aprovechamiento: ap } = est
  // Desvío del teórico contra el consumo real medido de esta unidad. Sólo se
  // muestra con al menos 2 intervalos válidos: con uno solo, cualquier carga
  // parcial lo distorsiona entero.
  const hayReal = real.l100 != null && real.muestras >= 2 && est.specs.fuente !== 'historico'
  const desvio  = hayReal ? (real.l100 - est.base) / est.base : null

  return (
    <div style={marco}>
      {titulo}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 14 }}>
        <Dato
          label="Litros"
          valor={fmtLitros(est.litros)}
          color="var(--accent)"
          sub={`${fmtL100(est.l100)} en el viaje`}
        />
        <Dato
          label="Costo estimado"
          valor={est.costo != null ? formatARS(est.costo) : '—'}
          color={est.costo != null ? 'var(--positive)' : 'var(--text-3)'}
          sub={est.precioLitro != null
            ? `${formatARS(est.precioLitro)}/L · ${precio.propio ? 'última carga de la unidad' : 'última carga de la flota'}${precio.fecha ? ` (${formatDate(precio.fecha)})` : ''}`
            : 'Cargá una carga de combustible con importe para tener precio'}
        />
        <Dato
          label="Vacío vs. cargado"
          valor={fmtLitros(est.litrosVacio)}
          sub={est.litrosPorCarga > 0.05
            ? `+${est.litrosPorCarga.toFixed(1)} L por la carga`
            : 'sin carga declarada'}
        />
      </div>

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

      {hayReal && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-elevated)' }}>
          <Gauge size={13} style={{ color: 'var(--text-2)', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 11, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Consumo <strong style={{ color: 'var(--text-1)' }}>real</strong> de esta unidad según el historial de cargas:{' '}
            <span className="num" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{fmtL100(real.l100)}</span>
            {' '}({real.muestras} {real.muestras === 1 ? 'intervalo' : 'intervalos'}).
            {Math.abs(desvio) > 0.15 && (
              <> Está un <strong style={{ color: desvio > 0 ? 'var(--warning)' : 'var(--positive)' }}>{fmtPct(Math.abs(desvio))} {desvio > 0 ? 'por encima' : 'por debajo'}</strong> del consumo en vacío de la ficha — si el desvío se repite, conviene ajustar las specs de la unidad.</>
            )}
          </span>
        </div>
      )}

      {est.supuestos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12 }}>
          <Info size={13} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} />
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.6 }}>
            {est.supuestos.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
