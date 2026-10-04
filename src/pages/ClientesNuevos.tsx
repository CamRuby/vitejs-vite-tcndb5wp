// src/pages/ClientesNuevos.tsx
// Inicio → Clientes nuevos del mes (con selector de mes). Del más reciente al más antiguo.
// Por cliente: fecha de registro y nombre. Debajo, una línea por plan:
//   sede · N clases · duración · profesor · "p" roja si tiene saldo pendiente.
// Si no tiene plan: "Sin plan".

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import SeccionInicio from './SeccionInicio'
import { tieneSaldo, pagadoPorPlan } from '../utils/saldoPlan'

const MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const COLORES = { header: '#166534', headerBg: '#dcfce7', border: '#bbf7d0' }

function opcionesMes(): { valor: string; etiqueta: string }[] {
  const hoy = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    return { valor: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, etiqueta: `${MESES_L[d.getMonth()]} ${d.getFullYear()}` }
  })
}

function formatClases(n: any): string {
  const v = Number(n || 0)
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '')
}

export default function ClientesNuevos({ esMovil, onNavegar }: { esMovil: boolean; onNavegar: (s: string) => void }) {
  const [mes, setMes] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [clientes, setClientes]   = useState<any[]>([])
  const [planes, setPlanes]       = useState<Record<string, any[]>>({})
  const [pagado, setPagado]       = useState<Record<string, number>>({})
  const [cargando, setCargando]   = useState(true)

  useEffect(() => { cargar(mes) }, [mes])

  async function cargar(m: string) {
    setCargando(true)
    const [year, month] = m.split('-').map(Number)
    const ultimoDia = new Date(year, month, 0).getDate()
    const desde = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
    const hasta = `${year}-${String(month).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}T23:59:59`
    const { data: cl } = await supabase
      .from('clientes')
      .select('id, nombre, nombres, apellidos, created_at')
      .gte('created_at', desde).lte('created_at', hasta)
      .order('created_at', { ascending: false })
    const ids = (cl || []).map((c: any) => c.id)
    const mapa: Record<string, any[]> = {}
    let pg: Record<string, number> = {}
    if (ids.length) {
      const { data: ct } = await supabase
        .from('contratos')
        .select('id, cliente_id, fecha_inicio, total_clases, duracion_min, valor_plan, cobro_en_otro_plan, estado, sedes(nombre), profesores(nombre), instrumentos(nombre)')
        .in('cliente_id', ids)
        .neq('estado', 'archivado')
        .order('fecha_inicio', { ascending: true })
      ;(ct || []).forEach((p: any) => { (mapa[p.cliente_id] ||= []).push(p) })
      pg = await pagadoPorPlan((ct || []).map((p: any) => p.id))
    }
    setClientes(cl || [])
    setPlanes(mapa)
    setPagado(pg)
    setCargando(false)
  }

  const selector = (
    <select value={mes} onChange={e => setMes(e.target.value)}
      style={{ padding: '5px 8px', borderRadius: '8px', border: `1px solid ${COLORES.border}`, fontSize: '12px', background: 'white', color: COLORES.header, fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
      {opcionesMes().map(op => <option key={op.valor} value={op.valor}>{op.etiqueta}</option>)}
    </select>
  )

  return (
    <SeccionInicio titulo="Clientes nuevos" colores={COLORES} esMovil={esMovil}
      cantidad={cargando ? null : clientes.length} extraEncabezado={selector}>
      {cargando ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Cargando...</p>
      ) : clientes.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Sin clientes nuevos este mes</p>
      ) : (
        <div style={{ maxHeight: esMovil ? 'none' : '420px', overflowY: 'auto' }}>
          {clientes.map((c: any, i: number) => {
            const nombre = c.nombre || `${c.nombres || ''} ${c.apellidos || ''}`.trim() || '—'
            const f = new Date(c.created_at)
            const fecha = `${f.getDate()} ${MESES_L[f.getMonth()].slice(0, 3)}`
            const lista = planes[c.id] || []
            return (
              <div key={c.id} onClick={() => onNavegar('clientes')}
                style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: COLORES.header, whiteSpace: 'nowrap', width: '48px', flexShrink: 0 }}>{fecha}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                </div>
                {lista.length === 0 ? (
                  <p style={{ margin: '2px 0 0 58px', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Sin plan</p>
                ) : lista.map((p: any) => (
                  <p key={p.id} style={{ margin: '2px 0 0 58px', fontSize: '12px', color: '#6b7280', display: 'flex', gap: '6px', alignItems: 'baseline' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.sedes?.nombre || 'Sin sede'} · {formatClases(p.total_clases)} clases · {p.duracion_min || '—'} min · {p.profesores?.nombre || '—'}
                    </span>
                    {tieneSaldo(p, pagado[p.id] || 0) && (
                      <span title="Plan con saldo pendiente" style={{ fontSize: '13px', fontWeight: 800, color: '#dc2626', flexShrink: 0 }}>p</span>
                    )}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </SeccionInicio>
  )
}
