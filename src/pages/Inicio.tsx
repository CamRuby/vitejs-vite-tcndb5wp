import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import ClasesPorSede from './ClasesPorSede'
import SeccionInicio from './SeccionInicio'
import ClientesNuevos from './ClientesNuevos'
import PlanesSinPago from './PlanesSinPago'
import PlanesSinRenovar from './PlanesSinRenovar'

const DIAS_L   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES_L  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

// Secciones que se construirán más adelante
const PROXIMAMENTE = ['Clientes inactivos', 'Talleres']

export default function Inicio({ onNavegar }: {
  onNavegar: (seccion: string) => void
  onNuevaNotificacion?: () => void
}) {
  const [esMovil, setEsMovil] = useState(() => window.innerWidth < 768)
  const [inasistenciasPendientes, setInasistenciasPendientes] = useState<any[]>([])

  const hoy = new Date()
  const tituloFecha = `${DIAS_L[hoy.getDay()].charAt(0).toUpperCase() + DIAS_L[hoy.getDay()].slice(1)} ${hoy.getDate()} de ${MESES_L[hoy.getMonth()]}`

  useEffect(() => {
    const h = () => setEsMovil(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  useEffect(() => { cargarInasistenciasPendientes() }, [])

  async function cargarInasistenciasPendientes() {
    const { data } = await supabase
      .from('clases')
      .select('id, fecha, hora, contratos(clientes(nombre, nombres, apellidos), instrumentos(nombre)), profesores(nombre), inasistencia_perdonada')
      .eq('estado', 'cancelada')
      .eq('cancelado_por_academia', false)
      .is('honorario_valor', null)
      .order('fecha', { ascending: false })
      .limit(10)
    setInasistenciasPendientes(data || [])
  }

  function formatHora(hora: string) {
    if (!hora) return '—'
    const [h, m] = hora.substring(0, 5).split(':').map(Number)
    const ampm = h >= 12 ? 'p.m.' : 'a.m.'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const CARD_COLORS = {
    inasistencias: { header: '#c2410c', headerBg: '#fff7ed', border: '#fed7aa' },
  }

  function tarjetaLista(
    titulo: string,
    subtitulo: string,
    items: any[],
    vacioMsg: string,
    colores: { header: string; headerBg: string; border: string },
    renderItem: (p: any) => React.ReactNode,
    linkLabel: string,
    onLink?: () => void
  ) {
    return (
      <SeccionInicio titulo={titulo} subtitulo={subtitulo} cantidad={items.length} colores={colores} esMovil={esMovil}>
        {items.length === 0
          ? <p style={{ textAlign: 'center', color: '#aaa', padding: '28px 20px', fontSize: '13px', margin: 0 }}>{vacioMsg}</p>
          : <>
              <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                {items.map(renderItem)}
              </div>
              <div style={{ padding: '10px 20px', textAlign: 'center', borderTop: '1px solid #f8fafc' }}>
                <button onClick={onLink || (() => onNavegar('clientes'))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: colores.header, fontWeight: '600' }}>
                  {linkLabel} →
                </button>
              </div>
            </>
        }
      </SeccionInicio>
    )
  }

  const proximamente = (titulo: string) => (
    <div key={titulo} style={{ background: '#f8fafc', borderRadius: esMovil ? '14px' : '16px', border: '1px solid #e2e8f0', padding: '14px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', textAlign: 'left' }}>{titulo}</span>
      <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'nowrap' }}>Próximamente</span>
    </div>
  )

  return (
    <div style={{ padding: esMovil ? '16px' : '28px 32px', width: '100%', boxSizing: 'border-box' as const, maxWidth: '100%', overflowX: 'hidden' }}>

      <div style={{ marginBottom: esMovil ? '14px' : '20px' }}>
        <h2 style={{ margin: 0, fontSize: esMovil ? '20px' : '24px', color: '#1a1a1a', fontWeight: '700' }}>{tituloFecha}</h2>
      </div>

      {/* Clases del día por sede */}
      <ClasesPorSede />

      {/* Demás secciones */}
      <div style={{ display: 'grid', gridTemplateColumns: esMovil ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: esMovil ? '10px' : '16px', alignItems: 'start', gridAutoFlow: 'row dense' }}>

            {/* Inasistencias pendientes (sin cambios) */}
            {tarjetaLista(
              'Inasistencias pendientes',
              inasistenciasPendientes.length > 0 ? `${inasistenciasPendientes.length} por resolver` : 'Al día',
              inasistenciasPendientes,
              '✓ Sin inasistencias pendientes',
              CARD_COLORS.inasistencias,
              (c) => {
                const cliente = c.contratos?.clientes
                const nombreC = cliente?.nombre || `${cliente?.nombres || ''} ${cliente?.apellidos || ''}`.trim() || '—'
                const perdonada = c.inasistencia_perdonada
                return (
                  <div key={c.id}
                    onClick={() => onNavegar('horarios')}
                    style={{ padding: '11px 20px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#fff7ed')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <div style={{ textAlign: 'left' }}>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>{nombreC}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>
                        {new Date(c.fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · {formatHora(c.hora)} · {c.profesores?.nombre || '—'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end', flexShrink: 0, marginLeft: '10px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#fff7ed', color: '#c2410c', whiteSpace: 'nowrap' }}>
                        💰 Sin honorario
                      </span>
                      {perdonada && (
                        <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#fefce8', color: '#854d0e', whiteSpace: 'nowrap' }}>
                          ✓ Perdonada
                        </span>
                      )}
                    </div>
                  </div>
                )
              },
              'Ver en horarios',
              () => onNavegar('horarios')
            )}

            <ClientesNuevos esMovil={esMovil} onNavegar={onNavegar} />

            <PlanesSinPago esMovil={esMovil} />

            <PlanesSinRenovar esMovil={esMovil} />

            {PROXIMAMENTE.map(proximamente)}
      </div>
    </div>
  )
}
