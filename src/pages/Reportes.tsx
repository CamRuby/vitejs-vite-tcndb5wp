import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

interface Sede { id: string; nombre: string }

interface Abono {
  id: string
  fecha: string
  monto: number
  metodo: string | null
}

interface PlanControl {
  id: string
  cliente_id: string
  cliente_nombre: string
  grupo_whatsapp: string | null
  sede_id: string | null
  sede_nombre: string
  fecha_inicio: string | null
  estado: string
  total_clases: number
  duracion_min: number
  clases_tomadas: number
  valor_plan: number | null
  total_pagado: number
  saldo: number
  abonos: Abono[]
}

const METODOS_PAGO = [
  'Ideal Chicó',
  'Ideal Rosales',
  'Bancolombia Ruby',
  'Davivienda Ruby',
  'Wompi',
  'Tarjeta Redeban',
  'Efectivo',
]

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function mesActual(): string {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
}

export default function Reportes({ rol }: { rol?: string }) {
  return <ReporteControlPagos rol={rol} />
}

function ReporteControlPagos({ rol }: { rol?: string }) {
  const [datos, setDatos] = useState<PlanControl[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mes, setMes] = useState(mesActual())
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Modo edición (agregar pago)
  const [modoEdicion, setModoEdicion] = useState(false)
  const [pagoModal, setPagoModal] = useState<PlanControl | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [nuevoMetodo, setNuevoMetodo] = useState(METODOS_PAGO[0])
  const [nuevoFecha, setNuevoFecha] = useState(new Date().toISOString().split('T')[0])
  const [guardandoPago, setGuardandoPago] = useState(false)
  const [errorPago, setErrorPago] = useState('')
  const [mensajeOk, setMensajeOk] = useState('')

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
          id, cliente_id, sede_id, estado, fecha_inicio, fecha_fin,
          total_clases, duracion_min, clases_tomadas, valor_plan,
          clientes(nombre, grupo_whatsapp),
          sedes(nombre),
          instrumentos(nombre),
          profesores(nombre)
        `)
        .in('estado', ['activo', 'completado', 'archivado'])
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
          fecha_inicio: c.fecha_inicio,
          estado: c.estado,
          total_clases: Number(c.total_clases || 0),
          duracion_min: Number(c.duracion_min || 0),
          clases_tomadas: Number(c.clases_tomadas || 0),
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

  async function registrarPago() {
    if (!pagoModal) return
    if (!nuevoMonto || isNaN(Number(nuevoMonto)) || Number(nuevoMonto) <= 0) { setErrorPago('Ingresa un monto válido'); return }
    setGuardandoPago(true); setErrorPago('')
    const { error } = await supabase.from('pagos').insert({
      contrato_id: pagoModal.id,
      monto: Number(nuevoMonto),
      metodo: nuevoMetodo,
      fecha: nuevoFecha,
    })
    if (error) { setErrorPago('Error al guardar: ' + error.message); setGuardandoPago(false); return }
    setGuardandoPago(false)
    setPagoModal(null)
    setNuevoMonto('')
    setNuevoMetodo(METODOS_PAGO[0])
    setNuevoFecha(new Date().toISOString().split('T')[0])
    setMensajeOk('Pago registrado')
    setTimeout(() => setMensajeOk(''), 3000)
    await cargarDatos()
  }

  const filtrados = datos.filter(d => {
    if (filtroSede && d.sede_id !== filtroSede) return false
    if (filtroMetodo && !d.abonos.some(a => a.metodo === filtroMetodo)) return false
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: '0 0 2px' }}>💳 Control de pagos</h2>
          <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Planes iniciados en {labelMes}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {mensajeOk && <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>✓ {mensajeOk}</span>}
          <button onClick={() => setModoEdicion(!modoEdicion)}
            style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${modoEdicion ? TEAL : TEAL_MID}`, background: modoEdicion ? TEAL : 'white', color: modoEdicion ? 'white' : TEAL_DARK }}>
            {modoEdicion ? '✓ Modo edición ON' : '✏️ Registrar pagos'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '10px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', fontWeight: 600, color: TEAL_DARK, outline: 'none', background: TEAL_LIGHT }} />
        <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${filtroSede ? TEAL : TEAL_MID}`, background: filtroSede ? TEAL_LIGHT : 'white', color: filtroSede ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">🏢 Todas las sedes</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${filtroMetodo ? TEAL : TEAL_MID}`, background: filtroMetodo ? TEAL_LIGHT : 'white', color: filtroMetodo ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">💳 Todos los métodos</option>
          {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" placeholder="🔍 Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '10px', border: `1.5px solid ${busqueda ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', minWidth: '180px', marginLeft: 'auto' }} />
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
            const estaArchivado = plan.estado !== 'activo'

            return (
              <div key={plan.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid #e5e7eb`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '180px 200px 1fr', gap: '24px', alignItems: 'start' }}>

                  {/* COLUMNA 1: Cliente */}
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px', color: '#1e293b', lineHeight: 1.3 }}>{plan.cliente_nombre}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#9ca3af' }}>{plan.grupo_whatsapp || '—'}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{plan.sede_nombre}</p>
                  </div>

                  {/* COLUMNA 2: Plan */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      {estaArchivado
                        ? <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>📦</span>
                        : <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                      }
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>{plan.fecha_inicio}</span>
                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                      {plan.total_clases} clases · {plan.duracion_min} min
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
                      Tomadas: <strong style={{ color: TEAL_DARK }}>{Math.round(plan.clases_tomadas)}/{plan.total_clases}</strong>
                    </p>
                  </div>

                  {/* COLUMNA 3: Pagos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '16px', alignItems: 'start' }}>

                    {/* Cifras */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Valor</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#374151' }}>
                          {plan.valor_plan ? `$${plan.valor_plan.toLocaleString('es-CO')}` : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Pagado</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>
                          ${plan.total_pagado.toLocaleString('es-CO')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: saldoBg, borderRadius: '8px', padding: '5px 8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: saldoColor, fontWeight: 600 }}>Saldo</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: saldoColor }}>
                          {plan.saldo === 0 ? '✓ $0' : plan.saldo > 0 ? `-$${plan.saldo.toLocaleString('es-CO')}` : `+$${Math.abs(plan.saldo).toLocaleString('es-CO')}`}
                        </span>
                      </div>
                      {modoEdicion && (
                        <button onClick={() => {
                          setPagoModal(plan)
                          setNuevoMonto('')
                          setNuevoMetodo(METODOS_PAGO[0])
                          setNuevoFecha(new Date().toISOString().split('T')[0])
                          setErrorPago('')
                        }}
                          style={{ marginTop: '6px', padding: '7px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                          + Registrar pago
                        </button>
                      )}
                    </div>

                    {/* Abonos */}
                    <div>
                      {plan.abonos.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', fontStyle: 'italic' }}>Sin abonos</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {plan.abonos.map(a => (
                            <div key={a.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', minWidth: '52px' }}>{a.fecha.substring(5)}</span>
                              <span style={{ fontSize: '12px', color: '#374151', flex: 1 }}>{a.metodo}</span>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>${a.monto.toLocaleString('es-CO')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

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

      {/* Modal registrar pago */}
      {pagoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '380px', width: '100%' }}>
            <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#111' }}>+ Registrar pago</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#9ca3af' }}>{pagoModal.cliente_nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>Fecha</label>
                <input type="date" value={nuevoFecha} onChange={e => setNuevoFecha(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>Método de pago</label>
                <select value={nuevoMetodo} onChange={e => setNuevoMetodo(e.target.value)}
                  style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' as const, cursor: 'pointer' }}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>Monto ($)</label>
                <input type="number" value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)}
                  placeholder="0" autoFocus
                  style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
              {errorPago && <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>{errorPago}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={registrarPago} disabled={guardandoPago}
                style={{ flex: 1, padding: '13px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: 800 }}>
                {guardandoPago ? 'Guardando...' : 'Guardar pago'}
              </button>
              <button onClick={() => setPagoModal(null)}
                style={{ padding: '13px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
