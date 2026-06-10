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

const REPORTES = [
  { id: 'control_pagos', icono: '💳', titulo: 'Control de pagos', descripcion: 'Seguimiento mensual de pagos, abonos y saldos por plan' },
  { id: 'clases_tomadas', icono: '📋', titulo: 'Clases tomadas por plan', descripcion: 'Planes activos con conteo de clases y verificación WhatsApp por sede' },
]

export default function Reportes({ rol }: { rol?: string }) {
  const [reporteActivo, setReporteActivo] = useState<string | null>(null)

  if (reporteActivo === 'control_pagos') return <ReporteControlPagos onVolver={() => setReporteActivo(null)} />
  if (reporteActivo === 'clases_tomadas') return <ReporteClasesTomadasPlaceholder onVolver={() => setReporteActivo(null)} />

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: TEAL_DARK, marginBottom: '8px' }}>Reportes</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>Selecciona un reporte para visualizarlo.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {REPORTES.map(r => (
          <button key={r.id} onClick={() => setReporteActivo(r.id)}
            style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '12px', padding: '24px 20px', textAlign: 'left', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(26,138,138,0.15)'; (e.currentTarget as HTMLButtonElement).style.borderColor = TEAL }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = TEAL_MID }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{r.icono}</div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: TEAL_DARK, marginBottom: '6px' }}>{r.titulo}</div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>{r.descripcion}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReporteControlPagos({ onVolver }: { onVolver: () => void }) {
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
  const [confirmarBorrarAbono, setConfirmarBorrarAbono] = useState<{ abonoId: string; planId: string } | null>(null)
  const [borrandoAbono, setBorrandoAbono] = useState(false)

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

  async function borrarAbono(abonoId: string) {
    setBorrandoAbono(true)
    await supabase.from('pagos').delete().eq('id', abonoId)
    setConfirmarBorrarAbono(null)
    setBorrandoAbono(false)
    setMensajeOk('Pago eliminado')
    setTimeout(() => setMensajeOk(''), 3000)
    await cargarDatos()
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

  const totalValor  = filtrados.reduce((s, d) => s + (d.valor_plan || 0), 0)
  const totalPagado = filtrados.reduce((s, d) => s + d.total_pagado, 0)
  const totalSaldo  = filtrados.reduce((s, d) => s + d.saldo, 0)
  const [anioSel, mesSel] = mes.split('-')
  const labelMes = `${MESES[parseInt(mesSel)-1]} ${anioSel}`
  const conteos = {
    todos: datos.length,
    al_dia: datos.filter(d => estadoPago(d)==='al_dia').length,
    parcial: datos.filter(d => estadoPago(d)==='parcial').length,
    sin_pago: datos.filter(d => estadoPago(d)==='sin_pago').length,
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }}>
      <style>{`
        .rcp-tarjeta { display: grid; grid-template-columns: 180px 200px 1fr; gap: 24px; align-items: start; }
        .rcp-pagos   { display: grid; grid-template-columns: 160px 1fr; gap: 16px; align-items: start; }
        @media (max-width: 700px) {
          .rcp-tarjeta { display: flex !important; flex-direction: column !important; gap: 10px !important; }
          .rcp-pagos   { display: flex !important; flex-direction: column !important; gap: 8px !important; }
          .rcp-cifras  { display: flex !important; gap: 8px !important; }
          .rcp-cifra   { flex: 1; text-align: center !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: '0 0 2px' }}>💳 Control de pagos</h2>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Planes iniciados en {labelMes}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {mensajeOk && <span style={{ fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>✓ {mensajeOk}</span>}
          <button onClick={() => setModoEdicion(!modoEdicion)}
            style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${modoEdicion ? TEAL : TEAL_MID}`, background: modoEdicion ? TEAL : 'white', color: modoEdicion ? 'white' : TEAL_DARK }}>
            {modoEdicion ? '✓ Edición ON' : '✏️ Registrar pagos'}
          </button>
        </div>
      </div>

      {/* Filtros línea 1 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
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

      {/* Filtros estado pago */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {([
          { k: 'todos',    l: 'Todos',           color: TEAL,      n: conteos.todos },
          { k: 'al_dia',   l: '✓ Al día',         color: '#16a34a', n: conteos.al_dia },
          { k: 'parcial',  l: '⚠ Abono parcial',  color: '#d97706', n: conteos.parcial },
          { k: 'sin_pago', l: '✗ Sin pago',       color: '#dc2626', n: conteos.sin_pago },
        ] as const).map(f => (
          <button key={f.k} onClick={() => setFiltroPago(f.k)}
            style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${filtroPago===f.k ? f.color : '#e5e7eb'}`, background: filtroPago===f.k ? f.color : 'white', color: filtroPago===f.k ? 'white' : f.color }}>
            {f.l} ({f.n})
          </button>
        ))}
      </div>

      {/* Totales */}
      {!cargando && filtrados.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Planes',         valor: String(filtrados.length),                  color: TEAL },
            { label: 'Valor total',    valor: `$${totalValor.toLocaleString('es-CO')}`,  color: '#7c3aed' },
            { label: 'Recaudado',      valor: `$${totalPagado.toLocaleString('es-CO')}`, color: '#16a34a' },
            { label: 'Saldo pendiente',valor: `$${totalSaldo.toLocaleString('es-CO')}`,  color: totalSaldo > 0 ? '#dc2626' : '#16a34a' },
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
          No hay planes con los filtros seleccionados en {labelMes}.
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
              <div key={plan.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${borderColor}`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div className="rcp-tarjeta">

                  {/* COLUMNA 1: Cliente */}
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px', color: '#1e293b', lineHeight: 1.3 }}>{plan.cliente_nombre}</p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#9ca3af' }}>{plan.grupo_whatsapp || '—'}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{plan.sede_nombre}</p>
                  </div>

                  {/* COLUMNA 2: Plan */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      {plan.estado !== 'activo'
                        ? <span style={{ fontSize: '14px' }}>📦</span>
                        : <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
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
                  <div className="rcp-pagos">

                    {/* Cifras valor / pagado / saldo */}
                    <div className="rcp-cifras" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="rcp-cifra" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Valor</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#374151' }}>
                          {plan.valor_plan ? `$${plan.valor_plan.toLocaleString('es-CO')}` : <span style={{ color: '#dc2626', fontSize: '12px' }}>Sin valor</span>}
                        </span>
                      </div>
                      <div className="rcp-cifra" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>Pagado</span>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>${plan.total_pagado.toLocaleString('es-CO')}</span>
                      </div>
                      <div className="rcp-cifra" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: saldoBg, borderRadius: '8px', padding: '5px 8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', color: saldoColor, fontWeight: 600 }}>Saldo</span>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: saldoColor }}>
                          {plan.saldo === 0 ? '✓ $0' : plan.saldo > 0 ? `-$${plan.saldo.toLocaleString('es-CO')}` : `+$${Math.abs(plan.saldo).toLocaleString('es-CO')}`}
                        </span>
                      </div>
                      {modoEdicion && (
                        <button onClick={() => { setPagoModal(plan); setNuevoMonto(''); setNuevoMetodo(METODOS_PAGO[0]); setNuevoFecha(new Date().toISOString().split('T')[0]); setNuevoValorPlan(''); setErrorPago('') }}
                          style={{ marginTop: '6px', padding: '7px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                          + Registrar pago
                        </button>
                      )}
                    </div>

                    {/* Abonos */}
                    <div>
                      {plan.abonos.length === 0
                        ? <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', fontStyle: 'italic' }}>Sin abonos</p>
                        : <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {plan.abonos.map(a => (
                              <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', minWidth: '52px' }}>{a.fecha.substring(5)}</span>
                                <span style={{ fontSize: '12px', color: '#374151', flex: 1 }}>{a.metodo}</span>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>${a.monto.toLocaleString('es-CO')}</span>
                                {modoEdicion && (
                                  confirmarBorrarAbono?.abonoId === a.id
                                    ? <div style={{ display: 'flex', gap: '4px' }}>
                                        <button onClick={() => borrarAbono(a.id)} disabled={borrandoAbono}
                                          style={{ padding: '2px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                                          {borrandoAbono ? '...' : '✓'}
                                        </button>
                                        <button onClick={() => setConfirmarBorrarAbono(null)}
                                          style={{ padding: '2px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                      </div>
                                    : <button onClick={() => setConfirmarBorrarAbono({ abonoId: a.id, planId: plan.id })}
                                        style={{ padding: '2px 6px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>🗑</button>
                                )}
                              </div>
                            ))}
                          </div>
                      }
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
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%' }}>
            <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#111' }}>+ Registrar pago</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#9ca3af' }}>{pagoModal.cliente_nombre}</p>
            {!pagoModal.valor_plan && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>⚠ Plan sin valor registrado</p>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>Valor del plan ($) *</label>
                <input type="number" value={nuevoValorPlan} onChange={e => setNuevoValorPlan(e.target.value)} placeholder="Ej: 250000" autoFocus
                  style={{ width: '100%', padding: '11px 12px', border: '1.5px solid #fca5a5', borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
            )}
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>
                  Monto ($)
                  {pagoModal.valor_plan && pagoModal.saldo > 0 && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>Saldo: ${pagoModal.saldo.toLocaleString('es-CO')}</span>
                  )}
                </label>
                <input type="number" value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)} placeholder="0"
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

// ─── REPORTE: CLASES TOMADAS POR PLAN ────────────────────────────────────────
interface PlanActivo {
  id: string; cliente_id: string; cliente_nombre: string; grupo_whatsapp: string | null
  sede_id: string | null; sede_nombre: string; instrumento_id: string | null
  instrumento_nombre: string; total_clases: number; duracion_min: number
  clases_tomadas: number; conteo_whatsapp: number | null; diferencia: number
}
interface Instrumento2 { id: string; nombre: string }
interface Sede2 { id: string; nombre: string }
type CampoTexto = 'grupo_whatsapp'
type CampoNumero = 'total_clases' | 'duracion_min' | 'conteo_whatsapp'
interface Edicion {
  instrumento_id?: string; sede_id?: string; grupo_whatsapp?: string
  total_clases?: number; duracion_min?: number; conteo_whatsapp?: number | null
}

function calcularEstadoPago2(valorPlan: number | null, pagos: any[]) {
  const totalPagado = (pagos || []).reduce((s: number, p: any) => s + Number(p.monto), 0)
  const saldo = valorPlan !== null ? valorPlan - totalPagado : null
  let estado = 'Sin valor'
  if (valorPlan !== null) {
    if (totalPagado === 0) estado = 'Sin pagar'
    else if (totalPagado >= valorPlan) estado = 'Pagado'
    else estado = 'Parcial'
  }
  return { totalPagado, saldo, estado }
}

function ReporteClasesTomadasPlaceholder({ onVolver }: { onVolver: () => void }) {
  const [datos, setDatos] = useState<PlanActivo[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento2[]>([])
  const [sedesDisponibles, setSedesDisponibles] = useState<Sede2[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'al_dia' | 'pendiente' | 'con_wa'>('todos')
  const [sedeFiltro, setSedeFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [editados, setEditados] = useState<Record<string, Edicion>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true); setError(null)
    try {
      const [{ data, error: err }, { data: instr }, { data: sedesData }] = await Promise.all([
        supabase.from('contratos').select(`id, cliente_id, sede_id, instrumento_id, total_clases, duracion_min, clases_tomadas, conteo_whatsapp, clientes(nombres, apellidos, grupo_whatsapp), sedes(nombre), instrumentos(id, nombre)`).eq('estado', 'activo'),
        supabase.from('instrumentos').select('id, nombre').order('nombre'),
        supabase.from('sedes').select('id, nombre').order('nombre')
      ])
      if (err) throw err
      setInstrumentos(instr || []); setSedesDisponibles(sedesData || [])
      const filas: PlanActivo[] = (data || []).map((row: any) => {
        const tomadas = Number(row.clases_tomadas ?? 0)
        const whatsapp = row.conteo_whatsapp !== null ? Number(row.conteo_whatsapp) : null
        const nombre = row.clientes?.nombre || `${row.clientes?.nombres ?? ''} ${row.clientes?.apellidos ?? ''}`.trim()
        return {
          id: row.id, cliente_id: row.cliente_id, cliente_nombre: nombre,
          grupo_whatsapp: row.clientes?.grupo_whatsapp ?? null, sede_id: row.sede_id ?? null,
          sede_nombre: row.sedes?.nombre ?? '—', instrumento_id: row.instrumento_id ?? null,
          instrumento_nombre: row.instrumentos?.nombre ?? '—',
          total_clases: Number(row.total_clases ?? 0), duracion_min: Number(row.duracion_min ?? 0),
          clases_tomadas: tomadas, conteo_whatsapp: whatsapp,
          diferencia: whatsapp !== null ? tomadas - whatsapp : tomadas,
        }
      }).sort((a, b) => a.sede_nombre.localeCompare(b.sede_nombre))
      setDatos(filas)
    } catch { setError('No se pudieron cargar los datos.') } finally { setCargando(false) }
  }

  const sedes = ['todas', ...Array.from(new Set(datos.map(d => d.sede_nombre))).sort()]
  let filtrados = datos.filter(d => {
    const q = busqueda.toLowerCase()
    if (busqueda && !d.cliente_nombre.toLowerCase().includes(q) && !d.sede_nombre.toLowerCase().includes(q) && !d.instrumento_nombre.toLowerCase().includes(q) && !(d.grupo_whatsapp ?? '').toLowerCase().includes(q)) return false
    if (sedeFiltro !== 'todas' && d.sede_nombre !== sedeFiltro) return false
    return true
  })
  if (filtro === 'al_dia') filtrados = filtrados.filter(d => d.diferencia === 0)
  else if (filtro === 'pendiente') filtrados = filtrados.filter(d => d.diferencia > 0).sort((a, b) => a.diferencia - b.diferencia)
  else if (filtro === 'con_wa') filtrados = filtrados.filter(d => d.conteo_whatsapp !== null)

  function getNum(plan: PlanActivo, campo: CampoNumero): number | string {
    const ed = editados[plan.id]
    if (ed && campo in ed) { const v = ed[campo as keyof Edicion]; return v === null || v === undefined ? '' : v as number }
    if (campo === 'conteo_whatsapp') return plan.conteo_whatsapp !== null ? plan.conteo_whatsapp : ''
    return campo === 'total_clases' ? plan.total_clases : plan.duracion_min
  }
  function getTxt(plan: PlanActivo, campo: CampoTexto): string { const ed = editados[plan.id]; return ed && campo in ed ? ed[campo] ?? '' : plan.grupo_whatsapp ?? '' }
  function getInstrumentoId(plan: PlanActivo): string { const ed = editados[plan.id]; return ed && 'instrumento_id' in ed ? ed.instrumento_id ?? '' : plan.instrumento_id ?? '' }
  function getSedeId(plan: PlanActivo): string { const ed = editados[plan.id]; return ed && 'sede_id' in ed ? ed.sede_id ?? '' : plan.sede_id ?? '' }
  function editarNum(id: string, campo: CampoNumero, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor === '' ? null : Number(valor) } })) }
  function editarTxt(id: string, campo: CampoTexto, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } })) }
  function editarSede(id: string, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], sede_id: valor } })) }
  function editarInstrumento(id: string, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], instrumento_id: valor } })) }

  async function guardarCambios() {
    setGuardando(true); setMensajeGuardado(null); let errores = 0
    for (const [id, cambios] of Object.entries(editados)) {
      const plan = datos.find(d => d.id === id); if (!plan) continue
      const updateContrato: any = {}
      if ('total_clases' in cambios && cambios.total_clases !== null) updateContrato.total_clases = cambios.total_clases
      if ('duracion_min' in cambios && cambios.duracion_min !== null) updateContrato.duracion_min = cambios.duracion_min
      if ('conteo_whatsapp' in cambios) updateContrato.conteo_whatsapp = cambios.conteo_whatsapp
      if ('instrumento_id' in cambios && cambios.instrumento_id) updateContrato.instrumento_id = cambios.instrumento_id
      if ('sede_id' in cambios && cambios.sede_id) updateContrato.sede_id = cambios.sede_id
      if (Object.keys(updateContrato).length > 0) { const { error: err } = await supabase.from('contratos').update(updateContrato).eq('id', id); if (err) errores++ }
      if ('grupo_whatsapp' in cambios) { const { error: err } = await supabase.from('clientes').update({ grupo_whatsapp: cambios.grupo_whatsapp }).eq('id', plan.cliente_id); if (err) errores++ }
    }
    setGuardando(false); setEditados({}); setModoEdicion(false)
    setMensajeGuardado(errores === 0 ? '✅ Cambios guardados.' : `⚠️ ${errores} error(es).`)
    await cargarDatos(); setTimeout(() => setMensajeGuardado(null), 4000)
  }

  const hayCambios = Object.keys(editados).length > 0
  const estiloInput = (editado: boolean) => ({ padding: '5px 8px', borderRadius: '6px', textAlign: 'center' as const, border: `1.5px solid ${editado ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', background: '#fff' })
  const estiloInputTxt = (editado: boolean) => ({ padding: '5px 8px', borderRadius: '6px', border: `1.5px solid ${editado ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', background: '#fff', width: '100%', minWidth: '120px' })
  const estiloSelect = (editado: boolean) => ({ padding: '5px 8px', borderRadius: '6px', border: `1.5px solid ${editado ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', background: '#fff', width: '100%', minWidth: '130px', cursor: 'pointer' })
  const columnas = ['#', 'Cliente', 'Grupo WA', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Clases tomadas', 'Conteo WA', 'Diferencia']
  const editables = ['Grupo WA', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Conteo WA']

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: 0, flex: 1 }}>📋 Clases tomadas por plan</h2>
        {!modoEdicion
          ? <button onClick={() => setModoEdicion(true)} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>✏️ Modo edición</button>
          : <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEditados({}); setModoEdicion(false) }} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarCambios} disabled={!hayCambios || guardando} style={{ background: hayCambios ? TEAL : '#a0c8c8', border: 'none', borderRadius: '8px', padding: '7px 18px', cursor: hayCambios ? 'pointer' : 'not-allowed', fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                {guardando ? 'Guardando…' : `💾 Guardar${hayCambios ? ` (${Object.keys(editados).length})` : ''}`}
              </button>
            </div>
        }
      </div>
      {mensajeGuardado && <div style={{ background: mensajeGuardado.startsWith('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${mensajeGuardado.startsWith('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: mensajeGuardado.startsWith('✅') ? '#166534' : '#92400e' }}>{mensajeGuardado}</div>}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[{ label: 'Total planes activos', valor: datos.length, color: TEAL }, { label: 'Al día', valor: datos.filter(d => d.diferencia === 0).length, color: '#16a34a' }, { label: 'Pendiente', valor: datos.filter(d => d.diferencia > 0).length, color: '#d97706' }].map(t => (
          <div key={t.label} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', padding: '14px 20px', minWidth: '140px', flex: '1' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: t.color }}>{cargando ? '…' : t.valor}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{t.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {([{ key: 'todos', label: '📋 Todos' }, { key: 'al_dia', label: '✅ Al día' }, { key: 'pendiente', label: '⏳ Pendiente' }, { key: 'con_wa', label: '💬 Con conteo WA' }] as const).map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{ padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: filtro === f.key ? TEAL : '#fff', color: filtro === f.key ? '#fff' : TEAL_DARK, border: `1.5px solid ${filtro === f.key ? TEAL : TEAL_MID}` }}>{f.label}</button>
        ))}
        <select value={sedeFiltro} onChange={e => setSedeFiltro(e.target.value)} style={{ padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${sedeFiltro !== 'todas' ? TEAL : TEAL_MID}`, background: sedeFiltro !== 'todas' ? TEAL_LIGHT : '#fff', color: sedeFiltro !== 'todas' ? TEAL_DARK : '#475569', cursor: 'pointer', outline: 'none' }}>
          {sedes.map(s => <option key={s} value={s}>{s === 'todas' ? '🏢 Todas las sedes' : `🏢 ${s}`}</option>)}
        </select>
        <input type="text" placeholder="Buscar cliente, instrumento, grupo…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: '20px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none', width: '240px', color: '#333' }} />
      </div>
      {cargando && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando datos…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}
      {!cargando && !error && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1.5px solid ${TEAL_MID}`, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: TEAL, color: '#fff' }}>
              {columnas.map((h, i) => <th key={i} style={{ padding: '11px 14px', fontWeight: 700, textAlign: i === 0 || i >= 5 ? 'center' : 'left', whiteSpace: 'nowrap', fontSize: '12px' }}>{h}{modoEdicion && editables.includes(h) ? ' ✏️' : ''}</th>)}
            </tr></thead>
            <tbody>
              {filtrados.length === 0
                ? <tr><td colSpan={columnas.length} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No hay planes.</td></tr>
                : filtrados.map((plan, idx) => {
                  const ed = editados[plan.id] ?? {}
                  const waActual = 'conteo_whatsapp' in ed ? ed.conteo_whatsapp : plan.conteo_whatsapp
                  const diff = waActual !== null && waActual !== undefined ? plan.clases_tomadas - (waActual as number) : plan.clases_tomadas
                  const diffColor = diff === 0 ? '#16a34a' : diff <= 2 ? '#d97706' : '#dc2626'
                  const diffBg = diff === 0 ? '#f0fdf4' : diff <= 2 ? '#fffbeb' : '#fef2f2'
                  return (
                    <tr key={plan.id} style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: Object.keys(ed).length > 0 ? '#fffde7' : idx % 2 === 0 ? '#fff' : '#fafefe' }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{plan.cliente_nombre}</td>
                      <td style={{ padding: '6px 14px', minWidth: '130px' }}>{modoEdicion ? <input type="text" value={getTxt(plan, 'grupo_whatsapp')} onChange={e => editarTxt(plan.id, 'grupo_whatsapp', e.target.value)} placeholder="Sin grupo" style={estiloInputTxt('grupo_whatsapp' in ed)} /> : <span style={{ color: plan.grupo_whatsapp ? '#334155' : '#ccc' }}>{plan.grupo_whatsapp || '—'}</span>}</td>
                      <td style={{ padding: '6px 14px', minWidth: '130px' }}>{modoEdicion ? <select value={getSedeId(plan)} onChange={e => editarSede(plan.id, e.target.value)} style={estiloSelect('sede_id' in ed)}><option value="">— Sin sede —</option>{sedesDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select> : <span style={{ color: '#475569' }}>{plan.sede_nombre}</span>}</td>
                      <td style={{ padding: '6px 14px', minWidth: '140px' }}>{modoEdicion ? <select value={getInstrumentoId(plan)} onChange={e => editarInstrumento(plan.id, e.target.value)} style={estiloSelect('instrumento_id' in ed)}><option value="">— Sin instrumento —</option>{instrumentos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select> : <span style={{ color: '#475569' }}>{plan.instrumento_nombre}</span>}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>{modoEdicion ? <input type="number" value={getNum(plan, 'total_clases')} onChange={e => editarNum(plan.id, 'total_clases', e.target.value)} style={{ ...estiloInput('total_clases' in ed), width: '64px' }} /> : <span style={{ color: '#334155', fontWeight: 600 }}>{plan.total_clases}</span>}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>{modoEdicion ? <input type="number" value={getNum(plan, 'duracion_min')} onChange={e => editarNum(plan.id, 'duracion_min', e.target.value)} style={{ ...estiloInput('duracion_min' in ed), width: '64px' }} /> : <span style={{ color: '#334155' }}>{plan.duracion_min} min</span>}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>{plan.clases_tomadas}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>{modoEdicion ? <input type="number" value={getNum(plan, 'conteo_whatsapp')} onChange={e => editarNum(plan.id, 'conteo_whatsapp', e.target.value)} placeholder="—" style={{ ...estiloInput('conteo_whatsapp' in ed), width: '64px' }} /> : plan.conteo_whatsapp !== null ? <span style={{ color: '#334155' }}>{plan.conteo_whatsapp}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}><span style={{ background: diffBg, color: diffColor, borderRadius: '20px', padding: '3px 12px', fontWeight: 700, fontSize: '13px', display: 'inline-block' }}>{diff === 0 ? '✓ 0' : `+${diff}`}</span></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
      {!cargando && !error && filtrados.length > 0 && <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'right' }}>Mostrando {filtrados.length} de {datos.length} planes</div>}
    </div>
  )
}
