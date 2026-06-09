import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

interface Sede { id: string; nombre: string }
interface Abono { id: string; fecha: string; monto: number; metodo: string | null }
interface PlanControl {
  id: string; cliente_id: string; cliente_nombre: string; grupo_whatsapp: string | null
  sede_id: string | null; sede_nombre: string; fecha_inicio: string | null; estado: string
  total_clases: number; duracion_min: number; clases_tomadas: number
  valor_plan: number | null; total_pagado: number; saldo: number; abonos: Abono[]
}

const METODOS_PAGO = ['Ideal Chicó','Ideal Rosales','Bancolombia Ruby','Davivienda Ruby','Wompi','Tarjeta Redeban','Efectivo']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
type FiltroPago = 'todos' | 'al_dia' | 'parcial' | 'sin_pago'

function mesActual() {
  const h = new Date()
  return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`
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
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [filtroPago, setFiltroPago] = useState<FiltroPago>('todos')
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [pagoModal, setPagoModal] = useState<PlanControl | null>(null)
  const [nuevoMonto, setNuevoMonto] = useState('')
  const [nuevoMetodo, setNuevoMetodo] = useState(METODOS_PAGO[0])
  const [nuevoFecha, setNuevoFecha] = useState(new Date().toISOString().split('T')[0])
  const [nuevoValorPlan, setNuevoValorPlan] = useState('')
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
      const fechaFin = `${mes}-${String(ultimoDia).padStart(2,'0')}`
      const { data: contratos, error: err } = await supabase
        .from('contratos')
        .select(`id, cliente_id, sede_id, estado, fecha_inicio, total_clases, duracion_min, clases_tomadas, valor_plan,
          clientes(nombre, grupo_whatsapp), sedes(nombre)`)
        .in('estado', ['activo','completado','archivado'])
        .gte('fecha_inicio', fechaInicio).lte('fecha_inicio', fechaFin)
        .order('fecha_inicio', { ascending: true })
      if (err) throw err
      const ids = (contratos || []).map((c: any) => c.id)
      let pagosMap: Record<string, Abono[]> = {}
      if (ids.length > 0) {
        const { data: pagos } = await supabase.from('pagos')
          .select('id, contrato_id, fecha, monto, metodo').in('contrato_id', ids).order('fecha', { ascending: true })
        ;(pagos || []).forEach((p: any) => {
          if (!pagosMap[p.contrato_id]) pagosMap[p.contrato_id] = []
          pagosMap[p.contrato_id].push({ id: p.id, fecha: p.fecha, monto: Number(p.monto), metodo: p.metodo || '—' })
        })
      }
      setDatos((contratos || []).map((c: any) => {
        const abonos = pagosMap[c.id] || []
        const pagado = abonos.reduce((s, a) => s + a.monto, 0)
        const valor = c.valor_plan ? Number(c.valor_plan) : 0
        return {
          id: c.id, cliente_id: c.cliente_id, cliente_nombre: c.clientes?.nombre || '—',
          grupo_whatsapp: c.clientes?.grupo_whatsapp || null, sede_id: c.sede_id,
          sede_nombre: c.sedes?.nombre || '—', fecha_inicio: c.fecha_inicio, estado: c.estado,
          total_clases: Number(c.total_clases || 0), duracion_min: Number(c.duracion_min || 0),
          clases_tomadas: Number(c.clases_tomadas || 0), valor_plan: valor || null,
          total_pagado: pagado, saldo: valor - pagado, abonos,
        }
      }))
    } catch { setError('No se pudieron cargar los datos.') }
    finally { setCargando(false) }
  }

  function estadoPago(p: PlanControl): FiltroPago {
    if (!p.valor_plan) return 'sin_pago'
    if (p.total_pagado === 0) return 'sin_pago'
    if (p.saldo <= 0) return 'al_dia'
    return 'parcial'
  }

  async function registrarPago() {
    if (!pagoModal) return
    if (!nuevoMonto || Number(nuevoMonto) <= 0) { setErrorPago('Ingresa un monto válido'); return }
    if (!pagoModal.valor_plan && !nuevoValorPlan) { setErrorPago('Ingresa el valor del plan antes de continuar.'); return }
    setGuardandoPago(true); setErrorPago('')
    if (nuevoValorPlan && Number(nuevoValorPlan) > 0)
      await supabase.from('contratos').update({ valor_plan: Number(nuevoValorPlan) }).eq('id', pagoModal.id)
    const { error } = await supabase.from('pagos').insert({ contrato_id: pagoModal.id, monto: Number(nuevoMonto), metodo: nuevoMetodo, fecha: nuevoFecha })
    if (error) { setErrorPago('Error: ' + error.message); setGuardandoPago(false); return }
    setGuardandoPago(false); setPagoModal(null); setNuevoMonto(''); setNuevoValorPlan('')
    setNuevoMetodo(METODOS_PAGO[0]); setNuevoFecha(new Date().toISOString().split('T')[0])
    setMensajeOk('Pago registrado'); setTimeout(() => setMensajeOk(''), 3000)
    await cargarDatos()
  }

  const filtrados = datos.filter(d => {
    if (filtroSede && d.sede_id !== filtroSede) return false
    if (filtroMetodo && !d.abonos.some(a => a.metodo === filtroMetodo)) return false
    if (filtroPago !== 'todos' && estadoPago(d) !== filtroPago) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!d.cliente_nombre.toLowerCase().includes(q) && !(d.grupo_whatsapp || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalValor   = filtrados.reduce((s, d) => s + (d.valor_plan || 0), 0)
  const totalPagado  = filtrados.reduce((s, d) => s + d.total_pagado, 0)
  const totalSaldo   = filtrados.reduce((s, d) => s + d.saldo, 0)
  const [anioSel, mesSel] = mes.split('-')
  const labelMes = `${MESES[parseInt(mesSel)-1]} ${anioSel}`
  const conteos = { todos: datos.length, al_dia: datos.filter(d => estadoPago(d)==='al_dia').length, parcial: datos.filter(d => estadoPago(d)==='parcial').length, sin_pago: datos.filter(d => estadoPago(d)==='sin_pago').length }

  return (
    <div style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto', boxSizing: 'border-box' }}>
      <style>{`
        @media (min-width: 700px) { .tarjeta-plan { flex-direction: row !important; } .col-pagos { flex-direction: row !important; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: TEAL_DARK, margin: '0 0 2px' }}>💳 Control de pagos</h2>
          <p style={{ color: '#888', fontSize: '12px', margin: 0 }}>Planes iniciados en {labelMes}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {mensajeOk && <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>✓ {mensajeOk}</span>}
          <button onClick={() => setModoEdicion(!modoEdicion)}
            style={{ padding: '7px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${modoEdicion ? TEAL : TEAL_MID}`, background: modoEdicion ? TEAL : 'white', color: modoEdicion ? 'white' : TEAL_DARK }}>
            {modoEdicion ? '✓ Edición ON' : '✏️ Pagos'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '8px', border: `1.5px solid ${TEAL_MID}`, fontSize: '12px', fontWeight: 600, color: TEAL_DARK, outline: 'none', background: TEAL_LIGHT }} />
        <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', border: `1.5px solid ${filtroSede ? TEAL : TEAL_MID}`, background: filtroSede ? TEAL_LIGHT : 'white', color: filtroSede ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">🏢 Sedes</option>
          {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', border: `1.5px solid ${filtroMetodo ? TEAL : TEAL_MID}`, background: filtroMetodo ? TEAL_LIGHT : 'white', color: filtroMetodo ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">💳 Método</option>
          {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="text" placeholder="🔍 Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: '8px', border: `1.5px solid ${busqueda ? TEAL : TEAL_MID}`, fontSize: '12px', outline: 'none', minWidth: '120px', flex: 1 }} />
      </div>

      {/* Filtros estado pago */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {([
          { k: 'todos',    l: 'Todos',     color: TEAL,      n: conteos.todos },
          { k: 'al_dia',   l: '✓ Al día',  color: '#16a34a', n: conteos.al_dia },
          { k: 'parcial',  l: '⚠ Parcial', color: '#d97706', n: conteos.parcial },
          { k: 'sin_pago', l: '✗ Sin pago',color: '#dc2626', n: conteos.sin_pago },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFiltroPago(f.k)}
            style={{ padding: '5px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${filtroPago===f.k ? f.color : '#e5e7eb'}`, background: filtroPago===f.k ? f.color : 'white', color: filtroPago===f.k ? 'white' : f.color }}>
            {f.l} ({f.n})
          </button>
        ))}
      </div>

      {/* Totales */}
      {!cargando && filtrados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', marginBottom: '16px' }}>
          {[
            { label: 'Planes',   valor: String(filtrados.length),                           color: TEAL },
            { label: 'Valor',    valor: `$${totalValor.toLocaleString('es-CO')}`,            color: '#7c3aed' },
            { label: 'Pagado',   valor: `$${totalPagado.toLocaleString('es-CO')}`,           color: '#16a34a' },
            { label: 'Saldo',    valor: `$${totalSaldo.toLocaleString('es-CO')}`,            color: totalSaldo > 0 ? '#dc2626' : '#16a34a' },
          ].map(t => (
            <div key={t.label} style={{ background: 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: t.color, lineHeight: 1.2 }}>{t.valor}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{t.label}</div>
            </div>
          ))}
        </div>
      )}

      {cargando && <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>Cargando...</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', padding: '12px', color: '#b91c1c', fontSize: '13px' }}>{error}</div>}
      {!cargando && !error && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: 'white', borderRadius: '10px', border: `1px solid ${TEAL_MID}` }}>
          No hay planes para {labelMes} con los filtros seleccionados.
        </div>
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(plan => {
            const saldoColor = plan.saldo > 0 ? '#dc2626' : plan.saldo < 0 ? '#7c3aed' : '#16a34a'
            const saldoBg   = plan.saldo > 0 ? '#fef2f2'  : plan.saldo < 0 ? '#f3e8ff'  : '#f0fdf4'
            const ep = estadoPago(plan)
            const borderColor = ep === 'sin_pago' ? '#fecaca' : ep === 'parcial' ? '#fde68a' : '#e5e7eb'

            return (
              <div key={plan.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${borderColor}`, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Tarjeta: apilada en móvil, horizontal en desktop */}
                <div className="tarjeta-plan" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Fila superior: cliente + plan (lado a lado siempre) */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    {/* Cliente */}
                    <div style={{ flex: '0 0 auto', minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{plan.cliente_nombre}</p>
                      <p style={{ margin: '0 0 1px', fontSize: '11px', color: '#9ca3af' }}>{plan.grupo_whatsapp || '—'}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{plan.sede_nombre}</p>
                    </div>

                    {/* Plan */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                        {plan.estado !== 'activo'
                          ? <span style={{ fontSize: '12px' }}>📦</span>
                          : <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
                        }
                        <span style={{ fontSize: '11px', color: '#6b7280' }}>{plan.fecha_inicio}</span>
                      </div>
                      <p style={{ margin: '0 0 1px', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                        {plan.total_clases} clases · {plan.duracion_min} min
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                        Tomadas: <strong style={{ color: TEAL_DARK }}>{Math.round(plan.clases_tomadas)}/{plan.total_clases}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Sección de pagos: cifras + abonos */}
                  <div style={{ borderTop: `1px solid ${TEAL_LIGHT}`, paddingTop: '10px' }}>
                    <div className="col-pagos" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                      {/* Cifras valor/pagado/saldo */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', flexWrap: 'wrap' }}>
                        {/* Valor */}
                        <div style={{ flex: 1, minWidth: '80px', background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>VALOR</p>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#374151' }}>
                            {plan.valor_plan ? `$${plan.valor_plan.toLocaleString('es-CO')}` : <span style={{ color: '#dc2626', fontSize: '11px' }}>Sin valor</span>}
                          </p>
                        </div>
                        {/* Pagado */}
                        <div style={{ flex: 1, minWidth: '80px', background: '#f0fdf4', borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 2px', fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>PAGADO</p>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#16a34a' }}>
                            ${plan.total_pagado.toLocaleString('es-CO')}
                          </p>
                        </div>
                        {/* Saldo */}
                        <div style={{ flex: 1, minWidth: '80px', background: saldoBg, borderRadius: '8px', padding: '8px 10px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 2px', fontSize: '10px', color: saldoColor, fontWeight: 600 }}>SALDO</p>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: saldoColor }}>
                            {plan.saldo === 0 ? '✓ $0' : plan.saldo > 0 ? `-$${plan.saldo.toLocaleString('es-CO')}` : `+$${Math.abs(plan.saldo).toLocaleString('es-CO')}`}
                          </p>
                        </div>
                        {/* Botón registrar pago */}
                        {modoEdicion && (
                          <button onClick={() => { setPagoModal(plan); setNuevoMonto(''); setNuevoMetodo(METODOS_PAGO[0]); setNuevoFecha(new Date().toISOString().split('T')[0]); setNuevoValorPlan(''); setErrorPago('') }}
                            style={{ flex: '0 0 auto', alignSelf: 'stretch', padding: '8px 14px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                            + Pago
                          </button>
                        )}
                      </div>

                      {/* Abonos */}
                      {plan.abonos.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {plan.abonos.map(a => (
                            <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 6px', borderRadius: '6px', background: '#fafafa' }}>
                              <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', minWidth: '40px' }}>{a.fecha.substring(5)}</span>
                              <span style={{ fontSize: '11px', color: '#374151', flex: 1 }}>{a.metodo}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>${a.monto.toLocaleString('es-CO')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {plan.abonos.length === 0 && (
                        <p style={{ margin: 0, fontSize: '11px', color: '#d1d5db', fontStyle: 'italic' }}>Sin abonos</p>
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
        <div style={{ marginTop: '10px', fontSize: '11px', color: '#9ca3af', textAlign: 'right' }}>
          {filtrados.length} planes · {labelMes}
        </div>
      )}

      {/* Modal registrar pago */}
      {pagoModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '400px', width: '100%', boxSizing: 'border-box' }}>
            <p style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 800, color: '#111' }}>+ Registrar pago</p>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#9ca3af' }}>{pagoModal.cliente_nombre}</p>
            {!pagoModal.valor_plan && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', marginBottom: '14px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>⚠ Plan sin valor registrado</p>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '5px' }}>Valor del plan ($) *</label>
                <input type="number" value={nuevoValorPlan} onChange={e => setNuevoValorPlan(e.target.value)} placeholder="Ej: 250000" autoFocus
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #fca5a5', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '5px' }}>Fecha</label>
                <input type="date" value={nuevoFecha} onChange={e => setNuevoFecha(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '5px' }}>Método</label>
                <select value={nuevoMetodo} onChange={e => setNuevoMetodo(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, cursor: 'pointer' }}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '5px' }}>
                  Monto ($)
                  {pagoModal.valor_plan && pagoModal.saldo > 0 && (
                    <span style={{ marginLeft: '6px', fontSize: '10px', color: '#9ca3af', fontWeight: 400 }}>Saldo: ${pagoModal.saldo.toLocaleString('es-CO')}</span>
                  )}
                </label>
                <input type="number" value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)} placeholder="0"
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
              {errorPago && <p style={{ margin: 0, color: '#dc2626', fontSize: '12px' }}>{errorPago}</p>}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={registrarPago} disabled={guardandoPago}
                style={{ flex: 1, padding: '12px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 800 }}>
                {guardandoPago ? 'Guardando...' : 'Guardar pago'}
              </button>
              <button onClick={() => setPagoModal(null)}
                style={{ padding: '12px 18px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
