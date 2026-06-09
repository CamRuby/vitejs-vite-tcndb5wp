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
  fecha_fin_real: string | null
  estado: string
  total_clases: number
  duracion_min: number
  clases_tomadas: number
  conteo_whatsapp: number | null
  valor_plan: number | null
  total_pagado: number
  saldo: number
}

interface ClasePlan {
  id: string
  fecha: string
  hora: string
  estado: string
  cancelado_por_academia: boolean | null
  es_cortesia: boolean
  cancelado_tarde: boolean | null
  profesor_nombre: string
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

function etiquetaClase(c: ClasePlan): { label: string; color: string; bg: string } {
  if (c.es_cortesia && c.estado === 'cancelada' && !c.cancelado_por_academia) return { label: 'Inasist. perdonada', color: '#7c3aed', bg: '#f3e8ff' }
  if (c.es_cortesia) return { label: 'Cortesía', color: '#0369a1', bg: '#e0f2fe' }
  if (c.estado === 'dada') return { label: 'Dada', color: '#854d0e', bg: '#fefce8' }
  if (c.estado === 'confirmada') return { label: 'Confirmada', color: '#166534', bg: '#dcfce7' }
  if (c.estado === 'cancelada' && !c.cancelado_por_academia) return { label: 'Inasistencia', color: '#c2410c', bg: '#fff7ed' }
  if (c.estado === 'cancelada') return { label: 'Cancelada', color: '#991b1b', bg: '#fee2e2' }
  return { label: c.estado, color: '#64748b', bg: '#f1f5f9' }
}

export default function Reportes({ rol }: { rol?: string }) {
  return <ReporteControlPagos rol={rol} />
}

function ReporteControlPagos({ rol }: { rol?: string }) {
  const hoy = new Date()

  const [datos, setDatos] = useState<PlanControl[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [filtroEstado, setFiltroEstado] = useState<'activo' | 'archivado'>('activo')
  const [filtroMesInicio, setFiltroMesInicio] = useState<string>('')
  const [filtroSede, setFiltroSede] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Detalle expandido
  const [expandido, setExpandido] = useState<string | null>(null)
  const [clasesPlan, setClasesPlan] = useState<Record<string, ClasePlan[]>>({})
  const [abonosPlan, setAbonosPlan] = useState<Record<string, Abono[]>>({})
  const [cargandoDetalle, setCargandoDetalle] = useState(false)

  useEffect(() => { cargarSedes(); cargarDatos() }, [])

  async function cargarSedes() {
    const { data } = await supabase.from('sedes').select('id, nombre').order('nombre')
    setSedes(data || [])
  }

  async function cargarDatos() {
    setCargando(true); setError(null)
    try {
      const { data: contratos, error: err } = await supabase
        .from('contratos')
        .select(`
          id, cliente_id, sede_id, estado, fecha_inicio, fecha_fin,
          total_clases, duracion_min, clases_tomadas, conteo_whatsapp, valor_plan,
          clientes(nombre, grupo_whatsapp),
          sedes(nombre),
          instrumentos(nombre),
          profesores(nombre)
        `)
        .in('estado', ['activo', 'archivado', 'completado'])
        .order('fecha_inicio', { ascending: false })

      if (err) throw err

      // Cargar pagos de todos los contratos
      const ids = (contratos || []).map((c: any) => c.id)
      let pagosMap: Record<string, number> = {}
      if (ids.length > 0) {
        const { data: pagos } = await supabase.from('pagos').select('contrato_id, monto').in('contrato_id', ids)
        ;(pagos || []).forEach((p: any) => { pagosMap[p.contrato_id] = (pagosMap[p.contrato_id] || 0) + Number(p.monto) })
      }

      // Cargar última clase por contrato para fecha_fin_real
      let ultimaClaseMap: Record<string, string> = {}
      if (ids.length > 0) {
        const { data: clases } = await supabase
          .from('clases')
          .select('contrato_id, fecha')
          .in('contrato_id', ids)
          .order('fecha', { ascending: false })
        ;(clases || []).forEach((c: any) => {
          if (!ultimaClaseMap[c.contrato_id]) ultimaClaseMap[c.contrato_id] = c.fecha
        })
      }

      const filas: PlanControl[] = (contratos || []).map((c: any) => {
        const pagado = pagosMap[c.id] || 0
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
          fecha_fin_real: ultimaClaseMap[c.id] || c.fecha_fin || null,
          estado: c.estado,
          total_clases: Number(c.total_clases || 0),
          duracion_min: Number(c.duracion_min || 0),
          clases_tomadas: Number(c.clases_tomadas || 0),
          conteo_whatsapp: c.conteo_whatsapp !== null ? Number(c.conteo_whatsapp) : null,
          valor_plan: valor || null,
          total_pagado: pagado,
          saldo: valor - pagado,
        }
      })

      setDatos(filas)
    } catch (e) {
      setError('No se pudieron cargar los datos.')
    } finally {
      setCargando(false)
    }
  }

  async function cargarDetalle(planId: string) {
    if (clasesPlan[planId] && abonosPlan[planId]) return
    setCargandoDetalle(true)
    const [{ data: clases }, { data: abonos }] = await Promise.all([
      supabase.from('clases')
        .select('id, fecha, hora, estado, cancelado_por_academia, cancelado_tarde, es_cortesia, profesores(nombre)')
        .eq('contrato_id', planId)
        .order('fecha', { ascending: false }),
      supabase.from('pagos')
        .select('id, fecha, monto, metodo')
        .eq('contrato_id', planId)
        .order('fecha', { ascending: false })
    ])
    setClasesPlan(prev => ({
      ...prev,
      [planId]: (clases || []).map((c: any) => ({
        id: c.id, fecha: c.fecha,
        hora: c.hora?.substring(0, 5) || '—',
        estado: c.estado,
        cancelado_por_academia: c.cancelado_por_academia,
        cancelado_tarde: c.cancelado_tarde,
        es_cortesia: c.es_cortesia || false,
        profesor_nombre: c.profesores?.nombre || '—',
      }))
    }))
    setAbonosPlan(prev => ({
      ...prev,
      [planId]: (abonos || []).map((a: any) => ({
        id: a.id, fecha: a.fecha,
        monto: Number(a.monto),
        metodo: a.metodo || '—',
      }))
    }))
    setCargandoDetalle(false)
  }

  async function toggleExpandido(planId: string) {
    if (expandido === planId) { setExpandido(null); return }
    setExpandido(planId)
    await cargarDetalle(planId)
  }

  // Filtrado
  const filtrados = datos.filter(d => {
    if (d.estado !== filtroEstado && !(filtroEstado === 'activo' && d.estado === 'completado')) return false
    if (filtroSede && d.sede_id !== filtroSede) return false
    if (filtroMesInicio) {
      const [anio, mes] = filtroMesInicio.split('-')
      if (!d.fecha_inicio) return false
      const fi = d.fecha_inicio.substring(0, 7)
      if (fi !== `${anio}-${mes}`) return false
    }
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!d.cliente_nombre.toLowerCase().includes(q) &&
          !(d.grupo_whatsapp || '').toLowerCase().includes(q) &&
          !d.instrumento_nombre.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Totales
  const totalValor = filtrados.reduce((s, d) => s + (d.valor_plan || 0), 0)
  const totalPagado = filtrados.reduce((s, d) => s + d.total_pagado, 0)
  const totalSaldo = filtrados.reduce((s, d) => s + d.saldo, 0)

  // Opciones de mes para filtro
  const mesesDisponibles = Array.from(new Set(
    datos.filter(d => d.fecha_inicio).map(d => d.fecha_inicio!.substring(0, 7))
  )).sort().reverse()

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: TEAL_DARK, margin: '0 0 4px' }}>💳 Control de pago de planes</h2>
        <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Seguimiento de pagos, saldos y clases por plan</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Estado */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', gap: '2px' }}>
          {([{ k: 'activo', l: '🟢 Activos' }, { k: 'archivado', l: '📦 Archivados' }] as const).map(f => (
            <button key={f.k} onClick={() => setFiltroEstado(f.k)}
              style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: 'none', background: filtroEstado === f.k ? TEAL : 'transparent', color: filtroEstado === f.k ? 'white' : TEAL_DARK }}>
              {f.l}
            </button>
          ))}
        </div>

        {/* Sede */}
        <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${filtroSede ? TEAL : TEAL_MID}`, background: filtroSede ? TEAL_LIGHT : 'white', color: filtroSede ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">🏢 Todas las sedes</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        {/* Mes inicio */}
        <select value={filtroMesInicio} onChange={e => setFiltroMesInicio(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${filtroMesInicio ? TEAL : TEAL_MID}`, background: filtroMesInicio ? TEAL_LIGHT : 'white', color: filtroMesInicio ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">📅 Todos los meses</option>
          {mesesDisponibles.map(m => {
            const [anio, mes] = m.split('-')
            return <option key={m} value={m}>{MESES[parseInt(mes) - 1]} {anio}</option>
          })}
        </select>

        {/* Buscador */}
        <input type="text" placeholder="🔍 Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 14px', borderRadius: '20px', border: `1.5px solid ${busqueda ? TEAL : TEAL_MID}`, fontSize: '12px', outline: 'none', minWidth: '200px', marginLeft: 'auto' }} />
      </div>

      {/* Totales */}
      {!cargando && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Planes', valor: filtrados.length, color: TEAL, fmt: false },
            { label: 'Valor total', valor: totalValor, color: '#7c3aed', fmt: true },
            { label: 'Total pagado', valor: totalPagado, color: '#16a34a', fmt: true },
            { label: 'Saldo pendiente', valor: totalSaldo, color: totalSaldo > 0 ? '#dc2626' : '#16a34a', fmt: true },
          ].map(t => (
            <div key={t.label} style={{ background: 'white', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: t.color }}>
                {t.fmt ? `$${Number(t.valor).toLocaleString('es-CO')}` : t.valor}
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {cargando && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando datos…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}

      {!cargando && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999', background: 'white', borderRadius: '12px', border: `1px solid ${TEAL_MID}` }}>
              No hay planes con los filtros seleccionados.
            </div>
          )}
          {filtrados.map(plan => {
            const exp = expandido === plan.id
            const saldoColor = plan.saldo > 0 ? '#dc2626' : plan.saldo < 0 ? '#7c3aed' : '#16a34a'
            const saldoBg = plan.saldo > 0 ? '#fef2f2' : plan.saldo < 0 ? '#f3e8ff' : '#f0fdf4'
            const clases = clasesPlan[plan.id] || []
            const abonos = abonosPlan[plan.id] || []

            return (
              <div key={plan.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${exp ? TEAL_MID : '#e5e7eb'}`, overflow: 'hidden', boxShadow: exp ? '0 2px 12px rgba(26,138,138,0.08)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Fila principal clickeable */}
                <div onClick={() => toggleExpandido(plan.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }}>

                  {/* Columna izquierda: cliente + info */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    {/* Estado badge */}
                    {plan.estado === 'activo'
                      ? <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#166534', flexShrink: 0 }}>🟢 Activo</span>
                      : plan.estado === 'completado'
                      ? <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', flexShrink: 0 }}>✅ Completado</span>
                      : <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#64748b', flexShrink: 0 }}>
                          {plan.fecha_fin_real ? plan.fecha_fin_real.substring(0, 7) : 'Archivado'}
                        </span>
                    }

                    {/* Nombre cliente */}
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{plan.cliente_nombre}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{plan.grupo_whatsapp || '—'}</span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>· {plan.sede_nombre}</span>

                    {/* Info plan inline */}
                    <span style={{ fontSize: '11px', color: '#6b7280', background: '#f8fafc', padding: '2px 8px', borderRadius: '20px', border: '1px solid #e5e7eb', flexShrink: 0 }}>
                      {plan.instrumento_nombre} · {plan.profesor_nombre}
                    </span>

                    {/* Fechas */}
                    {plan.fecha_inicio && (
                      <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                        {plan.fecha_inicio.substring(0, 7)} → {plan.fecha_fin_real ? plan.fecha_fin_real : '—'}
                      </span>
                    )}
                  </div>

                  {/* Columna derecha: métricas */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {/* Clases tomadas */}
                    <div style={{ textAlign: 'center', minWidth: '52px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: TEAL_DARK }}>
                        {Math.round(plan.clases_tomadas)}/{plan.total_clases}
                        {plan.conteo_whatsapp !== null && (
                          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}> ({plan.conteo_whatsapp})</span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>{plan.duracion_min}m</div>
                    </div>

                    {/* Valor */}
                    <div style={{ textAlign: 'center', minWidth: '72px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#374151' }}>
                        {plan.valor_plan ? `$${plan.valor_plan.toLocaleString('es-CO')}` : '—'}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>valor</div>
                    </div>

                    {/* Pagado */}
                    <div style={{ textAlign: 'center', minWidth: '72px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>
                        ${plan.total_pagado.toLocaleString('es-CO')}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>pagado</div>
                    </div>

                    {/* Saldo */}
                    <div style={{ background: saldoBg, borderRadius: '8px', padding: '6px 12px', textAlign: 'center', minWidth: '72px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: saldoColor }}>
                        {plan.saldo === 0 ? '✓ $0' : plan.saldo > 0 ? `-$${plan.saldo.toLocaleString('es-CO')}` : `+$${Math.abs(plan.saldo).toLocaleString('es-CO')}`}
                      </div>
                      <div style={{ fontSize: '10px', color: '#9ca3af' }}>saldo</div>
                    </div>

                    {/* Chevron */}
                    <span style={{ fontSize: '14px', color: TEAL_MID, transition: 'transform 0.2s', transform: exp ? 'rotate(180deg)' : 'none' }}>▼</span>
                  </div>
                </div>

                {/* Panel expandido */}
                {exp && (
                  <div style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: '#fafcfc' }}>
                    {cargandoDetalle && !clases.length ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Cargando...</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0' }}>

                        {/* Panel clases */}
                        <div style={{ padding: '16px', borderRight: `1px solid ${TEAL_LIGHT}` }}>
                          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: TEAL_DARK, letterSpacing: '0.5px' }}>
                            CLASES ({clases.length})
                          </p>
                          {clases.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Sin clases registradas</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                              {clases.map(c => {
                                const et = etiquetaClase(c)
                                return (
                                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '8px', background: 'white', border: '1px solid #f1f5f9' }}>
                                    <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', minWidth: '72px' }}>{c.fecha}</span>
                                    <span style={{ fontSize: '11px', color: '#6b7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.profesor_nombre}</span>
                                    <span style={{ padding: '2px 7px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, background: et.bg, color: et.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{et.label}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Panel abonos */}
                        <div style={{ padding: '16px' }}>
                          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: TEAL_DARK, letterSpacing: '0.5px' }}>
                            ABONOS ({abonos.length})
                          </p>
                          {abonos.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Sin abonos registrados</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
                              {abonos.map(a => (
                                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '8px', background: 'white', border: '1px solid #f1f5f9' }}>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', minWidth: '72px' }}>{a.fecha}</span>
                                  <span style={{ fontSize: '11px', color: '#6b7280', flex: 1 }}>{a.metodo}</span>
                                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>${a.monto.toLocaleString('es-CO')}</span>
                                </div>
                              ))}
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', borderTop: `1px solid ${TEAL_LIGHT}`, marginTop: '4px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#374151' }}>Total pagado</span>
                                <span style={{ fontSize: '12px', fontWeight: 800, color: '#16a34a' }}>${plan.total_pagado.toLocaleString('es-CO')}</span>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!cargando && !error && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af', textAlign: 'right' }}>
          {filtrados.length} planes · ${totalPagado.toLocaleString('es-CO')} recaudado · saldo ${totalSaldo.toLocaleString('es-CO')}
        </div>
      )}
    </div>
  )
}
