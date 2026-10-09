// src/pages/TalleresPorTaller.tsx
// Inicio → Talleres → "Por taller": talleres activos ordenados por su última sesión (la más reciente
// primero) y los archivados al final, plegados. Al tocar un taller: tabla por mes con sesiones dadas,
// ingreso, recaudado, honorarios y utilidad (cálculo en utils/utilidadTalleres). Desde el 1 jun 2026.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { CORTE_PAGOS, formatPesos } from '../utils/saldoPlan'
import { utilidadPorMes, totalFilas, type FilaMes } from '../utils/utilidadTalleres'

const C = { header: '#6d28d9', headerBg: '#f5f3ff', border: '#ddd6fe' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`
}
function pesos(n: number) { return n < 0 ? '-' + formatPesos(-n) : formatPesos(n) }
function nombreMes(k: string) {
  if (k === 'total') return 'Todo el vacacional'
  const [y, m] = k.split('-').map(Number)
  return `${MESES[m - 1]} ${y}`
}

async function todas(consulta: (desde: number) => any): Promise<any[]> {
  const out: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data } = await consulta(desde)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

type Fila = { t: any; ultima: string; activos: number; filas: FilaMes[]; total: FilaMes }

export default function TalleresPorTaller({ esMovil }: { esMovil: boolean }) {
  const [lista, setLista] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [verArchivados, setVerArchivados] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const hoy = new Date().toISOString().slice(0, 10)
    const [talleres, sesiones, inscripciones] = await Promise.all([
      todas(d => supabase.from('talleres').select('id, nombre, tipo, estado, dia_semana, hora, fecha_unica, fecha_fin_vacacional, profesores(nombre), salones(sedes(nombre))').order('nombre').range(d, d + 999)),
      todas(d => supabase.from('taller_sesiones').select('taller_id, fecha, estado, honorario_valor').gte('fecha', CORTE_PAGOS).order('fecha').range(d, d + 999)),
      todas(d => supabase.from('taller_inscripciones').select('id, taller_id, fecha_inicio, fecha_fin, valor_plan, estado').gte('fecha_inicio', CORTE_PAGOS).order('fecha_inicio').range(d, d + 999)),
    ])
    const ids = inscripciones.map((i: any) => i.id)
    const pagos: any[] = []
    for (let k = 0; k < ids.length; k += 200) {
      const { data } = await supabase.from('pagos').select('inscripcion_id, fecha, monto').in('inscripcion_id', ids.slice(k, k + 200))
      pagos.push(...(data || []))
    }
    const tallerDeIns: Record<string, string> = {}
    inscripciones.forEach((i: any) => { tallerDeIns[i.id] = i.taller_id })

    const filas: Fila[] = talleres.map((t: any) => {
      const ses = sesiones.filter((s: any) => s.taller_id === t.id)
      const ins = inscripciones.filter((i: any) => i.taller_id === t.id)
      const pg = pagos.filter((p: any) => tallerDeIns[p.inscripcion_id] === t.id)
      const dadas = ses.filter((s: any) => s.estado === 'dada').map((s: any) => s.fecha)
      const ultima = dadas.length ? dadas[dadas.length - 1] : ''
      const activos = ins.filter((i: any) => i.estado === 'activo' && (!i.fecha_fin || i.fecha_fin >= hoy)).length
      const fm = utilidadPorMes(t, ins, ses, pg)
      return { t, ultima, activos, filas: fm, total: totalFilas(fm) }
    }).filter((f: Fila) => f.filas.length > 0 || f.t.estado !== 'archivado')
    filas.sort((a, b) => (b.ultima || '').localeCompare(a.ultima || '') || a.t.nombre.localeCompare(b.t.nombre))
    setLista(filas)
    setCargando(false)
  }

  if (cargando) return <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Cargando…</p>

  const activos = lista.filter(f => f.t.estado !== 'archivado')
  const archivados = lista.filter(f => f.t.estado === 'archivado')
  const mesActual = new Date().toISOString().slice(0, 7)
  const delMes = activos.concat(archivados).reduce((t, f) => {
    const m = f.filas.find(x => x.mes === mesActual)
    return m ? { ingreso: t.ingreso + m.ingreso, honorarios: t.honorarios + m.honorarios, recaudado: t.recaudado + m.recaudado } : t
  }, { ingreso: 0, honorarios: 0, recaudado: 0 })

  const celda = (n: number, color = '#1f2937', bold = false) => (
    <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap', color, fontWeight: bold ? 700 : 400 }}>{pesos(n)}</td>
  )
  const tabla = (f: Fila) => (
    <div style={{ overflowX: 'auto', background: '#fafafa', borderTop: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '520px' }}>
        <thead>
          <tr style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {['Mes', 'Sesiones', 'Ingreso', 'Recaudado', 'Honorarios', 'Utilidad'].map((h, i) => (
              <th key={h} style={{ padding: '6px 10px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {f.filas.length === 0 && <tr><td colSpan={6} style={{ padding: '8px 10px', color: '#94a3b8' }}>Sin movimiento desde el 1 de junio</td></tr>}
          {f.filas.map(m => (
            <tr key={m.mes} style={{ borderTop: '1px solid #eef2f7' }}>
              <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{nombreMes(m.mes)}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right' }}>{m.sesiones}</td>
              {celda(m.ingreso)}{celda(m.recaudado, '#166534')}{celda(m.honorarios, '#b45309')}
              {celda(m.utilidad, m.utilidad < 0 ? '#dc2626' : C.header, true)}
            </tr>
          ))}
          {f.filas.length > 1 && (
            <tr style={{ borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
              <td style={{ padding: '6px 10px' }}>Total</td>
              <td style={{ padding: '6px 10px', textAlign: 'right' }}>{f.total.sesiones}</td>
              {celda(f.total.ingreso, '#1f2937', true)}{celda(f.total.recaudado, '#166534', true)}{celda(f.total.honorarios, '#b45309', true)}
              {celda(f.total.utilidad, f.total.utilidad < 0 ? '#dc2626' : C.header, true)}
            </tr>
          )}
        </tbody>
      </table>
      <p style={{ margin: 0, padding: '6px 10px 8px', fontSize: '11px', color: '#94a3b8' }}>
        Ingreso: valor acordado repartido entre las fechas del taller (cuenta aunque el inscrito no asista). Utilidad = ingreso − honorarios.
      </p>
    </div>
  )
  const fila = (f: Fila) => {
    const vac = f.t.tipo === 'vacacional' || !!f.t.fecha_unica
    const abiertoF = abierto === f.t.id
    return (
      <div key={f.t.id} style={{ borderTop: '1px solid #f1f5f9' }}>
        <div onClick={() => setAbierto(abiertoF ? null : f.t.id)}
          style={{ padding: '10px 16px', cursor: 'pointer', background: abiertoF ? C.headerBg : 'white', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{f.t.nombre}</span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Última sesión: {f.ultima ? fechaCorta(f.ultima) : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '2px', fontSize: '12px', color: '#6b7280', flexWrap: 'wrap' }}>
            <span>{vac ? 'Vacacional' : `Mensual · ${f.t.dia_semana || '—'}`} · {f.t.salones?.sedes?.nombre || '—'} · {f.t.profesores?.nombre || '—'} · {f.activos} activo{f.activos !== 1 ? 's' : ''}</span>
            <span>Utilidad total <b style={{ color: f.total.utilidad < 0 ? '#dc2626' : C.header }}>{pesos(f.total.utilidad)}</b></span>
          </div>
        </div>
        {abiertoF && tabla(f)}
      </div>
    )
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: '#4b5563', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <span style={{ textTransform: 'capitalize' }}><b>{nombreMes(mesActual)}</b>:</span>
        <span>Ingreso <b>{formatPesos(delMes.ingreso)}</b></span>
        <span>Recaudado <b style={{ color: '#166534' }}>{formatPesos(delMes.recaudado)}</b></span>
        <span>Honorarios <b style={{ color: '#b45309' }}>{formatPesos(delMes.honorarios)}</b></span>
        <span>Utilidad <b style={{ color: C.header }}>{pesos(delMes.ingreso - delMes.honorarios)}</b></span>
      </div>
      {activos.map(fila)}
      {archivados.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setVerArchivados(v => !v)}
            style={{ width: '100%', padding: '10px 16px', background: '#f8fafc', border: 'none', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}>
            {verArchivados ? '▴' : '▾'} Archivados ({archivados.length})
          </button>
          {verArchivados && archivados.map(fila)}
        </div>
      )}
      {esMovil && <div style={{ height: '4px' }} />}
    </div>
  )
}
