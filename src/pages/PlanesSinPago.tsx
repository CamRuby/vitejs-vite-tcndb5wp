// src/pages/PlanesSinPago.tsx
// Inicio → Planes sin pago, por sede (Rosales, Chicó, Tunja).
// Entran: planes desde la fecha de corte, en cualquier estado, sin valor definido o con pagado < valor.
// Orden: del plan más antiguo (fecha de inicio) al más nuevo. Un cliente con 2 planes aparece 2 veces.
// Arriba: total adeudado de la sede.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import SeccionInicio from './SeccionInicio'
import { CORTE_PAGOS, tieneSaldo, pagadoPorPlan, formatPesos } from '../utils/saldoPlan'

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

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
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
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0 }}>
                    {['Cliente', 'Inicio', 'Instrumento', 'Profesor', 'Clases', 'Duración', 'Valor', 'Pagado'].map((h, i) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </SeccionInicio>
  )
}
