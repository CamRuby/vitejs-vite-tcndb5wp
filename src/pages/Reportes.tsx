import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

interface Sede { id: string; nombre: string }

interface PlanControl {
  id: string
  cliente_id: string
  cliente_nombre: string
  grupo_whatsapp: string | null
  sede_id: string | null
  sede_nombre: string
  instrumento_nombre: string
  profesor_nombre: string
  fecha_inicio: string | null
  estado: string
  total_clases: number
  duracion_min: number
  clases_tomadas: number
  conteo_whatsapp: number | null
  valor_plan: number | null
  total_pagado: number
  saldo: number
  abonos: Abono[]
}

interface Abono {
  id: string
  fecha: string
  monto: number
  metodo: string | null
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
]

function mesActual(): string {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}

export default function Reportes({ rol }: { rol?: string }) {
  return <ReporteControlPagos />
}

function ReporteControlPagos() {
  const [datos, setDatos] = useState<PlanControl[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mes, setMes] = useState(mesActual())
  const [filtroSede, setFiltroSede] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => { cargarSedes() }, [])
  useEffect(() => { cargarDatos() }, [mes])

  async function cargarSedes() {
    const { data } = await supabase.from('sedes').select('id, nombre').order('nombre')
    setSedes(data || [])
  }

  async function cargarDatos() {
    setCargando(true); setError(null)
    try {
      const fechaInicio = `${mes}-01`
      const [anio, mesNum] = mes.split('-')
      const ultimoDia = new Date(parseInt(anio), parseInt(mesNum), 0).getDate()
      const fechaFin = `${mes}-${String(ultimoDia).padStart(2, '0')}`

      const { data: contratos, error: err } = await supabase
        .from('contratos')
        .select(`
          id, cliente_id, sede_id, estado, fecha_inicio,
          total_clases, duracion_min, clases_tomadas, conteo_whatsapp, valor_plan,
          clientes(nombre, grupo_whatsapp),
          sedes(nombre),
          instrumentos(nombre),
          profesores(nombre)
        `)
        .eq('estado', 'activo')
        .gte('fecha_inicio', fechaInicio)
        .lte('fecha_inicio', fechaFin)
        .order('fecha_inicio', { ascending: true })

      if (err) throw err

      const ids = (contratos || []).map((c: any) => c.id)
      let pagosMap: Record<string, Abono[]> = {}
      if (ids.length > 0) {
        const { data: pagos } = await supabase
          .from('pagos')
          .select('id, contrato_id, fecha, monto, metodo')
          .in('contrato_id', ids)
          .order('fecha', { ascending: true })
        ;(pagos || []).forEach((p: any) => {
          if (!pagosMap[p.contrato_id]) pagosMap[p.contrato_id] = []
          pagosMap[p.contrato_id].push({ id: p.id, fecha: p.fecha, monto: Number(p.monto), metodo: p.metodo || '—' })
        })
      }

      const filas: PlanControl[] = (contratos || []).map((c: any) => {
        const abonos = pagosMap[c.id] || []
        const pagado = abonos.reduce((s, a) => s + a.monto, 0)
        const valor = c.valor_plan ? Number(c.valor_plan) : 0
        return {
          id: c.id,
          cliente_id: c.cliente_id,
          cliente_nombre: c.clientes?.nombre || '—',
          grupo_whatsapp: c.clientes?.grupo_whatsapp || null,
          sede_id: c.sede_id,
          sede_nombre: c.sedes?.nombre || '—',
          instrumento_nombre: c.instrumentos?.nombre || '—',
          profesor_nombre: c.profesores?.nombre || '—',
          fecha_inicio: c.fecha_inicio,
          estado: c.estado,
          total_clases: Number(c.total_clases || 0),
          duracion_min: Number(c.duracion_min || 0),
          clases_tomadas: Number(c.clases_tomadas || 0),
          conteo_whatsapp: c.conteo_whatsapp !== null ? Number(c.conteo_whatsapp) : null,
          valor_plan: valor || null,
          total_pagado: pagado,
          saldo: valor - pagado,
          abonos,
        }
      })

      setDatos(filas)
    } catch {
      setError('No se pudieron cargar los datos.')
    } finally {
      setCargando(false)
    }
  }

  const filtrados = datos.filter(d => {
    if (filtroSede && d.sede_id !== filtroSede) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!d.cliente_nombre.toLowerCase().includes(q) &&
          !(d.grupo_whatsapp || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalValor = filtrados.reduce((s, d) => s + (d.valor_plan || 0), 0)
  const totalPagado = filtrados.reduce((s, d) => s + d.total_pagado, 0)
  const totalSaldo = filtrados.reduce((s, d) => s + d.saldo, 0)

  const [anioSel, mesSel] = mes.split('-')
  const labelMes = `${MESES[parseInt(mesSel) - 1]} ${anioSel}`

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: '0 0 2px' }}>💳 Control de pagos</h2>
          <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Planes iniciados en {labelMes}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '10px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', fontWeight: 600, color: TEAL_DARK, outline: 'none', background: TEAL_LIGHT }} />
          <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${filtroSede ? TEAL : TEAL_MID}`, background: filtroSede ? TEAL_LIGHT : 'white', color: filtroSede ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
            <option value="">🏢 Todas las sedes</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <input type="text" placeholder="🔍 Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ padding: '7px 12px', borderRadius: '10px', border: `1.5px solid ${busqueda ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', minWidth: '180px' }} />
        </div>
      </div>

      {/* Totales */}
      {!cargando && filtrados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Planes', valor: String(filtrados.length), color: TEAL },
            { label: 'Valor total', valor: `$${totalValor.toLocaleString('es-CO')}`, color: '#7c3aed' },
            { label: 'Recaudado', valor: `$${totalPagado.toLocaleString('es-CO')}`, color: '#16a34a' },
            { label: 'Saldo pendiente', valor: `$${totalSaldo.toLocaleString('es-CO')}`, color: totalSaldo > 0 ? '#dc2626' : '#16a34a' },
          ].map(t => (
            <div key={t.label} style={{ background: 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: t.color }}>{t.valor}</div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {cargando && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando...</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}

      {!cargando && !error && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', background: 'white', borderRadius: '12px', border: `1px solid ${TEAL_MID}` }}>
          No hay planes iniciados en {labelMes}.
        </div>
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(plan => {
            const saldoColor = plan.saldo > 0 ? '#dc2626' : plan.saldo < 0 ? '#7c3aed' : '#16a34a'
            const saldoBg = plan.saldo > 0 ? '#fef2f2' : plan.saldo < 0 ? '#f3e8ff' : '#f0fdf4'

            return (
              <div key={plan.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid #e5e7eb`, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr auto', gap: '20px', alignItems: 'start' }}>

                  {/* COLUMNA 1: Cliente */}
                  <div>
                    <p style={{ margin: '0 0 3px', fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{plan.cliente_nombre}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#9ca3af' }}>{plan.grupo_whatsapp || '—'}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{plan.sede_nombre}</p>
                  </div>

                  {/* COLUMNA 2: Info plan */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: '#dcfce7', color: '#166534' }}>🟢 Activo</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>Desde <strong style={{ color: '#374151' }}>{plan.fecha_inicio}</strong></span>
                    </div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
                      {plan.instrumento_nombre} · {plan.total_clases} clases de {plan.duracion_min} min
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#9ca3af' }}>
                      Tomadas: <strong style={{ color: TEAL_DARK }}>{Math.round(plan.clases_tomadas)}/{plan.total_clases}</strong>
                      {plan.conteo_whatsapp !== null && (
                        <span style={{ color: '#dc2626', fontWeight: 700 }}> ({plan.conteo_whatsapp} WA)</span>
                      )}
                    </p>
                  </div>

                  {/* COLUMNA 3: Pagos */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'start' }}>
                    {/* Cifras principales */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Valor</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#374151' }}>
                          {plan.valor_plan ? `$${plan.valor_plan.toLocaleString('es-CO')}` : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Pagado</span>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>
                          ${plan.total_pagado.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', background: saldoBg, borderRadius: '8px', padding: '4px 8px' }}>
                        <span style={{ fontSize: '12px', color: saldoColor, fontWeight: 600 }}>Saldo</span>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: saldoColor }}>
                          {plan.saldo === 0 ? '✓ $0' : plan.saldo > 0 ? `-$${plan.saldo.toLocaleString('es-CO')}` : `+$${Math.abs(plan.saldo).toLocaleString('es-CO')}`}
                        </span>
                      </div>
                    </div>

                    {/* Tablita abonos */}
                    {plan.abonos.length > 0 && (
                      <div style={{ borderLeft: `1px solid ${TEAL_LIGHT}`, paddingLeft: '14px', minWidth: '180px' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.5px' }}>ABONOS</p>
                        {plan.abonos.map(a => (
                          <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px' }}>
                            <span style={{ fontSize: '11px', color: '#b0b8c1', whiteSpace: 'nowrap' }}>{a.fecha.substring(5)}</span>
                            <span style={{ fontSize: '11px', color: '#b0b8c1', flex: 1 }}>{a.metodo}</span>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>${a.monto.toLocaleString('es-CO')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: '#9ca3af', textAlign: 'right' }}>
          {filtrados.length} planes · {labelMes}
        </div>
      )}
    </div>
  )
}
