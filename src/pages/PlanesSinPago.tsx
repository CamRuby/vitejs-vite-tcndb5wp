// src/pages/PlanesSinPago.tsx
// Inicio → Planes sin pago, por sede (Rosales, Chicó, Tunja).
// Entran: planes desde la fecha de corte, en cualquier estado, sin valor definido o con pagado < valor.
// Orden: del plan más antiguo (fecha de inicio) al más nuevo. Un cliente con 2 planes aparece 2 veces.
// Arriba: total adeudado de la sede.
// Botón "Registrar pago" por plan (función única registrar_pago, auditada).

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import SeccionInicio from './SeccionInicio'
import { CORTE_PAGOS, tieneSaldo, pagadoPorPlan, formatPesos } from '../utils/saldoPlan'
import { registrarPago, METODOS_PAGO, hoyLocal } from '../utils/accionesPago'

const COLORES = { header: '#991b1b', headerBg: '#fef2f2', border: '#fecaca' }
const ORDEN_SEDES = ['rosales', 'chico', 'tunja']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

type Plan = {
  id: string; sedeId: string; cliente: string; instrumento: string; profesor: string
  inicio: string; total: number; tomadas: number; duracion: number | null
  valor: number; pagado: number; estado: string
}

function normalizar(s: string) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function num(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '') }
function fechaCorta(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`
}

export default function PlanesSinPago({ esMovil }: { esMovil: boolean }) {
  const [sedes, setSedes]       = useState<{ id: string; nombre: string }[]>([])
  const [planes, setPlanes]     = useState<Plan[]>([])
  const [sedeSel, setSedeSel]   = useState<string>('')
  const [cargando, setCargando] = useState(true)

  // Registro de pago
  const [aPagar, setAPagar]         = useState<Plan | null>(null)
  const [form, setForm]             = useState({ valorPlan: '', monto: '', metodo: '', fecha: hoyLocal(), notas: '' })
  const [guardando, setGuardando]   = useState(false)
  const [errorPago, setErrorPago]   = useState('')
  const [aviso, setAviso]           = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true)
    const { data: s } = await supabase.from('sedes').select('id, nombre')
    // Traer todos los planes desde el corte (por páginas de 1000)
    const todos: any[] = []
    for (let desde = 0; ; desde += 1000) {
      const { data } = await supabase.from('contratos')
        .select('id, sede_id, fecha_inicio, total_clases, clases_tomadas, duracion_min, valor_plan, estado, clientes(nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre)')
        .gte('fecha_inicio', CORTE_PAGOS)
        .order('fecha_inicio', { ascending: true })
        .range(desde, desde + 999)
      todos.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    const pagado = await pagadoPorPlan(todos.map(p => p.id))
    const lista: Plan[] = todos
      .filter(p => tieneSaldo(p, pagado[p.id] || 0))
      .map(p => {
        const cl = p.clientes
        return {
          id: p.id,
          sedeId: p.sede_id || 'sin-sede',
          cliente: cl?.nombre || `${cl?.nombres || ''} ${cl?.apellidos || ''}`.trim() || '—',
          instrumento: p.instrumentos?.nombre || '—',
          profesor: p.profesores?.nombre || '—',
          inicio: p.fecha_inicio || '',
          total: Number(p.total_clases || 0),
          tomadas: Number(p.clases_tomadas || 0),
          duracion: p.duracion_min || null,
          valor: Number(p.valor_plan || 0),
          pagado: pagado[p.id] || 0,
          estado: p.estado,
        }
      })
    const ordenadas = [...(s || [])].sort((a: any, b: any) => {
      const ia = ORDEN_SEDES.findIndex(k => normalizar(a.nombre).includes(k))
      const ib = ORDEN_SEDES.findIndex(k => normalizar(b.nombre).includes(k))
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    if (lista.some(p => p.sedeId === 'sin-sede')) ordenadas.push({ id: 'sin-sede', nombre: 'Sin sede' })
    setSedes(ordenadas)
    setPlanes(lista)
    setSedeSel(prev => prev || ordenadas[0]?.id || '')
    setCargando(false)
  }

  const deSede = planes.filter(p => p.sedeId === sedeSel)
  const adeudado = deSede.reduce((t, p) => t + Math.max(p.valor - p.pagado, 0), 0)
  const sinValor = deSede.filter(p => p.valor === 0).length

  const etiquetaEstado = (e: string) => e === 'activo' ? null : (
    <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#64748b', marginLeft: '6px' }}>
      {e === 'completado' ? 'Completado' : e === 'archivado' ? 'Archivado' : e}
    </span>
  )
  function abrirPago(p: Plan) {
    setAPagar(p)
    setErrorPago('')
    setForm({
      valorPlan: '',
      monto: p.valor > 0 ? String(Math.max(p.valor - p.pagado, 0)) : '',
      metodo: '',
      fecha: hoyLocal(),
      notas: '',
    })
  }

  async function guardarPago() {
    if (!aPagar) return
    const sinValor = aPagar.valor === 0
    const valorPlan = Number(form.valorPlan)
    const monto = Number(form.monto)
    if (sinValor && !(valorPlan > 0)) { setErrorPago('Ingresa el valor del plan.'); return }
    if (!(monto > 0)) { setErrorPago('Ingresa un monto mayor a 0.'); return }
    if (!form.metodo) { setErrorPago('Selecciona la cuenta del pago.'); return }
    if (!form.fecha) { setErrorPago('Selecciona la fecha del pago.'); return }
    setGuardando(true); setErrorPago('')
    const r = await registrarPago({
      contratoId: aPagar.id, monto, metodo: form.metodo, fecha: form.fecha, notas: form.notas,
      valorPlan: sinValor ? valorPlan : null, via: 'inicio',
    })
    setGuardando(false)
    if (!r.ok) { setErrorPago(r.mensaje); return }
    setAPagar(null)
    setAviso(r.mensaje); setTimeout(() => setAviso(''), 2500)
    await cargar(true)
  }

  const botonPago = (p: Plan) => (
    <button onClick={() => abrirPago(p)}
      style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${COLORES.header}`, background: 'white', color: COLORES.header, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      Registrar pago
    </button>
  )

  const valorTxt = (p: Plan) => p.valor === 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Sin valor</span> : formatPesos(p.valor)

  return (
    <SeccionInicio titulo="Planes sin pago" colores={COLORES} esMovil={esMovil} anchoCompleto
      cantidad={cargando ? null : planes.length}>
      {cargando ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Cargando...</p>
      ) : (
        <div>
          {/* Selector de sede */}
          <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', flexWrap: 'wrap' }}>
            {sedes.map(s => {
              const activo = s.id === sedeSel
              const n = planes.filter(p => p.sedeId === s.id).length
              return (
                <button key={s.id} onClick={() => setSedeSel(s.id)}
                  style={{ flex: esMovil ? 1 : 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${activo ? COLORES.header : COLORES.border}`, background: activo ? COLORES.header : 'white', color: activo ? 'white' : COLORES.header }}>
                  {s.nombre} · {n}
                </button>
              )
            })}
          </div>

          {/* Total adeudado */}
          <div style={{ padding: '0 16px 12px', textAlign: 'left', fontSize: '13px', color: '#4b5563' }}>
            Total adeudado: <b style={{ color: COLORES.header }}>{formatPesos(adeudado)}</b>
            {sinValor > 0 && <span> · {sinValor} plan{sinValor !== 1 ? 'es' : ''} sin valor</span>}
          </div>

          {deSede.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '20px', fontSize: '13px', margin: 0, borderTop: '1px solid #f1f5f9' }}>✓ Sin planes pendientes de pago</p>
          ) : esMovil ? (
            <div>
              {deSede.map((p, i) => (
                <div key={p.id} style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.cliente}{etiquetaEstado(p.estado)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fechaCorta(p.inicio)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>{p.instrumento} · {p.profesor}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '2px', fontSize: '12px' }}>
                    <span style={{ color: '#6b7280' }}>Clases {num(p.tomadas)}/{num(p.total)} · {p.duracion || '—'} min</span>
                    <span style={{ color: '#1f2937', whiteSpace: 'nowrap' }}>{formatPesos(p.pagado)} de {valorTxt(p)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>{botonPago(p)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0 }}>
                    {['Cliente', 'Inicio', 'Instrumento', 'Profesor', 'Clases', 'Duración', 'Valor', 'Pagado', ''].map((h, i) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: i >= 4 ? 'right' : 'left', fontWeight: 700, background: '#f8fafc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deSede.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a1a1a' }}>{p.cliente}{etiquetaEstado(p.estado)}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', whiteSpace: 'nowrap' }}>{fechaCorta(p.inicio)}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563' }}>{p.instrumento}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563' }}>{p.profesor}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', textAlign: 'right', whiteSpace: 'nowrap' }}>{num(p.tomadas)}/{num(p.total)}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.duracion || '—'} min</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{valorTxt(p)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: p.pagado === 0 ? '#dc2626' : '#1f2937', fontWeight: 600 }}>{formatPesos(p.pagado)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>{botonPago(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Ventana: registrar pago */}
      {aPagar && (() => {
        const sinValor = aPagar.valor === 0
        const valorRef = sinValor ? Number(form.valorPlan || 0) : aPagar.valor
        const saldo = Math.max(valorRef - aPagar.pagado, 0)
        const monto = Number(form.monto || 0)
        const campo = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box' as const, background: 'white' }
        const etiqueta = { display: 'block', margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' as const }
        return (
          <div onClick={() => !guardando && setAPagar(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'left' }}>
              <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>Registrar pago</p>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
                {aPagar.cliente} · {aPagar.instrumento}<br />
                {sinValor ? 'Plan sin valor definido' : <>Valor {formatPesos(aPagar.valor)} · Pagado {formatPesos(aPagar.pagado)} · <b>Saldo {formatPesos(saldo)}</b></>}
              </p>

              {sinValor && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={etiqueta}>Valor del plan</label>
                  <input type="number" inputMode="numeric" min="0" value={form.valorPlan} placeholder="Ej. 400000"
                    onChange={e => setForm(f => ({ ...f, valorPlan: e.target.value }))} style={campo} />
                  {Number(form.valorPlan) > 0 && <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>{formatPesos(Number(form.valorPlan))}</p>}
                </div>
              )}

              <div style={{ marginBottom: '12px' }}>
                <label style={etiqueta}>Monto</label>
                <input type="number" inputMode="numeric" min="0" value={form.monto}
                  onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={campo} />
                {monto > 0 && (
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: valorRef > 0 && monto > saldo ? '#b45309' : '#64748b' }}>
                    {formatPesos(monto)}{valorRef > 0 && monto > saldo ? ' · supera el saldo pendiente' : ''}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={etiqueta}>Cuenta</label>
                <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))} style={campo}>
                  <option value="" disabled>Selecciona la cuenta...</option>
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

              {errorPago && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>{errorPago}</p>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button disabled={guardando} onClick={() => setAPagar(null)}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button disabled={guardando} onClick={guardarPago}
                  style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: COLORES.header, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
                  {guardando ? 'Guardando...' : 'Registrar pago'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {aviso && (
        <div style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 1001, padding: '12px 18px', borderRadius: '12px',
          fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', background: '#dcfce7', color: '#166534' }}>
          {aviso}
        </div>
      )}
    </SeccionInicio>
  )
}
