// src/pages/HistorialPagos.tsx
// Inicio → Planes sin pago → al tocar un plan: historial de TODOS los planes del cliente
// (cualquier instrumento, todas las fechas), del más antiguo al más nuevo.
// Por plan: fecha, instrumento, duración, clases, valor, y sus pagos (una línea por abono).
// Acciones: "+ Pago" (registrar_pago), ✏️ corregir pago (editar_pago), "Poner valor" (asignar_valor_plan).
// No se borran pagos desde aquí.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { formatPesos } from '../utils/saldoPlan'
import { registrarPago, editarPago, asignarValorPlan, METODOS_PAGO, hoyLocal } from '../utils/accionesPago'

const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const ROJO = '#991b1b'

type Pago = { id: string; monto: number; metodo: string | null; fecha: string | null; notas: string | null }
type PlanH = {
  id: string; inicio: string | null; instrumento: string; duracion: number | null
  total: number; tomadas: number; valor: number; estado: string; pagos: Pago[]; pagado: number
  otroPlan: boolean; nota: string | null   // cobro incluido en otro plan
}
type Modal =
  | { tipo: 'nuevo'; plan: PlanH }
  | { tipo: 'editar'; plan: PlanH; pago: Pago }
  | { tipo: 'valor'; plan: PlanH }

function fecha(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.substring(0, 10).split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]} ${y}`
}
function num(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '') }

export default function HistorialPagos({ clienteId, planActualId, esMovil, onCambio }: {
  clienteId: string
  planActualId: string
  esMovil: boolean
  onCambio: () => void
}) {
  const [planes, setPlanes]       = useState<PlanH[]>([])
  const [cargando, setCargando]   = useState(true)
  const [modal, setModal]         = useState<Modal | null>(null)
  const [form, setForm]           = useState({ valorPlan: '', monto: '', metodo: '', fecha: hoyLocal(), notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => { cargar() }, [clienteId])

  async function cargar() {
    setCargando(true)
    const { data: ct } = await supabase.from('contratos')
      .select('id, fecha_inicio, duracion_min, total_clases, clases_tomadas, valor_plan, estado, cobro_en_otro_plan, cobro_nota, instrumentos(nombre)')
      .eq('cliente_id', clienteId)
      .order('fecha_inicio', { ascending: true })
    const ids = (ct || []).map((p: any) => p.id)
    const porPlan: Record<string, Pago[]> = {}
    if (ids.length) {
      const { data: pg } = await supabase.from('pagos')
        .select('id, contrato_id, monto, metodo, fecha, notas')
        .in('contrato_id', ids)
        .order('fecha', { ascending: true })
      ;(pg || []).forEach((p: any) => {
        (porPlan[p.contrato_id] ||= []).push({ id: p.id, monto: Number(p.monto || 0), metodo: p.metodo, fecha: p.fecha, notas: p.notas })
      })
    }
    setPlanes((ct || []).map((p: any) => {
      const pagos = porPlan[p.id] || []
      return {
        id: p.id, inicio: p.fecha_inicio, instrumento: p.instrumentos?.nombre || '—',
        duracion: p.duracion_min || null, total: Number(p.total_clases || 0), tomadas: Number(p.clases_tomadas || 0),
        valor: Number(p.valor_plan || 0), estado: p.estado, pagos,
        pagado: pagos.reduce((s, x) => s + x.monto, 0),
        otroPlan: !!p.cobro_en_otro_plan, nota: p.cobro_nota || null,
      }
    }))
    setCargando(false)
  }

  function abrir(m: Modal) {
    setError('')
    if (m.tipo === 'nuevo') {
      const saldo = m.plan.valor > 0 ? Math.max(m.plan.valor - m.plan.pagado, 0) : 0
      setForm({ valorPlan: '', monto: saldo > 0 ? String(saldo) : '', metodo: '', fecha: hoyLocal(), notas: '' })
    } else if (m.tipo === 'editar') {
      setForm({ valorPlan: '', monto: String(m.pago.monto), metodo: m.pago.metodo || '', fecha: m.pago.fecha || hoyLocal(), notas: m.pago.notas || '' })
    } else {
      setForm({ valorPlan: '', monto: '', metodo: '', fecha: hoyLocal(), notas: '' })
    }
    setModal(m)
  }

  async function guardar() {
    if (!modal) return
    setError('')
    let r
    if (modal.tipo === 'valor') {
      const v = Number(form.valorPlan)
      if (!(v > 0)) { setError('Ingresa el valor del plan.'); return }
      setGuardando(true)
      r = await asignarValorPlan(modal.plan.id, v)
    } else {
      const monto = Number(form.monto)
      const sinValor = modal.tipo === 'nuevo' && modal.plan.valor === 0
      if (sinValor && !(Number(form.valorPlan) > 0)) { setError('Ingresa el valor del plan.'); return }
      if (!(monto > 0)) { setError('Ingresa un monto mayor a 0.'); return }
      if (!form.metodo) { setError('Selecciona la cuenta del pago.'); return }
      if (!form.fecha) { setError('Selecciona la fecha del pago.'); return }
      setGuardando(true)
      r = modal.tipo === 'nuevo'
        ? await registrarPago({ contratoId: modal.plan.id, monto, metodo: form.metodo, fecha: form.fecha, notas: form.notas,
            valorPlan: sinValor ? Number(form.valorPlan) : null, via: 'inicio' })
        : await editarPago({ pagoId: modal.pago.id, monto, metodo: form.metodo, fecha: form.fecha, notas: form.notas })
    }
    setGuardando(false)
    if (!r.ok) { setError(r.mensaje); return }
    setModal(null)
    await cargar()
    onCambio()
  }

  // ── piezas visuales ──
  const btn = (txt: string, onClick: () => void, fuerte = false) => (
    <button onClick={e => { e.stopPropagation(); onClick() }}
      style={{ padding: '3px 9px', borderRadius: '7px', border: `1px solid ${fuerte ? ROJO : '#cbd5e1'}`, background: 'white',
        color: fuerte ? ROJO : '#475569', fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {txt}
    </button>
  )
  const lapiz = (onClick: () => void) => (
    <button title="Corregir pago" onClick={e => { e.stopPropagation(); onClick() }}
      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>✏️</button>
  )
  const etiquetaEstado = (e: string) => e === 'activo' ? null : (
    <span style={{ padding: '0 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#64748b', marginLeft: '5px' }}>
      {e === 'completado' ? 'Completado' : e === 'archivado' ? 'Archivado' : e}
    </span>
  )
  const valorCelda = (p: PlanH) => p.otroPlan ? <span style={{ color: '#64748b' }}>—</span> : p.valor > 0 ? formatPesos(p.valor)
    : <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}><span style={{ color: '#dc2626', fontWeight: 700 }}>Sin valor</span>{btn('Poner valor', () => abrir({ tipo: 'valor', plan: p }))}</span>
  const debe = (p: PlanH) => !p.otroPlan && (p.valor === 0 || p.pagado < p.valor)
  const otroPlanTxt = (p: PlanH) => (
    <span style={{ color: '#0369a1', fontStyle: 'italic' }} title={p.nota || undefined}>Pagado en otro plan{p.nota ? ` · ${p.nota}` : ''}</span>
  )

  let contenido
  if (cargando) {
    contenido = <p style={{ margin: 0, padding: '14px', color: '#9ca3af', fontSize: '12px', textAlign: 'center' }}>Cargando historial...</p>
  } else if (esMovil) {
    contenido = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px' }}>
        {planes.map(p => (
          <div key={p.id} style={{ border: `1px solid ${p.id === planActualId ? '#fca5a5' : '#e2e8f0'}`, background: p.id === planActualId ? '#fef2f2' : 'white', borderRadius: '10px', padding: '8px 10px', textAlign: 'left' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#1f2937' }}>
              {fecha(p.inicio)} · {p.instrumento}{etiquetaEstado(p.estado)}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'flex', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
              <span>{p.duracion || '—'} min · Clases {num(p.tomadas)}/{num(p.total)}</span>
              <span>Valor {valorCelda(p)}</span>
            </div>
            {p.otroPlan && p.pagos.length === 0 ? (
              <div style={{ marginTop: '6px', fontSize: '12px' }}>{otroPlanTxt(p)}</div>
            ) : p.pagos.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                <span style={{ fontSize: '12px', color: '#dc2626', fontStyle: 'italic' }}>Sin pago registrado</span>
                {btn('+ Pago', () => abrir({ tipo: 'nuevo', plan: p }), true)}
              </div>
            ) : (
              <>
                {p.pagos.map(pg => (
                  <div key={pg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '12px', color: '#1f2937', borderTop: '1px dashed #e2e8f0', paddingTop: '4px' }}>
                    <span><b>{formatPesos(pg.monto)}</b> · {pg.metodo || '—'} · {fecha(pg.fecha)}</span>
                    {lapiz(() => abrir({ tipo: 'editar', plan: p, pago: pg }))}
                  </div>
                ))}
                {debe(p) && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>{btn('+ Pago', () => abrir({ tipo: 'nuevo', plan: p }), true)}</div>}
              </>
            )}
          </div>
        ))}
      </div>
    )
  } else {
    const td = { padding: '6px 10px', fontSize: '12px', color: '#374151', borderTop: '1px solid #f1f5f9' } as const
    contenido = (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {['Plan', 'Duración', 'Clases', 'Valor', 'Pagado', 'Cuenta', 'Fecha pago', ''].map((h, i) => (
              <th key={h + i} style={{ padding: '6px 10px', textAlign: i >= 1 && i <= 4 ? 'right' : 'left', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planes.map(p => {
            const fondo = p.id === planActualId ? '#fef2f2' : 'white'
            const filas = p.pagos.length ? p.pagos : [null]
            return filas.map((pg, k) => (
              <tr key={p.id + (pg?.id || 'vacio')} style={{ background: fondo }}>
                <td style={{ ...td, fontWeight: 600, borderTop: k === 0 ? td.borderTop : 'none' }}>{k === 0 && <>{fecha(p.inicio)} · {p.instrumento}{etiquetaEstado(p.estado)}</>}</td>
                <td style={{ ...td, textAlign: 'right', borderTop: k === 0 ? td.borderTop : 'none' }}>{k === 0 && `${p.duracion || '—'} min`}</td>
                <td style={{ ...td, textAlign: 'right', borderTop: k === 0 ? td.borderTop : 'none' }}>{k === 0 && `${num(p.tomadas)}/${num(p.total)}`}</td>
                <td style={{ ...td, textAlign: 'right', borderTop: k === 0 ? td.borderTop : 'none' }}>{k === 0 && valorCelda(p)}</td>
                {pg ? (
                  <>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{formatPesos(pg.monto)}</td>
                    <td style={td}>{pg.metodo || '—'}</td>
                    <td style={td}>{fecha(pg.fecha)}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {lapiz(() => abrir({ tipo: 'editar', plan: p, pago: pg }))}
                      {k === filas.length - 1 && debe(p) && btn('+ Pago', () => abrir({ tipo: 'nuevo', plan: p }), true)}
                    </td>
                  </>
                ) : p.otroPlan ? (
                  <>
                    <td style={{ ...td, textAlign: 'right', color: '#64748b' }}>—</td>
                    <td style={{ ...td, fontSize: '12px' }} colSpan={3}>{otroPlanTxt(p)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ ...td, textAlign: 'right', color: '#dc2626' }}>—</td>
                    <td style={{ ...td, color: '#dc2626', fontStyle: 'italic' }} colSpan={2}>Sin pago registrado</td>
                    <td style={{ ...td, textAlign: 'right' }}>{btn('+ Pago', () => abrir({ tipo: 'nuevo', plan: p }), true)}</td>
                  </>
                )}
              </tr>
            ))
          })}
        </tbody>
      </table>
    )
  }

  // ── ventana ──
  const campo = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box' as const, background: 'white' }
  const etiqueta = { display: 'block', margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' as const }
  const ventana = modal && (() => {
    const p = modal.plan
    const pideValor = modal.tipo === 'valor' || (modal.tipo === 'nuevo' && p.valor === 0)
    const titulo = modal.tipo === 'valor' ? 'Poner valor del plan' : modal.tipo === 'nuevo' ? 'Registrar pago' : 'Corregir pago'
    return (
      <div onClick={e => { e.stopPropagation(); if (!guardando) setModal(null) }}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: 'white', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'left' }}>
          <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{titulo}</p>
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#4b5563' }}>
            Plan {fecha(p.inicio)} · {p.instrumento}{p.valor > 0 ? ` · Valor ${formatPesos(p.valor)} · Pagado ${formatPesos(p.pagado)}` : ''}
          </p>
          {pideValor && (
            <div style={{ marginBottom: '12px' }}>
              <label style={etiqueta}>Valor del plan</label>
              <input type="number" inputMode="numeric" min="0" value={form.valorPlan} placeholder="Ej. 400000"
                onChange={e => setForm(f => ({ ...f, valorPlan: e.target.value }))} style={campo} />
              {Number(form.valorPlan) > 0 && <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>{formatPesos(Number(form.valorPlan))}</p>}
            </div>
          )}
          {modal.tipo !== 'valor' && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={etiqueta}>Monto</label>
                <input type="number" inputMode="numeric" min="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={campo} />
                {Number(form.monto) > 0 && <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>{formatPesos(Number(form.monto))}</p>}
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={etiqueta}>Cuenta</label>
                <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))} style={campo}>
                  <option value="" disabled>Selecciona la cuenta...</option>
                  {/* Si el pago tiene una cuenta que ya no está en la lista, se conserva como opción */}
                  {form.metodo && !METODOS_PAGO.includes(form.metodo) && <option value={form.metodo}>{form.metodo}</option>}
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={etiqueta}>Fecha del pago</label>
                <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={campo} />
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={etiqueta}>Notas (opcional)</label>
                <input type="text" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={campo} />
              </div>
            </>
          )}
          {error && <p style={{ margin: '0 0 12px', fontSize: '13px', color: ROJO, fontWeight: 600 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button disabled={guardando} onClick={() => setModal(null)}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button disabled={guardando} onClick={guardar}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: ROJO, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    )
  })()

  return (
    <div onClick={e => e.stopPropagation()} style={{ background: '#f8fafc', borderTop: '1px solid #fecaca', borderBottom: '1px solid #fecaca', cursor: 'default' }}>
      <p style={{ margin: 0, padding: '8px 12px 0', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>
        Historial de planes y pagos del cliente
      </p>
      {contenido}
      {ventana}
    </div>
  )
}
