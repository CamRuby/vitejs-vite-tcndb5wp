import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL       = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID   = '#b2d8d8'

function fechaHoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function tiempoRelativo(fecha: string) {
  const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000)
  if (diff < 60)    return 'ahora'
  if (diff < 3600)  return `hace ${Math.floor(diff/60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`
  return `hace ${Math.floor(diff/86400)} d`
}

function iconoTipo(tipo: string): { emoji: string; color: string; bg: string; label: string } {
  if (tipo === 'cancelacion_tardia')   return { emoji: '⏰', color: '#dc2626', bg: '#fef2f2',  label: 'Cancelación tardía' }
  if (tipo === 'cancelacion_a_tiempo') return { emoji: '✓',  color: '#166534', bg: '#f0fdf4',  label: 'Cancelación a tiempo' }
  if (tipo === 'inasistencia')         return { emoji: '⚠️', color: '#c2410c', bg: '#fff7ed',  label: 'Inasistencia' }
  return { emoji: '📌', color: '#1d4ed8', bg: '#eff6ff', label: 'Novedad' }
}

const DIAS_L   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES_L  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export default function Inicio({ onNavegar, onNuevaNotificacion }: {
  onNavegar: (seccion: string) => void
  onNuevaNotificacion: () => void
}) {
  const [cargando, setCargando]             = useState(true)
  const [metricas, setMetricas]             = useState({ total: 0, confirmadas: 0, dadas: 0, novedades: 0 })
  const [novedades, setNovedades]           = useState<any[]>([])
  const [planesAlerta, setPlanesAlerta]     = useState<any[]>([])
  const [planesPorRenovar, setPlanesPorRenovar] = useState<any[]>([])
  const [planesSinIniciar, setPlanesSinIniciar] = useState<any[]>([])

  const hoy = new Date()
  const fechaHoy = fechaHoyLocal()
  const tituloFecha = `${DIAS_L[hoy.getDay()].charAt(0).toUpperCase() + DIAS_L[hoy.getDay()].slice(1)} ${hoy.getDate()} de ${MESES_L[hoy.getMonth()]}`

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    await Promise.all([cargarMetricas(), cargarNovedades(), cargarPlanesAlerta(), cargarPlanesPorRenovar(), cargarPlanesSinIniciar()])
    setCargando(false)
  }

  async function cargarMetricas() {
    const { data: clasesHoy } = await supabase
      .from('clases').select('estado')
      .eq('fecha', fechaHoy).neq('estado', 'cancelada')
    const total       = (clasesHoy || []).length
    const confirmadas = (clasesHoy || []).filter(c => c.estado === 'confirmada').length
    const dadas       = (clasesHoy || []).filter(c => c.estado === 'dada').length
    const { count: novedades } = await supabase
      .from('notificaciones').select('*', { count: 'exact', head: true }).eq('leida', false)
    setMetricas({ total, confirmadas, dadas, novedades: novedades || 0 })
  }

  async function cargarNovedades() {
    const { data } = await supabase
      .from('notificaciones').select('*')
      .order('created_at', { ascending: false }).limit(5)
    setNovedades(data || [])
  }

  async function cargarPlanesAlerta() {
    const { data } = await supabase
      .from('contratos')
      .select('id, total_clases, clases_tomadas, cliente_id, clientes(nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre)')
      .eq('estado', 'activo')
    if (!data) return
    const alertas = data.filter((p: any) => {
      const restantes = (p.total_clases || 0) - (p.clases_tomadas || 0)
      return restantes <= 2 && restantes > 0
    }).slice(0, 5)
    setPlanesAlerta(alertas)
  }

  async function cargarPlanesPorRenovar() {
    // Planes completados + planes activos con clases_tomadas >= total_clases
    const { data: completados } = await supabase
      .from('contratos')
      .select('id, total_clases, clases_tomadas, cliente_id, estado, clientes(nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre)')
      .eq('estado', 'completado')
      .order('fecha_inicio', { ascending: false })
      .limit(10)
    const { data: activos } = await supabase
      .from('contratos')
      .select('id, total_clases, clases_tomadas, cliente_id, estado, clientes(nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre)')
      .eq('estado', 'activo')
      .order('fecha_inicio', { ascending: false })
      .limit(50)
    // Filtrar activos donde clases_tomadas >= total_clases
    const activosCompletos = (activos || []).filter((p: any) =>
      p.total_clases > 0 && (p.clases_tomadas || 0) >= p.total_clases
    )
    const todos = [...(completados || []), ...activosCompletos]
    // Deduplicar por id
    const vistos = new Set<string>()
    const dedup = todos.filter((p: any) => { if (vistos.has(p.id)) return false; vistos.add(p.id); return true })
    setPlanesPorRenovar(dedup.slice(0, 6))
  }

  async function cargarPlanesSinIniciar() {
    // Planes activos con 0 clases tomadas
    const { data } = await supabase
      .from('contratos')
      .select('id, total_clases, clases_tomadas, fecha_inicio, cliente_id, clientes(nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre)')
      .eq('estado', 'activo')
      .eq('clases_tomadas', 0)
      .order('fecha_inicio', { ascending: true })
      .limit(6)
    setPlanesSinIniciar(data || [])
  }

  async function marcarLeida(id: string) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNovedades(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setMetricas(prev => ({ ...prev, novedades: Math.max(0, prev.novedades - 1) }))
    onNuevaNotificacion()
  }

  function nombreCliente(p: any) {
    return p.clientes?.nombre || `${p.clientes?.nombres || ''} ${p.clientes?.apellidos || ''}`.trim() || '—'
  }

  const tarjetaMetrica = (label: string, valor: number, color: string, bg: string) => (
    <div style={{ background: bg, borderRadius: '14px', padding: '18px 20px', border: `1px solid ${color}33`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <p style={{ margin: '0 0 6px', fontSize: '11px', color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '34px', fontWeight: '800', color, lineHeight: 1 }}>{valor}</p>
    </div>
  )

  // Colores por tarjeta — alineados con el sistema de colores existente
  const CARD_COLORS = {
    novedades:   { header: '#1d4ed8', headerBg: '#eff6ff', border: '#bfdbfe' },
    completar:   { header: '#c2410c', headerBg: '#fff7ed', border: '#fed7aa' },
    renovar:     { header: TEAL,       headerBg: TEAL_LIGHT,  border: TEAL_MID   },
    sinIniciar:  { header: '#7c3aed', headerBg: '#f3e8ff', border: '#d8b4fe' },
  }

  function tarjetaLista(
    titulo: string,
    subtitulo: string,
    items: any[],
    vacioMsg: string,
    colores: { header: string; headerBg: string; border: string },
    renderItem: (p: any) => React.ReactNode,
    linkLabel: string
  ) {
    return (
      <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${colores.border}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '14px 20px', background: colores.headerBg, borderBottom: `1px solid ${colores.border}` }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: colores.header, fontWeight: '700' }}>{titulo}</h3>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: colores.header, opacity: 0.75 }}>{subtitulo}</p>
        </div>
        {items.length === 0
          ? <p style={{ textAlign: 'center', color: '#aaa', padding: '28px 20px', fontSize: '13px', margin: 0 }}>{vacioMsg}</p>
          : <>
              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {items.map(renderItem)}
              </div>
              <div style={{ padding: '10px 20px', textAlign: 'center', borderTop: '1px solid #f8fafc' }}>
                <button onClick={() => onNavegar('clientes')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: colores.header, fontWeight: '600' }}>
                  {linkLabel} →
                </button>
              </div>
            </>
        }
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', width: '100%', boxSizing: 'border-box' as const, maxWidth: '1200px', margin: '0 auto' }}>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a', fontWeight: '700' }}>{tituloFecha}</h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Resumen del día y novedades recientes</p>
      </div>

      {cargando ? (
        <p style={{ color: '#aaa', fontSize: '14px' }}>Cargando...</p>
      ) : (
        <>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
            {tarjetaMetrica('Clases hoy',   metricas.total,       '#1a1a1a', '#f8fafc')}
            {tarjetaMetrica('Confirmadas',  metricas.confirmadas, '#166534', '#dcfce7')}
            {tarjetaMetrica('Dadas',        metricas.dadas,       '#854d0e', '#fefce8')}
            {tarjetaMetrica('Novedades',    metricas.novedades,   metricas.novedades > 0 ? '#991b1b' : '#94a3b8', metricas.novedades > 0 ? '#fee2e2' : '#f8fafc')}
          </div>

          {/* Tarjetas — 2x2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>

            {/* Novedades recientes */}
            {tarjetaLista(
              'Novedades recientes',
              metricas.novedades > 0 ? `${metricas.novedades} sin leer` : 'Al día',
              novedades,
              'Sin novedades',
              CARD_COLORS.novedades,
              (n) => {
                const { emoji, bg } = iconoTipo(n.tipo)
                return (
                  <div key={n.id}
                    onClick={() => !n.leida && marcarLeida(n.id)}
                    style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', background: n.leida ? 'white' : '#eff6ff', display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: n.leida ? 'default' : 'pointer' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', flexShrink: 0 }}>
                      {emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 1px', fontSize: '13px', fontWeight: n.leida ? '400' : '600', color: '#1a1a1a', lineHeight: '1.4', textAlign: 'left' }}>{n.mensaje}</p>
                      {n.detalle && <p style={{ margin: 0, fontSize: '12px', color: '#666', lineHeight: '1.4', textAlign: 'left' }}>{n.detalle}</p>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', marginTop: '2px', flexShrink: 0 }}>{tiempoRelativo(n.created_at)}</span>
                  </div>
                )
              },
              'Ver todas las novedades'
            )}

            {/* Planes por completar */}
            {tarjetaLista(
              'Por completar',
              '2 o menos clases restantes',
              planesAlerta,
              'Sin alertas por ahora',
              CARD_COLORS.completar,
              (p) => {
                const restantes = parseFloat(((p.total_clases || 0) - (p.clases_tomadas || 0)).toFixed(2))
                return (
                  <div key={p.id}
                    onClick={() => onNavegar('clientes')}
                    style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fff7ed')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: '#1a1a1a', textAlign: 'left' }}>{nombreCliente(p)}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666', textAlign: 'left' }}>{p.instrumentos?.nombre || '—'} · {p.profesores?.nombre || '—'}</p>
                    </div>
                    <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: restantes < 1 ? '#fee2e2' : '#fff7ed', color: restantes < 1 ? '#991b1b' : '#c2410c', flexShrink: 0, marginLeft: '10px' }}>
                      {restantes} {restantes === 1 ? 'clase' : 'clases'}
                    </span>
                  </div>
                )
              },
              'Ver todos los planes'
            )}

            {/* Por renovar */}
            {tarjetaLista(
              'Por renovar',
              'Planes completados sin archivar',
              planesPorRenovar,
              'Sin planes pendientes de renovar',
              CARD_COLORS.renovar,
              (p) => (
                <div key={p.id}
                  onClick={() => onNavegar('clientes')}
                  style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: '#1a1a1a', textAlign: 'left' }}>{nombreCliente(p)}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666', textAlign: 'left' }}>{p.instrumentos?.nombre || '—'} · {p.profesores?.nombre || '—'}</p>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#dcfce7', color: '#166534', flexShrink: 0, marginLeft: '10px' }}>
                    ✓ {p.total_clases} clases
                  </span>
                </div>
              ),
              'Ver en clientes'
            )}

            {/* Sin iniciar */}
            {tarjetaLista(
              'Sin iniciar',
              'Planes activos con 0 clases tomadas',
              planesSinIniciar,
              'Todos los planes tienen clases programadas',
              CARD_COLORS.sinIniciar,
              (p) => (
                <div key={p.id}
                  onClick={() => onNavegar('clientes')}
                  style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f3e8ff')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                  <div style={{ textAlign: 'left' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: '#1a1a1a', textAlign: 'left' }}>{nombreCliente(p)}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#666', textAlign: 'left' }}>{p.instrumentos?.nombre || '—'} · {p.profesores?.nombre || '—'}</p>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#f3e8ff', color: '#7c3aed', flexShrink: 0, marginLeft: '10px' }}>
                    {p.total_clases} clases
                  </span>
                </div>
              ),
              'Programar clases'
            )}

          </div>
        </>
      )}
    </div>
  )
}
