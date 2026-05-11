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
  const [cargando, setCargando]         = useState(true)
  const [metricas, setMetricas]         = useState({ total: 0, confirmadas: 0, dadas: 0, novedades: 0 })
  const [novedades, setNovedades]       = useState<any[]>([])
  const [planesAlerta, setPlanesAlerta] = useState<any[]>([])

  const hoy = new Date()
  const fechaHoy = fechaHoyLocal()
  const tituloFecha = `${DIAS_L[hoy.getDay()].charAt(0).toUpperCase() + DIAS_L[hoy.getDay()].slice(1)} ${hoy.getDate()} de ${MESES_L[hoy.getMonth()]}`

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setCargando(true)
    await Promise.all([cargarMetricas(), cargarNovedades(), cargarPlanesAlerta()])
    setCargando(false)
  }

  async function cargarMetricas() {
    const { data: clasesHoy } = await supabase
      .from('clases').select('estado')
      .eq('fecha', fechaHoy).neq('estado', 'cancelada')
    const total      = (clasesHoy || []).length
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
      .select('id, total_clases, clases_tomadas, duracion_min, cliente_id, clientes(nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre)')
      .eq('estado', 'activo')
    if (!data) return
    // ── FIX: usar restantes fraccionarios (clases_tomadas puede ser 2.25, etc.) ──
    const alertas = data.filter((p: any) => {
      const restantes = (p.total_clases || 0) - (p.clases_tomadas || 0)
      return restantes <= 2 && restantes > 0
    }).slice(0, 5)
    setPlanesAlerta(alertas)
  }

  async function marcarLeida(id: string) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNovedades(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setMetricas(prev => ({ ...prev, novedades: Math.max(0, prev.novedades - 1) }))
    onNuevaNotificacion()
  }

  const tarjetaMetrica = (label: string, valor: number, color: string) => (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#666', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color, lineHeight: 1 }}>{valor}</p>
    </div>
  )

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a', fontWeight: '700' }}>{tituloFecha}</h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Resumen del día y novedades recientes</p>
      </div>

      {cargando ? (
        <p style={{ color: '#aaa', fontSize: '14px' }}>Cargando...</p>
      ) : (
        <>
          {/* Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
            {tarjetaMetrica('Clases hoy', metricas.total, '#1a1a1a')}
            {tarjetaMetrica('Confirmadas', metricas.confirmadas, '#166534')}
            {tarjetaMetrica('Dadas', metricas.dadas, '#854d0e')}
            {tarjetaMetrica('Novedades', metricas.novedades, metricas.novedades > 0 ? '#dc2626' : '#aaa')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* Novedades recientes */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#1a1a1a', fontWeight: '600' }}>Novedades recientes</h3>
                {metricas.novedades > 0 && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '600', padding: '2px 10px', borderRadius: '20px' }}>
                    {metricas.novedades} sin leer
                  </span>
                )}
              </div>
              {novedades.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '32px 20px', fontSize: '13px' }}>Sin novedades</p>
              ) : (
                novedades.map(n => {
                  const { emoji, color, bg } = iconoTipo(n.tipo)
                  return (
                    <div key={n.id}
                      onClick={() => !n.leida && marcarLeida(n.id)}
                      style={{ padding: '12px 20px', borderBottom: '1px solid #f8fafc', background: n.leida ? 'white' : '#eff6ff', display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: n.leida ? 'default' : 'pointer' }}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                        {emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: n.leida ? '400' : '600', color: '#1a1a1a', lineHeight: '1.4' }}>{n.mensaje}</p>
                        {n.detalle && <p style={{ margin: 0, fontSize: '12px', color: '#666', lineHeight: '1.4' }}>{n.detalle}</p>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', marginTop: '2px', flexShrink: 0 }}>{tiempoRelativo(n.created_at)}</span>
                    </div>
                  )
                })
              )}
              {novedades.length > 0 && (
                <div style={{ padding: '12px 20px', textAlign: 'center' }}>
                  <button onClick={() => onNavegar('inicio')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: TEAL, fontWeight: '500' }}>
                    Ver todas las novedades →
                  </button>
                </div>
              )}
            </div>

            {/* Planes por completar */}
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #eef2f7' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#1a1a1a', fontWeight: '600' }}>Planes por completar</h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#666' }}>Clientes con 2 o menos clases restantes</p>
              </div>
              {planesAlerta.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '32px 20px', fontSize: '13px' }}>Sin alertas por ahora</p>
              ) : (
                planesAlerta.map((p: any) => {
                  // ── FIX: restantes fraccionarios, redondeado a 2 decimales ──
                  const restantesExacto = parseFloat(((p.total_clases || 0) - (p.clases_tomadas || 0)).toFixed(2))
                  const nombre = p.clientes?.nombre || `${p.clientes?.nombres || ''} ${p.clientes?.apellidos || ''}`.trim() || '—'
                  // Color: rojo si queda menos de 1 clase, naranja si queda entre 1 y 2
                  const esCritico = restantesExacto < 1
                  return (
                    <div key={p.id}
                      onClick={() => onNavegar('clientes')}
                      style={{ padding: '12px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{nombre}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                          {p.instrumentos?.nombre || '—'} · {p.profesores?.nombre || '—'}
                        </p>
                      </div>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                        background: esCritico ? '#fee2e2' : '#fff7ed',
                        color: esCritico ? '#991b1b' : '#c2410c',
                        flexShrink: 0 }}>
                        {restantesExacto} {restantesExacto === 1 ? 'clase' : 'clases'}
                      </span>
                    </div>
                  )
                })
              )}
              {planesAlerta.length > 0 && (
                <div style={{ padding: '12px 20px', textAlign: 'center' }}>
                  <button onClick={() => onNavegar('clientes')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: TEAL, fontWeight: '500' }}>
                    Ver todos los planes →
                  </button>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  )
}
