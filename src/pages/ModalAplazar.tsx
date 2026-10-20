// src/pages/ModalAplazar.tsx
// Ventana "Aplazar clases" (Clientes y Horarios). Usa la función única aplazarClases.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal } from '../utils/accionesPago'
import { aplazarClases, DIAS_AVISO_SIN_FECHA } from '../utils/accionesAplazamiento'

const C = '#0e7490'
const campo = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box' as const, background: 'white' }
const etiqueta = { display: 'block', margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' as const }

export default function ModalAplazar({ clienteId, clienteNombre, desdeInicial, onCerrar, onListo }: {
  clienteId: string; clienteNombre: string; desdeInicial?: string
  onCerrar: () => void; onListo: (mensaje: string) => void
}) {
  const [desde, setDesde] = useState(desdeInicial || hoyLocal())
  const [hasta, setHasta] = useState('')
  const [sinFecha, setSinFecha] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cantidad, setCantidad] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Vista previa: cuántas clases quedarían aplazadas
  useEffect(() => {
    let vigente = true
    ;(async () => {
      setCantidad(null)
      if (!desde || (!sinFecha && !hasta)) return
      let q = supabase.from('clases').select('id, contratos!inner(cliente_id)', { count: 'exact', head: true })
        .eq('contratos.cliente_id', clienteId).in('estado', ['programada', 'confirmada']).gte('fecha', desde)
      if (!sinFecha) q = q.lt('fecha', hasta)   // el día de regreso sí hay clase
      const { count } = await q
      if (vigente) setCantidad(count ?? 0)
    })()
    return () => { vigente = false }
  }, [desde, hasta, sinFecha, clienteId])

  async function guardar() {
    if (!desde) { setError('Indica desde qué fecha.'); return }
    if (!sinFecha && !hasta) { setError('Indica la fecha de regreso o marca "Hasta nuevo aviso".'); return }
    if (!sinFecha && hasta <= desde) { setError('La fecha de regreso debe ser posterior a la de inicio.'); return }
    setGuardando(true); setError('')
    const r = await aplazarClases(clienteId, desde, sinFecha ? null : hasta, motivo)
    setGuardando(false)
    if (!r.ok) { setError(r.mensaje); return }
    onListo(r.mensaje)
  }

  return (
    <div onClick={() => !guardando && onCerrar()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'left' }}>
        <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>⏸ Aplazar clases</p>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
          {clienteNombre}<br />
          Las clases de ese periodo salen del horario y no cuentan en el plan. Desde el día de regreso siguen solas.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={etiqueta}>Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={campo} />
          </div>
          <div>
            <label style={etiqueta}>Regresa el</label>
            <input type="date" value={hasta} disabled={sinFecha} onChange={e => setHasta(e.target.value)} style={{ ...campo, opacity: sinFecha ? 0.4 : 1 }} />
          </div>
        </div>
        <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px', color: '#374151', marginBottom: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={sinFecha} onChange={e => setSinFecha(e.target.checked)} />
          Hasta nuevo aviso <span style={{ color: '#94a3b8', fontSize: '12px' }}>(aviso para contactar a los {DIAS_AVISO_SIN_FECHA} días)</span>
        </label>
        <div style={{ marginBottom: '12px' }}>
          <label style={etiqueta}>Motivo (opcional)</label>
          <input type="text" value={motivo} placeholder="Ej. Viaje, exámenes…" onChange={e => setMotivo(e.target.value)} style={campo} />
        </div>
        {cantidad !== null && (
          <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: cantidad > 0 ? C : '#b45309' }}>
            {cantidad > 0 ? `Se aplazarán ${cantidad} clase(s) programada(s) o confirmada(s).` : 'No hay clases programadas en esas fechas.'}
          </p>
        )}
        {error && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>{error}</p>}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button disabled={guardando} onClick={onCerrar}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button disabled={guardando} onClick={guardar}
            style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: C, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Aplazando…' : 'Aplazar'}
          </button>
        </div>
      </div>
    </div>
  )
}
