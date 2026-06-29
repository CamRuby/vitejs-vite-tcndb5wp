import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { calcularNumeracion } from '../utils/numeracionClases'
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'
pdfMake.vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs

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
interface TallerInscripcion {
  id: string; cliente_nombre: string; taller_id: string; taller_nombre: string
  sede_nombre: string; sede_id: string | null; fecha_inicio: string | null; fecha_fin: string | null
  num_sesiones: number; valor_plan: number | null; total_pagado: number; saldo: number
  estado: string; abonos: Abono[]
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
  { id: 'honorarios_profesores', icono: '👩‍🏫', titulo: 'Honorarios mensuales profesores', descripcion: 'Clases, tiempo y honorarios por profesor y sede, con totales mensuales' },
]

export default function Reportes({ rol }: { rol?: string }) {
  const [reporteActivo, setReporteActivo] = useState<string | null>(null)

  if (reporteActivo === 'control_pagos') return <ReporteControlPagos onVolver={() => setReporteActivo(null)} />
  if (reporteActivo === 'clases_tomadas') return <ReporteClasesTomadasPlaceholder onVolver={() => setReporteActivo(null)} />
  if (reporteActivo === 'honorarios_profesores') return <ReporteHonorariosProfesores onVolver={() => setReporteActivo(null)} />

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
  // Pestaña de talleres
  const [pestaña, setPestaña] = useState<'planes' | 'talleres'>('planes')
  const [datosTalleres, setDatosTalleres] = useState<TallerInscripcion[]>([])
  const [filtroTaller, setFiltroTaller] = useState('')
  const [cargandoTalleres, setCargandoTalleres] = useState(false)
  const [pagoTallerModal, setPagoTallerModal] = useState<TallerInscripcion | null>(null)

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

  useEffect(() => { if (pestaña === 'talleres') cargarDatosTalleres() }, [mes, pestaña])

  async function cargarDatosTalleres() {
    setCargandoTalleres(true)
    try {
      const mesInicio = `${mes}-01`
      const [anio, mesNum] = mes.split('-')
      const ultimoDia = new Date(parseInt(anio), parseInt(mesNum), 0).getDate()
      const mesFin = `${mes}-${String(ultimoDia).padStart(2,'0')}`
      const { data: inscripciones } = await supabase.from('taller_inscripciones')
        .select('id, taller_id, cliente_id, fecha_inicio, fecha_fin, num_sesiones, valor_plan, total_pagado, saldo, estado, clientes(nombre), talleres(nombre, salones(sede_id, sedes(nombre)))')
        .gte('fecha_inicio', mesInicio).lte('fecha_inicio', mesFin)
        .order('fecha_inicio', { ascending: true })
      const ids = (inscripciones || []).map((i: any) => i.id)
      let pagosMap: Record<string, Abono[]> = {}
      if (ids.length > 0) {
        const { data: pagos } = await supabase.from('pagos')
          .select('id, inscripcion_id, fecha, monto, metodo').in('inscripcion_id', ids).order('fecha', { ascending: true })
        ;(pagos || []).forEach((p: any) => {
          if (!pagosMap[p.inscripcion_id]) pagosMap[p.inscripcion_id] = []
          pagosMap[p.inscripcion_id].push({ id: p.id, fecha: p.fecha, monto: Number(p.monto), metodo: p.metodo || '—' })
        })
      }
      setDatosTalleres((inscripciones || []).map((i: any) => ({
        id: i.id, cliente_nombre: i.clientes?.nombre || '—',
        taller_id: i.taller_id, taller_nombre: i.talleres?.nombre || '—',
        sede_nombre: i.talleres?.salones?.sedes?.nombre || '—',
        sede_id: i.talleres?.salones?.sede_id || null,
        fecha_inicio: i.fecha_inicio, fecha_fin: i.fecha_fin,
        num_sesiones: i.num_sesiones || 0, valor_plan: i.valor_plan ? Number(i.valor_plan) : null,
        total_pagado: Number(i.total_pagado || 0), saldo: Number(i.saldo || 0),
        estado: i.estado, abonos: pagosMap[i.id] || [],
      })))
    } finally { setCargandoTalleres(false) }
  }

  async function borrarAbonoTaller(abonoId: string, inscripcionId: string) {
    setBorrandoAbono(true)
    const ins = datosTalleres.find(t => t.id === inscripcionId)
    if (ins) {
      const nuevoTotal = ins.total_pagado - (ins.abonos.find(a => a.id === abonoId)?.monto || 0)
      const nuevoSaldo = (ins.valor_plan || 0) - nuevoTotal
      await supabase.from('pagos').delete().eq('id', abonoId)
      await supabase.from('taller_inscripciones').update({ total_pagado: nuevoTotal, saldo: nuevoSaldo }).eq('id', inscripcionId)
    }
    setConfirmarBorrarAbono(null); setBorrandoAbono(false)
    setMensajeOk('Pago eliminado'); setTimeout(() => setMensajeOk(''), 3000)
    await cargarDatosTalleres()
  }

  async function registrarPagoTaller() {
    if (!pagoTallerModal) return
    if (!nuevoMonto || Number(nuevoMonto) <= 0) { setErrorPago('Ingresa un monto válido'); return }
    if (!pagoTallerModal.valor_plan && !nuevoValorPlan) { setErrorPago('Ingresa el valor del plan antes de continuar.'); return }
    setGuardandoPago(true); setErrorPago('')
    if (nuevoValorPlan && Number(nuevoValorPlan) > 0)
      await supabase.from('taller_inscripciones').update({ valor_plan: Number(nuevoValorPlan) }).eq('id', pagoTallerModal.id)
    const nuevoTotal = pagoTallerModal.total_pagado + Number(nuevoMonto)
    const valorPlan = nuevoValorPlan ? Number(nuevoValorPlan) : (pagoTallerModal.valor_plan || 0)
    const nuevoSaldo = valorPlan - nuevoTotal
    const { error } = await supabase.from('pagos').insert({ inscripcion_id: pagoTallerModal.id, monto: Number(nuevoMonto), metodo: nuevoMetodo, fecha: nuevoFecha })
    if (error) { setErrorPago('Error: ' + error.message); setGuardandoPago(false); return }
    await supabase.from('taller_inscripciones').update({ total_pagado: nuevoTotal, saldo: nuevoSaldo }).eq('id', pagoTallerModal.id)
    setGuardandoPago(false); setPagoTallerModal(null); setNuevoMonto(''); setNuevoValorPlan('')
    setNuevoMetodo(METODOS_PAGO[0]); setNuevoFecha(new Date().toISOString().split('T')[0])
    setMensajeOk('Pago registrado'); setTimeout(() => setMensajeOk(''), 3000)
    await cargarDatosTalleres()
  }

  function estadoPagoT(t: TallerInscripcion): FiltroPago {
    if (!t.valor_plan) return 'sin_pago'
    if (t.total_pagado === 0) return 'sin_pago'
    if (t.saldo <= 0) return 'al_dia'
    return 'parcial'
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
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>{pestaña === 'planes' ? `Planes iniciados en ${labelMes}` : `Talleres con inscripción en ${labelMes}`}</p>
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

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `2px solid ${TEAL_MID}`, paddingBottom: '0' }}>
        {(['planes', 'talleres'] as const).map(p => (
          <button key={p} onClick={() => setPestaña(p)}
            style={{ padding: '8px 20px', background: pestaña === p ? TEAL : 'white', color: pestaña === p ? 'white' : TEAL_DARK, border: `1.5px solid ${pestaña === p ? TEAL : TEAL_MID}`, borderBottom: 'none', borderRadius: '8px 8px 0 0', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
            {p === 'planes' ? '📋 Planes' : '🎸 Talleres'}
          </button>
        ))}
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

      {/* Totales — muestran planes o talleres según la pestaña activa */}
      {pestaña === 'planes' && !cargando && filtrados.length > 0 && (
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
      {pestaña === 'talleres' && !cargandoTalleres && datosTalleres.length > 0 && (() => {
        const ft = datosTalleres.filter(t => {
          if (filtroSede && t.sede_id !== filtroSede) return false
          if (filtroTaller && t.taller_id !== filtroTaller) return false
          if (filtroMetodo && !t.abonos.some(a => a.metodo === filtroMetodo)) return false
          if (filtroPago !== 'todos' && estadoPagoT(t) !== filtroPago) return false
          if (busqueda && !t.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) && !t.taller_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
          return true
        })
        const tvTotal = ft.reduce((s, t) => s + (t.valor_plan || 0), 0)
        const tvPagado = ft.reduce((s, t) => s + t.total_pagado, 0)
        const tvSaldo = ft.reduce((s, t) => s + t.saldo, 0)
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Inscripciones',  valor: String(ft.length),                        color: TEAL },
              { label: 'Valor total',    valor: `$${tvTotal.toLocaleString('es-CO')}`,    color: '#7c3aed' },
              { label: 'Recaudado',      valor: `$${tvPagado.toLocaleString('es-CO')}`,   color: '#16a34a' },
              { label: 'Saldo pendiente',valor: `$${tvSaldo.toLocaleString('es-CO')}`,    color: tvSaldo > 0 ? '#dc2626' : '#16a34a' },
            ].map(t => (
              <div key={t.label} style={{ background: 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '10px', padding: '12px 16px' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: t.color }}>{t.valor}</div>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>{t.label}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {pestaña === 'planes' && <>
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
      </>}

      {/* ── PESTAÑA TALLERES ── */}
      {pestaña === 'talleres' && (() => {
        const talleresUnicos = [...new Map(datosTalleres.map(t => [t.taller_id, { id: t.taller_id, nombre: t.taller_nombre }])).values()]
        const filtradosTalleres = datosTalleres.filter(t => {
          if (filtroSede && t.sede_id !== filtroSede) return false
          if (filtroTaller && t.taller_id !== filtroTaller) return false
          if (filtroMetodo && !t.abonos.some(a => a.metodo === filtroMetodo)) return false
          if (filtroPago !== 'todos' && estadoPagoT(t) !== filtroPago) return false
          if (busqueda && !t.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) && !t.taller_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
          return true
        })
        const tvTotal = filtradosTalleres.reduce((s, t) => s + (t.valor_plan || 0), 0)
        const tvPagado = filtradosTalleres.reduce((s, t) => s + t.total_pagado, 0)
        const tvSaldo = filtradosTalleres.reduce((s, t) => s + t.saldo, 0)
        return (<>
          <div style={{ marginBottom: '10px' }}>
            <select value={filtroTaller} onChange={e => setFiltroTaller(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${filtroTaller ? TEAL : TEAL_MID}`, background: filtroTaller ? TEAL_LIGHT : 'white', color: filtroTaller ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
              <option value="">🎸 Todos los talleres</option>
              {talleresUnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          {cargandoTalleres && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando...</div>}
          {!cargandoTalleres && filtradosTalleres.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', background: 'white', borderRadius: '12px', border: `1px solid ${TEAL_MID}` }}>
              No hay inscripciones a talleres en {labelMes}.
            </div>
          )}
          {!cargandoTalleres && filtradosTalleres.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtradosTalleres.map(ins => {
                const saldoColor = ins.saldo > 0 ? '#dc2626' : ins.saldo < 0 ? '#7c3aed' : '#16a34a'
                const saldoBg = ins.saldo > 0 ? '#fef2f2' : ins.saldo < 0 ? '#f3e8ff' : '#f0fdf4'
                const ep = estadoPagoT(ins)
                const borderColor = ep === 'sin_pago' ? '#fecaca' : ep === 'parcial' ? '#fde68a' : '#e5e7eb'
                return (
                  <div key={ins.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${borderColor}`, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <div className="rcp-tarjeta">
                      <div>
                        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{ins.cliente_nombre}</p>
                        <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#9ca3af' }}>{ins.taller_nombre}</p>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{ins.sede_nombre}</p>
                      </div>
                      <div>
                        <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b7280' }}>{ins.fecha_inicio} → {ins.fecha_fin || '—'}</p>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#374151' }}>{ins.num_sesiones} sesiones</p>
                      </div>
                      <div className="rcp-pagos">
                        <div className="rcp-cifras" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div className="rcp-cifra" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Valor</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#374151' }}>
                              {ins.valor_plan ? `$${ins.valor_plan.toLocaleString('es-CO')}` : <span style={{ color: '#dc2626', fontSize: '12px' }}>Sin valor</span>}
                            </span>
                          </div>
                          <div className="rcp-cifra" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#9ca3af' }}>Pagado</span>
                            <span style={{ fontSize: '15px', fontWeight: 700, color: '#16a34a' }}>${ins.total_pagado.toLocaleString('es-CO')}</span>
                          </div>
                          <div className="rcp-cifra" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: saldoBg, borderRadius: '8px', padding: '5px 8px', marginTop: '2px' }}>
                            <span style={{ fontSize: '12px', color: saldoColor, fontWeight: 600 }}>Saldo</span>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: saldoColor }}>
                              {ins.saldo === 0 ? '✓ $0' : ins.saldo > 0 ? `-$${ins.saldo.toLocaleString('es-CO')}` : `+$${Math.abs(ins.saldo).toLocaleString('es-CO')}`}
                            </span>
                          </div>
                          {modoEdicion && (
                            <button onClick={() => { setPagoTallerModal(ins); setNuevoMonto(''); setNuevoMetodo(METODOS_PAGO[0]); setNuevoFecha(new Date().toISOString().split('T')[0]); setNuevoValorPlan(''); setErrorPago('') }}
                              style={{ marginTop: '6px', padding: '7px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                              + Registrar pago
                            </button>
                          )}
                        </div>
                        <div>
                          {ins.abonos.length === 0
                            ? <p style={{ margin: 0, fontSize: '12px', color: '#d1d5db', fontStyle: 'italic' }}>Sin abonos</p>
                            : <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {ins.abonos.map(a => (
                                  <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', minWidth: '52px' }}>{a.fecha.substring(5)}</span>
                                    <span style={{ fontSize: '12px', color: '#374151', flex: 1 }}>{a.metodo}</span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>${a.monto.toLocaleString('es-CO')}</span>
                                    {modoEdicion && (
                                      confirmarBorrarAbono?.abonoId === a.id
                                        ? <div style={{ display: 'flex', gap: '4px' }}>
                                            <button onClick={() => borrarAbonoTaller(a.id, ins.id)} disabled={borrandoAbono}
                                              style={{ padding: '2px 8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                                              {borrandoAbono ? '...' : '✓'}
                                            </button>
                                            <button onClick={() => setConfirmarBorrarAbono(null)}
                                              style={{ padding: '2px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                          </div>
                                        : <button onClick={() => setConfirmarBorrarAbono({ abonoId: a.id, planId: ins.id })}
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
        </>)
      })()}

      {/* Modal registrar pago taller */}
      {pagoTallerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%' }}>
            <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 800, color: '#111' }}>+ Registrar pago</p>
            <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#9ca3af' }}>{pagoTallerModal.cliente_nombre}</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#7c3aed', fontWeight: 600 }}>🎸 {pagoTallerModal.taller_nombre}</p>
            {!pagoTallerModal.valor_plan && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>⚠ Inscripción sin valor registrado</p>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>Valor de la inscripción ($) *</label>
                <input type="number" value={nuevoValorPlan} onChange={e => setNuevoValorPlan(e.target.value)} placeholder="Ej: 120000" autoFocus
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
                  {pagoTallerModal.valor_plan && pagoTallerModal.saldo > 0 && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#9ca3af', fontWeight: 400 }}>Saldo: ${pagoTallerModal.saldo.toLocaleString('es-CO')}</span>
                  )}
                </label>
                <input type="number" value={nuevoMonto} onChange={e => setNuevoMonto(e.target.value)} placeholder="0"
                  style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' as const }} />
              </div>
              {errorPago && <p style={{ margin: 0, color: '#dc2626', fontSize: '13px' }}>⚠ {errorPago}</p>}
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button onClick={() => { setPagoTallerModal(null); setErrorPago(''); setNuevoValorPlan('') }}
                  style={{ flex: 1, padding: '12px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Cancelar</button>
                <button onClick={registrarPagoTaller} disabled={guardandoPago}
                  style={{ flex: 2, padding: '12px', background: guardandoPago ? '#a0c8c8' : TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: guardandoPago ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 700 }}>
                  {guardandoPago ? 'Guardando...' : '✓ Registrar pago'}
                </button>
              </div>
            </div>
          </div>
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
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1.5px solid ${TEAL_MID}`, background: '#fff', position: 'relative' }}>
          <table style={{ width: '100%', minWidth: '900px', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px' }}>
            <thead><tr style={{ background: TEAL, color: '#fff' }}>
              {columnas.map((h, i) => <th key={i} style={{
                  padding: '11px 14px', fontWeight: 700,
                  textAlign: i === 0 || i >= 5 ? 'center' : 'left',
                  whiteSpace: 'nowrap', fontSize: '12px',
                  ...(i === 0 ? { position: 'sticky', left: 0, zIndex: 3, background: TEAL } : {}),
                  ...(i === 1 ? { position: 'sticky', left: '44px', zIndex: 3, background: TEAL, boxShadow: '2px 0 4px rgba(0,0,0,0.12)' } : {}),
                }}>{h}{modoEdicion && editables.includes(h) ? ' ✏️' : ''}</th>)}
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
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600, position: 'sticky', left: 0, zIndex: 1, background: Object.keys(ed).length > 0 ? '#fffde7' : idx % 2 === 0 ? '#fff' : '#fafefe' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', position: 'sticky', left: '44px', zIndex: 1, background: Object.keys(ed).length > 0 ? '#fffde7' : idx % 2 === 0 ? '#fff' : '#fafefe', boxShadow: '2px 0 4px rgba(0,0,0,0.08)' }}>{plan.cliente_nombre}</td>
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

// ─── REPORTE: HONORARIOS MENSUALES PROFESORES ────────────────────────────────
interface SedeResumen { sede_nombre: string; clases: number; minutos: number; honorario: number }
interface ProfesorHonorario {
  profesor_id: string; nombre: string
  cc: string | null; ciudad: string | null; ciudad_cc: string | null
  banco: string | null; tipo_cuenta: string | null; numero_cuenta: string | null
  porSede: Record<string, SedeResumen>
  totalClases: number; totalMinutos: number; totalHonorario: number
  detalle: any[]
  aprobado: boolean; pagado: boolean
}

function formatTiempo(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

function formatHoraAmPmH(hora: string): string {
  if (!hora) return '—'
  const [h, m] = hora.substring(0, 5).split(':').map(Number)
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

function numerosALetrasH(n: number): string {
  const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve']
  const decenas = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
    'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
  if (n === 0) return 'cero'
  if (n === 100) return 'cien'
  if (n < 20) return unidades[n]
  if (n < 100) return decenas[Math.floor(n / 10)] + (n % 10 ? ' y ' + unidades[n % 10] : '')
  if (n < 1000) return centenas[Math.floor(n / 100)] + (n % 100 ? ' ' + numerosALetrasH(n % 100) : '')
  if (n < 1000000) {
    const miles = Math.floor(n / 1000)
    const resto = n % 1000
    return (miles === 1 ? 'mil' : numerosALetrasH(miles) + ' mil') + (resto ? ' ' + numerosALetrasH(resto) : '')
  }
  return n.toLocaleString('es-CO')
}

function nombreClienteH(c: any) {
  const cl = c.contratos?.clientes
  if (!cl) return '—'
  return cl.nombre || `${cl.nombres || ''} ${cl.apellidos || ''}`.trim() || '—'
}

// Misma regla que usa cada profesor en su app para ver su honorario por clase.
// 'pendiente' significa que un admin aún no decide el valor (ej. inasistencia sin resolver).
function getHonorarioPDF(c: any, tarifasProfesor: any[]): number | 'pendiente' {
  const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia
  if (c.estado !== 'dada' && !esInasistencia) return 0
  if (c.esTaller) return c.honorario_valor !== null && c.honorario_valor !== undefined ? Number(c.honorario_valor) : 0
  if (esInasistencia && c.honorario_valor === null) return 'pendiente'
  if (c.honorario_valor !== null && c.honorario_valor !== undefined) return Number(c.honorario_valor)
  if (c.estado !== 'dada') return 0
  const modalidad = (c.modalidad || 'presencial').toLowerCase()
  const duracion = Number(c.duracion_min)
  let tarifa = tarifasProfesor.find((t: any) => t.modalidad?.toLowerCase() === modalidad && Number(t.duracion_min) === duracion)
  if (!tarifa && (modalidad === 'presencial' || modalidad === 'virtual')) {
    tarifa = tarifasProfesor.find((t: any) =>
      (t.modalidad?.toLowerCase() === 'presencial' || t.modalidad?.toLowerCase() === 'virtual') && Number(t.duracion_min) === duracion)
  }
  return tarifa ? Number(tarifa.valor) : 0
}

function ReporteHonorariosProfesores({ onVolver }: { onVolver: () => void }) {
  const [profesoresData, setProfesoresData] = useState<ProfesorHonorario[]>([])
  const [totalesPorSede, setTotalesPorSede] = useState<Record<string, { sede_nombre: string; honorario: number; clases: number; estudiantes: number }>>({})
  const [totalEstudiantesActivos, setTotalEstudiantesActivos] = useState(0)
  const [tarifas, setTarifas] = useState<any[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mes, setMes] = useState(mesActual())
  const [sedesSeleccionadas, setSedesSeleccionadas] = useState<string[]>([])
  const [generandoPdf, setGenerandoPdf] = useState<string | null>(null)

  function toggleSede(id: string) {
    setSedesSeleccionadas(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

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

      // Mismo filtro que usa la app del profesor: solo clases dadas, o canceladas que
      // no fueron canceladas por la academia (esas sí cuentan como inasistencia del cliente).
      const [
        { data: profesores, error: errP },
        { data: tarifasData, error: errT },
        { data: clases, error: errC },
        { data: talleresList, error: errTa },
        { data: estados, error: errE },
      ] = await Promise.all([
        supabase.from('profesores').select('id, nombre, cc, ciudad, ciudad_cc, banco, tipo_cuenta, numero_cuenta'),
        supabase.from('profesor_tarifas').select('profesor_id, modalidad, duracion_min, taller_grupal, valor').eq('taller_grupal', false),
        supabase.from('clases_con_numero')
          .select('id, fecha, hora, duracion_min, estado, modalidad, cancelado_por_academia, es_cortesia, observaciones, contrato_id, honorario_valor, profesor_id, contratos(cliente_id, clientes(nombre, nombres, apellidos), total_clases), salones(sede_id, sedes(nombre))')
          .gte('fecha', fechaInicio).lte('fecha', fechaFin)
          .in('estado', ['dada', 'cancelada'])
          .or('estado.eq.dada,cancelado_por_academia.eq.false'),
        supabase.from('talleres').select('id, nombre, hora, duracion_min, profesor_id, salones(sede_id, sedes(nombre))'),
        supabase.from('honorarios_estado').select('profesor_id, aprobado, pagado').eq('mes', mes),
      ])
      if (errP || errT || errC || errTa || errE) throw (errP || errT || errC || errTa || errE)

      // Talleres: solo sesiones efectivamente dadas (la app del profesor nunca incluye
      // sesiones de taller canceladas en la cuenta de cobro).
      const tallerIds = (talleresList || []).map((t: any) => t.id)
      let sesiones: any[] = []
      if (tallerIds.length > 0) {
        const { data: s } = await supabase.from('taller_sesiones')
          .select('id, fecha, observaciones, honorario_valor, taller_id')
          .eq('estado', 'dada')
          .gte('fecha', fechaInicio).lte('fecha', fechaFin)
          .in('taller_id', tallerIds)
        sesiones = s || []
      }
      const tallerMap: Record<string, any> = {}
      ;(talleresList || []).forEach((t: any) => { tallerMap[t.id] = t })
      const tallerRows = sesiones.map((s: any) => {
        const t = tallerMap[s.taller_id]
        return {
          id: `taller-sesion-${s.id}`, fecha: s.fecha, hora: t?.hora || '00:00:00',
          duracion_min: t?.duracion_min, estado: 'dada', esTaller: true,
          nombreTaller: t?.nombre, salones: t?.salones, observaciones: s.observaciones,
          contratos: null, cancelado_por_academia: false, es_cortesia: false,
          honorario_valor: s.honorario_valor ?? null, modalidad: 'taller',
          profesor_id: t?.profesor_id || null, contrato_id: null,
        }
      })

      // Numeración de clases: misma "fuente única de verdad" que usa la app del
      // profesor (calcularNumeracion), no la del campo precalculado en la vista.
      const contratosDelMes = [...new Set((clases || []).map((c: any) => c.contrato_id).filter(Boolean))]
      const numeracionMap: Map<string, number> = new Map()
      if (contratosDelMes.length > 0) {
        const { data: todasClasesContrato } = await supabase
          .from('clases')
          .select('id, fecha, hora, duracion_min, estado, cancelado_por_academia, cancelado_tarde, es_cortesia, inasistencia_perdonada, contrato_id, contratos(duracion_min)')
          .in('contrato_id', contratosDelMes)
        const porContrato: Record<string, any[]> = {}
        ;(todasClasesContrato || []).forEach((c: any) => {
          if (!porContrato[c.contrato_id]) porContrato[c.contrato_id] = []
          porContrato[c.contrato_id].push(c)
        })
        Object.entries(porContrato).forEach(([, clasesContrato]) => {
          const durPlan = clasesContrato[0]?.contratos?.duracion_min || 60
          const numMap = calcularNumeracion(clasesContrato, durPlan)
          numMap.forEach((num, id) => numeracionMap.set(id, num))
        })
      }

      const clasesConNumero = (clases || []).map((c: any) => ({ ...c, numero_calculado: numeracionMap.get(c.id) ?? null }))
      const todasClases = [...clasesConNumero, ...tallerRows]
      const tarifasL = tarifasData || []
      const estadoMap: Record<string, { aprobado: boolean; pagado: boolean }> = {}
      ;(estados || []).forEach((e: any) => { estadoMap[e.profesor_id] = { aprobado: !!e.aprobado, pagado: !!e.pagado } })

      const mapa: Record<string, ProfesorHonorario> = {}
      const sedeTotales: Record<string, { sede_nombre: string; honorario: number; clases: number; estudiantesSet: Set<string> }> = {}
      const estudiantesGlobalSet = new Set<string>()
      function ensure(profId: string): ProfesorHonorario {
        if (!mapa[profId]) {
          const p = (profesores || []).find((x: any) => x.id === profId)
          mapa[profId] = {
            profesor_id: profId, nombre: p?.nombre || '—',
            cc: p?.cc || null, ciudad: p?.ciudad || null, ciudad_cc: p?.ciudad_cc || null,
            banco: p?.banco || null, tipo_cuenta: p?.tipo_cuenta || null, numero_cuenta: p?.numero_cuenta || null,
            porSede: {}, totalClases: 0, totalMinutos: 0, totalHonorario: 0, detalle: [],
            aprobado: estadoMap[profId]?.aprobado || false, pagado: estadoMap[profId]?.pagado || false,
          }
        }
        return mapa[profId]
      }

      // Esta es la MISMA regla y la MISMA función (getHonorarioPDF) que se usa más abajo
      // para generar la cuenta de cobro. Así la tabla y el PDF nunca pueden quedar distintos.
      todasClases.forEach((c: any) => {
        if (!c.profesor_id) return
        const g = ensure(c.profesor_id)
        g.detalle.push(c)

        const cuenta = (c.estado === 'dada' && !c.es_cortesia) || (c.estado === 'cancelada' && !c.cancelado_por_academia)
        if (!cuenta) return

        const tarifasProf = tarifasL.filter((t: any) => t.profesor_id === c.profesor_id)
        const hon = getHonorarioPDF(c, tarifasProf)
        const honorarioNum = hon === 'pendiente' ? 0 : hon

        const sedeId = c.salones?.sede_id || null
        const sedeNombre = c.salones?.sedes?.nombre || '—'
        const key = sedeId || 'sin_sede'
        if (!g.porSede[key]) g.porSede[key] = { sede_nombre: sedeNombre, clases: 0, minutos: 0, honorario: 0 }
        g.porSede[key].clases += 1
        g.porSede[key].minutos += Number(c.duracion_min || 0)
        g.porSede[key].honorario += honorarioNum
        g.totalClases += 1
        g.totalMinutos += Number(c.duracion_min || 0)
        g.totalHonorario += honorarioNum

        // Totales por sede: independientes del profesor y del filtro de la tabla.
        if (!sedeTotales[key]) sedeTotales[key] = { sede_nombre: sedeNombre, honorario: 0, clases: 0, estudiantesSet: new Set() }
        sedeTotales[key].honorario += honorarioNum
        sedeTotales[key].clases += 1
        const clienteId = c.contratos?.cliente_id
        if (clienteId) { sedeTotales[key].estudiantesSet.add(clienteId); estudiantesGlobalSet.add(clienteId) }
      })

      setTarifas(tarifasL)
      setProfesoresData(Object.values(mapa).sort((a, b) => a.nombre.localeCompare(b.nombre)))
      const totalesSede: Record<string, { sede_nombre: string; honorario: number; clases: number; estudiantes: number }> = {}
      Object.entries(sedeTotales).forEach(([key, v]) => {
        totalesSede[key] = { sede_nombre: v.sede_nombre, honorario: v.honorario, clases: v.clases, estudiantes: v.estudiantesSet.size }
      })
      setTotalesPorSede(totalesSede)
      setTotalEstudiantesActivos(estudiantesGlobalSet.size)
    } catch { setError('No se pudieron cargar los datos.') }
    finally { setCargando(false) }
  }

  async function actualizarEstado(profesorId: string, campo: 'aprobado' | 'pagado', valor: boolean) {
    const g = profesoresData.find(p => p.profesor_id === profesorId)
    if (!g) return
    const aprobadoAnterior = g.aprobado
    const pagadoAnterior = g.pagado
    const aprobado = campo === 'aprobado' ? valor : g.aprobado
    const pagado = campo === 'pagado' ? valor : g.pagado
    setProfesoresData(prev => prev.map(p => p.profesor_id === profesorId ? { ...p, aprobado, pagado } : p))
    const { error: errGuardar } = await supabase
      .from('honorarios_estado')
      .upsert({ profesor_id: profesorId, mes, aprobado, pagado }, { onConflict: 'profesor_id,mes' })
    if (errGuardar) {
      console.error('Error al guardar aprobado/pagado:', errGuardar)
      setProfesoresData(prev => prev.map(p => p.profesor_id === profesorId ? { ...p, aprobado: aprobadoAnterior, pagado: pagadoAnterior } : p))
      setError(`No se pudo guardar el estado de ${g.nombre}. Detalle: ${errGuardar.message}`)
    }
  }

  function generarPdfProfesor(g: ProfesorHonorario) {
    setGenerandoPdf(g.profesor_id)
    try {
      const tarifasProf = tarifas.filter((t: any) => t.profesor_id === g.profesor_id)
      const [anio, mesNum] = mes.split('-')
      const nombreMes = MESES[parseInt(mesNum) - 1].toLowerCase()
      const mesLabelCap = `${MESES[parseInt(mesNum) - 1]} ${anio}`
      const primerDia = `01 de ${nombreMes}`
      const ultimoDiaNum = new Date(parseInt(anio), parseInt(mesNum), 0).getDate()
      const ultimoDiaLabel = `${ultimoDiaNum} de ${nombreMes}`
      const fechaEmision = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })

      const clasesDadas = g.detalle.filter((c: any) => (c.estado === 'dada' && !c.es_cortesia) || (c.estado === 'cancelada' && !c.cancelado_por_academia))
      const totalHon = clasesDadas.reduce((s: number, c: any) => { const h = getHonorarioPDF(c, tarifasProf); return h === 'pendiente' ? s : s + h }, 0)
      const totalEnLetras = numerosALetrasH(totalHon)

      const porDuracion: Record<number, number> = {}
      clasesDadas.filter((c: any) => c.estado === 'dada' && !c.es_cortesia && !c.esTaller).forEach((c: any) => {
        const d = Number(c.duracion_min) || 60
        porDuracion[d] = (porDuracion[d] || 0) + 1
      })
      const resumenClases = Object.entries(porDuracion).sort(([a], [b]) => Number(b) - Number(a))
        .map(([dur, qty]) => `${qty} clase${qty > 1 ? 's' : ''} de (${dur} minutos)`).join(', ')
      const talleresDados = clasesDadas.filter((c: any) => c.esTaller)
      const tallerStr = talleresDados.length > 0 ? ` y ${talleresDados.length} sesión${talleresDados.length > 1 ? 'es' : ''} de taller` : ''

      const filaDetalle: any[] = []
      clasesDadas.forEach((c: any) => {
        const hon = getHonorarioPDF(c, tarifasProf)
        const honStr = hon === 'pendiente' ? '—' : `$${Number(hon).toLocaleString('es-CO')}`
        const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia
        const resumenTexto = esInasistencia ? 'El estudiante no asistió, sin resumen de clase.' : (c.observaciones || '—')
        const num = c.numero_calculado && c.contratos?.total_clases ? `${c.numero_calculado}/${c.contratos.total_clases}` : ''
        const nombreEst = c.esTaller ? `🎸 ${c.nombreTaller || 'Taller'}` : nombreClienteH(c)
        filaDetalle.push([
          { text: `${c.fecha?.substring(8, 10)}/${c.fecha?.substring(5, 7)}`, fontSize: 8 },
          { text: formatHoraAmPmH(c.hora), fontSize: 8 },
          { text: `${c.duracion_min}m`, fontSize: 8, alignment: 'center' },
          { stack: [{ text: nombreEst, fontSize: 8, bold: true }, num ? { text: num, fontSize: 7, color: '#888' } : {}] },
          { text: resumenTexto, fontSize: 7, color: esInasistencia ? '#c2410c' : '#555', italics: esInasistencia, bold: esInasistencia },
          { text: honStr, fontSize: 8, alignment: 'right', bold: true }
        ])
      })

      const nombre = g.nombre || '—'
      const cc = g.cc || '—'
      const ciudad = g.ciudad || 'Bogotá'
      const ciudadCC = g.ciudad_cc || null
      const banco = g.banco || '—'
      const tipoCuenta = g.tipo_cuenta || 'Ahorros'
      const numCuenta = g.numero_cuenta || '—'

      const docDef: any = {
        pageSize: 'A4',
        pageMargins: [60, 60, 60, 60],
        info: { title: `Cuenta de Cobro ${mesLabelCap} - ${nombre}` },
        content: [
          { text: `${ciudad}, ${fechaEmision}`, fontSize: 10, margin: [0, 0, 0, 20] },
          { text: 'IDEAL BUSSINESS S.A.S.', fontSize: 11, bold: true, alignment: 'center' },
          { text: 'N.I.T. 901.257.419-4', fontSize: 10, alignment: 'center', margin: [0, 2, 0, 2] },
          { text: 'Debe a:', fontSize: 10, alignment: 'center', margin: [0, 10, 0, 4] },
          { text: nombre, fontSize: 11, bold: true, alignment: 'center' },
          { text: ciudadCC ? `C.C. No. ${cc} de ${ciudadCC}.` : `C.C. No. ${cc}.`, fontSize: 10, alignment: 'center', margin: [0, 2, 0, 20] },
          { text: 'La Suma de:', fontSize: 10, alignment: 'center', margin: [0, 0, 0, 6] },
          { text: `$${totalHon.toLocaleString('es-CO')} (${totalEnLetras} pesos.)`, fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 20] },
          { text: 'Por concepto de:', fontSize: 10, alignment: 'center', margin: [0, 0, 0, 8] },
          { text: `Clases dictadas (${resumenClases}${tallerStr}) individual en modalidad presencial durante el periodo comprendido entre el `, fontSize: 10, alignment: 'center', margin: [0, 0, 0, 4] },
          { text: `${primerDia} al ${ultimoDiaLabel} del año ${anio}.`, fontSize: 10, bold: true, alignment: 'center', margin: [0, 0, 0, 16] },
          filaDetalle.length > 0 ? {
            table: {
              headerRows: 1,
              widths: [30, 44, 22, 70, '*', 52],
              body: [
                [
                  { text: 'FECHA', style: 'dth' }, { text: 'HORA', style: 'dth' }, { text: 'DUR.', style: 'dth' },
                  { text: 'ESTUDIANTE', style: 'dth' }, { text: 'RESUMEN DE LA CLASE', style: 'dth' }, { text: 'HONORARIO', style: 'dth' }
                ],
                ...filaDetalle,
                [
                  { text: 'TOTAL', colSpan: 5, bold: true, fontSize: 9, fillColor: '#f1f5f9', alignment: 'right' }, {}, {}, {}, {},
                  { text: `$${totalHon.toLocaleString('es-CO')}`, bold: true, fontSize: 10, fillColor: '#f1f5f9', alignment: 'right' }
                ]
              ]
            },
            layout: {
              fillColor: (i: number) => i === 0 ? '#f1f5f9' : null,
              hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => '#e0e0e0',
              paddingLeft: () => 5, paddingRight: () => 5, paddingTop: () => 4, paddingBottom: () => 4
            },
            margin: [0, 0, 0, 20]
          } : {},
          {
            text: (tipoCuenta === 'Nequi' || tipoCuenta === 'Daviplata')
              ? `Favor efectuar el pago a nombre de ${nombre} C.C. ${cc} al número de ${tipoCuenta} ${numCuenta}`
              : `Favor efectuar el pago a nombre de ${nombre} C.C. ${cc} a la cuenta de ${tipoCuenta.toLowerCase()} No. ${numCuenta} de ${banco}`,
            fontSize: 10, margin: [0, 0, 0, 40]
          },
          { text: 'Cordialmente', fontSize: 10, margin: [0, 0, 0, 50] },
          { text: nombre, fontSize: 10 },
          { text: `C.C. ${cc}`, fontSize: 10, margin: [0, 2, 0, 0] }
        ],
        styles: { dth: { fontSize: 8, bold: true, fillColor: '#f1f5f9', color: '#333' } }
      }

      pdfMake.createPdf(docDef).getBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 10000)
        setGenerandoPdf(null)
      })
    } catch { setError('No se pudo generar el PDF.'); setGenerandoPdf(null) }
  }

  const filtrados = sedesSeleccionadas.length === 0
    ? profesoresData
    : profesoresData.filter(g => sedesSeleccionadas.some(id => g.porSede[id]))
  const [anioSel, mesSel] = mes.split('-')
  const labelMes = `${MESES[parseInt(mesSel) - 1]} ${anioSel}`
  // Fijos: siempre se calculan sobre TODOS los profesores, sin importar el filtro de sede.
  const totalClases = profesoresData.reduce((s, g) => s + g.totalClases, 0)
  const totalHonorario = profesoresData.reduce((s, g) => s + g.totalHonorario, 0)
  const totalPagado = profesoresData.reduce((s, g) => s + (g.pagado ? g.totalHonorario : 0), 0)
  const totalSaldo = totalHonorario - totalPagado

  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL_DARK, fontWeight: 700, whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#1e293b', borderTop: '1px solid #f1f5f9' }
  const pillS = (activo: boolean): React.CSSProperties => ({
    padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
    border: `1.5px solid ${activo ? TEAL : '#e5e7eb'}`, background: activo ? TEAL : 'white', color: activo ? 'white' : '#475569'
  })

  // Mismo cálculo de Pagado/Saldo para cada sede, basado en el estado del profesor
  // (aprobado/pagado es por profesor, no por sede).
  function statsSede(sedeId: string) {
    const base = totalesPorSede[sedeId] || { honorario: 0, clases: 0, estudiantes: 0 }
    const pagado = profesoresData.reduce((s, g) => s + (g.pagado ? (g.porSede[sedeId]?.honorario || 0) : 0), 0)
    return { ...base, pagado, saldo: base.honorario - pagado }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: '1200px', margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: '0 0 2px' }}>👩‍🏫 Honorarios mensuales profesores</h2>
            <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Clases dadas en {labelMes}</p>
          </div>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ padding: '7px 12px', borderRadius: '10px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', fontWeight: 600, color: TEAL_DARK, outline: 'none', background: TEAL_LIGHT }} />
      </div>

      {/* Totales por sede + Todas las sedes: siempre los totales reales, sin importar el filtro */}
      {!cargando && sedes.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#888', margin: '0 0 8px', letterSpacing: '0.3px' }}>TOTALES POR SEDE</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${sedes.length + 1}, 1fr)`, gap: '10px' }}>
            {sedes.map(s => {
              const t = statsSede(s.id)
              return (
                <div key={s.id} style={{ background: 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '10px', padding: '12px 16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: TEAL_DARK, marginBottom: '8px' }}>{s.nombre}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    <span>Honorarios</span><span style={{ fontWeight: 700, color: '#16a34a' }}>${t.honorario.toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    <span>Clases dadas</span><span style={{ fontWeight: 700, color: '#7c3aed' }}>{t.clases}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    <span>Estudiantes activos</span><span style={{ fontWeight: 700, color: '#0ea5e9' }}>{t.estudiantes}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                    <span>Pagado</span><span style={{ fontWeight: 700, color: '#16a34a' }}>${t.pagado.toLocaleString('es-CO')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                    <span>Saldo</span><span style={{ fontWeight: 700, color: t.saldo > 0 ? '#dc2626' : '#16a34a' }}>${t.saldo.toLocaleString('es-CO')}</span>
                  </div>
                </div>
              )
            })}
            <div style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL}`, borderRadius: '10px', padding: '12px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: TEAL_DARK, marginBottom: '8px' }}>Todas las sedes</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                <span>Honorarios</span><span style={{ fontWeight: 700, color: '#16a34a' }}>${totalHonorario.toLocaleString('es-CO')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                <span>Clases dadas</span><span style={{ fontWeight: 700, color: '#7c3aed' }}>{totalClases}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                <span>Estudiantes activos</span><span style={{ fontWeight: 700, color: '#0ea5e9' }}>{totalEstudiantesActivos}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                <span>Pagado</span><span style={{ fontWeight: 700, color: '#16a34a' }}>${totalPagado.toLocaleString('es-CO')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
                <span>Saldo</span><span style={{ fontWeight: 700, color: totalSaldo > 0 ? '#dc2626' : '#16a34a' }}>${totalSaldo.toLocaleString('es-CO')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtro de sede: solo decide qué filas de la tabla se muestran. No afecta
          los indicadores de arriba ni los totales por sede, que son siempre fijos. */}
      {!cargando && sedes.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => setSedesSeleccionadas([])} style={pillS(sedesSeleccionadas.length === 0)}>Todas las sedes</button>
            {sedes.map(s => (
              <button key={s.id} onClick={() => toggleSede(s.id)} style={pillS(sedesSeleccionadas.includes(s.id))}>{s.nombre}</button>
            ))}
          </div>
        </div>
      )}

      {cargando && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando...</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}
      {!cargando && !error && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', background: 'white', borderRadius: '12px', border: `1px solid ${TEAL_MID}` }}>
          No hay clases dadas con los filtros seleccionados en {labelMes}.
        </div>
      )}

      {/* Tabla con una columna por sede. El filtro de sede solo oculta filas de profesores
          que no dieron clase en esa sede; no cambia la vista ni oculta las demás columnas. */}
      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
            <thead>
              <tr style={{ background: TEAL_LIGHT }}>
                <th style={thS}>Profesor</th>
                <th style={{ ...thS, textAlign: 'center' }}>Clases</th>
                <th style={{ ...thS, textAlign: 'center' }}>Tiempo</th>
                {sedes.map(s => <th key={s.id} style={{ ...thS, textAlign: 'right' }}>{s.nombre}</th>)}
                <th style={{ ...thS, textAlign: 'right' }}>Total</th>
                <th style={{ ...thS, textAlign: 'center' }}>Aprobado</th>
                <th style={{ ...thS, textAlign: 'center' }}>Pagado</th>

                <th style={{ ...thS, textAlign: 'center' }}>Cuenta de cobro</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(g => (
                <tr key={g.profesor_id}>
                  <td style={{ ...tdS }}>
                    <div style={{ fontWeight: 700 }}>{g.nombre}</div>
                    {(g.banco || g.numero_cuenta) && (
                      <div style={{ fontSize: '11px', color: '#a0b4b4', marginTop: '2px' }}>
                        {[g.banco, g.numero_cuenta].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={{ ...tdS, textAlign: 'center', color: '#7c3aed', fontWeight: 700 }}>{g.totalClases}</td>
                  <td style={{ ...tdS, textAlign: 'center', color: '#0ea5e9', fontWeight: 700 }}>{formatTiempo(g.totalMinutos)}</td>
                  {sedes.map(s => {
                    const d = g.porSede[s.id]
                    return <td key={s.id} style={{ ...tdS, textAlign: 'right', color: d ? '#16a34a' : '#d1d5db', fontWeight: d ? 700 : 400 }}>{d ? `$${d.honorario.toLocaleString('es-CO')}` : '—'}</td>
                  })}
                  <td style={{ ...tdS, textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>${g.totalHonorario.toLocaleString('es-CO')}</td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <input type="checkbox" checked={g.aprobado} onChange={e => actualizarEstado(g.profesor_id, 'aprobado', e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: TEAL }} />
                  </td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <input type="checkbox" checked={g.pagado} onChange={e => actualizarEstado(g.profesor_id, 'pagado', e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#16a34a' }} />
                  </td>
                  <td style={{ ...tdS, textAlign: 'center' }}>
                    <button onClick={() => generarPdfProfesor(g)} disabled={generandoPdf === g.profesor_id}
                      style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${TEAL_MID}`, background: 'white', color: TEAL_DARK, cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                      {generandoPdf === g.profesor_id ? '...' : '📄 PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
