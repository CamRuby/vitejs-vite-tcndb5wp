import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'

const HORAS = Array.from({ length: 57 }, (_, i) => {
  const totalMin = 7 * 60 + i * 15
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getFechasSemana(fechaBase: Date) {
  const dia = fechaBase.getDay()
  const diff = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(fechaBase)
  lunes.setDate(fechaBase.getDate() + diff)
  return DIAS.map((_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

function formatFecha(d: Date) {
  return d.toISOString().split('T')[0]
}

function formatFechaMostrar(d: Date) {
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export default function Horarios() {
  const [vista, setVista] = useState<'semana' | 'dia'>('dia')
  const [fechaBase, setFechaBase] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date())
  const [sedeSeleccionada, setSedeSeleccionada] = useState('')
  const [sedes, setSedes] = useState([])
  const [salones, setSalones] = useState([])
  const [profesores, setProfesores] = useState([])
  const [clases, setClases] = useState([])
  const [cargando, setCargando] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [slotSeleccionado, setSlotSeleccionado] = useState<any>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesBuscados, setClientesBuscados] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [contratos, setContratos] = useState([])
  const [contratoSeleccionado, setContratoSeleccionado] = useState<any>(null)
  const [duracion, setDuracion] = useState('60')
  const [profesorId, setProfesorId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const fechasSemana = getFechasSemana(fechaBase)

  useEffect(() => { cargarSedes(); cargarProfesores() }, [])

  useEffect(() => {
    if (sedeSeleccionada) { cargarSalones(); cargarClases() }
  }, [sedeSeleccionada, fechaBase, diaSeleccionado, vista])

  async function cargarSedes() {
    const { data } = await supabase.from('sedes').select('id, nombre').order('nombre')
    setSedes(data || [])
    if (data && data.length > 0) setSedeSeleccionada(data[0].id)
  }

  async function cargarProfesores() {
    const { data } = await supabase.from('profesores').select('id, nombre').order('nombre')
    setProfesores(data || [])
  }

  async function cargarSalones() {
    const { data } = await supabase.from('salones').select('id, nombre').eq('sede_id', sedeSeleccionada).order('nombre')
    setSalones(data || [])
  }

  async function cargarClases() {
    setCargando(true)
    let fechaInicio, fechaFin
    if (vista === 'semana') {
      fechaInicio = formatFecha(fechasSemana[0])
      fechaFin = formatFecha(fechasSemana[5])
    } else {
      fechaInicio = formatFecha(diaSeleccionado)
      fechaFin = formatFecha(diaSeleccionado)
    }
    const { data } = await supabase
      .from('clases')
      .select(`
        id, fecha, hora, duracion_min, estado,
        contratos (clientes (nombre), instrumentos (nombre)),
        profesores (nombre),
        salones (id, nombre, sede_id)
      `)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .not('hora', 'is', null)
    setClases((data || []).filter((c: any) => c.salones?.sede_id === sedeSeleccionada))
    setCargando(false)
  }

  async function buscarClientes(texto: string) {
    setBusquedaCliente(texto)
    setClienteSeleccionado(null)
    setContratos([])
    setContratoSeleccionado(null)
    if (texto.length < 2) { setClientesBuscados([]); return }
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, grupo_whatsapp')
      .ilike('nombre', `%${texto}%`)
      .eq('estado', 'activo')
      .limit(10)
    setClientesBuscados(data || [])
  }

  async function seleccionarCliente(c: any) {
    setClienteSeleccionado(c)
    setBusquedaCliente(c.nombre)
    setClientesBuscados([])
    const { data } = await supabase
      .from('contratos')
      .select('id, total_clases, clases_tomadas, duracion_min, instrumentos(nombre), profesores(id, nombre)')
      .eq('cliente_id', c.id)
      .eq('estado', 'activo')
    setContratos(data || [])
    if (data && data.length > 0) {
      setContratoSeleccionado(data[0])
      setDuracion(String(data[0].duracion_min || 60))
      setProfesorId(data[0].profesores?.id || '')
    }
  }

  function seleccionarContrato(id: string) {
    const ct = contratos.find((c: any) => c.id === id)
    if (ct) {
      setContratoSeleccionado(ct)
      setDuracion(String((ct as any).duracion_min || 60))
      setProfesorId((ct as any).profesores?.id || '')
    }
  }

  function abrirSlot(salon: any, hora: string, fecha: string) {
    setSlotSeleccionado({ salon, hora, fecha })
    setModalAbierto(true)
    setBusquedaCliente('')
    setClienteSeleccionado(null)
    setClientesBuscados([])
    setContratos([])
    setContratoSeleccionado(null)
    setDuracion('60')
    setProfesorId('')
    setError('')
  }

  async function guardarClase() {
    if (!clienteSeleccionado) { setError('Selecciona un cliente'); return }
    if (!contratoSeleccionado) { setError('Selecciona un plan'); return }
    if (!profesorId) { setError('Selecciona un profesor'); return }
    setError('')
    setGuardando(true)
    const { error: err } = await supabase.from('clases').insert({
      contrato_id: (contratoSeleccionado as any).id,
      salon_id: slotSeleccionado.salon.id,
      profesor_id: profesorId,
      fecha: slotSeleccionado.fecha,
      hora: slotSeleccionado.hora + ':00',
      duracion_min: parseInt(duracion),
      estado: 'programada',
      confirmada_cliente: false,
      confirmada_profesor: false
    })
    if (err) {
      setError('Error al guardar: ' + err.message)
    } else {
      setModalAbierto(false)
      cargarClases()
    }
    setGuardando(false)
  }

  function getClasesSlot(salonId: string, hora: string, fecha: string) {
    return clases.filter((c: any) =>
      c.salones?.id === salonId &&
      c.fecha === fecha &&
      c.hora?.substring(0, 5) === hora
    )
  }

  function getColorEstado(estado: string) {
    switch (estado) {
      case 'programada': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
      case 'confirmada': return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
      case 'dada': return { bg: TEAL_LIGHT, color: TEAL, border: TEAL_MID }
      case 'cancelada': return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
      default: return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
    }
  }

  const fechasToShow = vista === 'semana' ? fechasSemana : [diaSeleccionado]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100vh', overflow: 'hidden' }}>

      {/* Encabezado fijo */}
      <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #eef2f7', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '10px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#1a1a1a' }}>Horarios</h2>
            <p style={{ margin: '2px 0 0', color: '#666', fontSize: '13px' }}>
              {vista === 'dia' ? formatFechaMostrar(diaSeleccionado) : `${formatFechaMostrar(fechasSemana[0])} – ${formatFechaMostrar(fechasSemana[5])}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' as const }}>
            <select value={sedeSeleccionada} onChange={e => setSedeSeleccionada(e.target.value)}
              style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px' }}>
              {sedes.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>

            <div style={{ display: 'flex', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', overflow: 'hidden' }}>
              {(['dia', 'semana'] as const).map(v => (
                <button key={v} onClick={() => setVista(v)} style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: '13px',
                  background: vista === v ? TEAL : 'white', color: vista === v ? 'white' : '#333'
                }}>{v === 'dia' ? 'Día' : 'Semana'}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => { const d = new Date(vista === 'semana' ? fechaBase : diaSeleccionado); d.setDate(d.getDate() + (vista === 'semana' ? -7 : -1)); vista === 'semana' ? setFechaBase(d) : setDiaSeleccionado(d) }}
                style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', background: 'white', cursor: 'pointer' }}>‹</button>
              <button onClick={() => { setFechaBase(new Date()); setDiaSeleccionado(new Date()) }}
                style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>Hoy</button>
              <button onClick={() => { const d = new Date(vista === 'semana' ? fechaBase : diaSeleccionado); d.setDate(d.getDate() + (vista === 'semana' ? 7 : 1)); vista === 'semana' ? setFechaBase(d) : setDiaSeleccionado(d) }}
                style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', background: 'white', cursor: 'pointer' }}>›</button>
            </div>

            {vista === 'dia' && (
              <input type="date" value={formatFecha(diaSeleccionado)}
                onChange={e => setDiaSeleccionado(new Date(e.target.value + 'T12:00:00'))}
                style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
            )}
          </div>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' as const }}>
          {[
            { label: 'Programada', color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'Confirmada', color: '#166534', bg: '#dcfce7' },
            { label: 'Dada', color: TEAL, bg: TEAL_LIGHT },
            { label: 'Cancelada', color: '#991b1b', bg: '#fee2e2' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.bg, border: `1px solid ${l.color}` }} />
              <span style={{ fontSize: '12px', color: '#666' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grilla con scroll */}
      <div style={{ flex: 1, overflow: 'auto', overflowX: 'auto' }}>
        {cargando && <p style={{ textAlign: 'center' as const, color: '#666', padding: '20px' }}>Cargando...</p>}
         <table style={{ borderCollapse: 'collapse', minWidth: '100%', width: 'max-content' }}>
          <thead style={{ position: 'sticky' as const, top: 0, zIndex: 3 }}>
            <tr style={{ background: TEAL }}>
              <th style={{ padding: '10px 12px', color: 'white', fontSize: '12px', width: '64px', position: 'sticky' as const, left: 0, background: TEAL, zIndex: 4 }}>Hora</th>
              {vista === 'semana'
                ? fechasToShow.map((fecha, i) =>
                  salones.map((salon: any) => (
                    <th key={`${formatFecha(fecha)}-${salon.id}`} style={{ padding: '8px 10px', color: 'white', fontSize: '11px', textAlign: 'center' as const, borderLeft: '1px solid rgba(255,255,255,0.2)', width: '160px', minWidth: '160px' }}>
                      <div style={{ fontWeight: '600' }}>{DIAS[i]} {formatFechaMostrar(fecha)}</div>
                      <div style={{ opacity: 0.8 }}>{salon.nombre}</div>
                    </th>
                  ))
                )
                : salones.map((salon: any) => (
                  <th key={salon.id} style={{ padding: '10px 12px', color: 'white', fontSize: '13px', textAlign: 'center' as const, borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                    {salon.nombre}
                  </th>
                ))
              }
            </tr>
          </thead>
          <tbody>
            {HORAS.map((hora) => (
              <tr key={hora} style={{ borderTop: hora.endsWith(':00') ? '2px solid #e2e8f0' : '1px solid #f8fafc' }}>
                <td style={{
                  padding: '2px 8px', fontSize: '11px',
                  color: hora.endsWith(':00') ? '#444' : '#bbb',
                  fontWeight: hora.endsWith(':00') ? '600' : '400',
                  background: '#fafbfc', position: 'sticky' as const, left: 0, zIndex: 1,
                  borderRight: '2px solid #e2e8f0', whiteSpace: 'nowrap' as const, width: '64px'
                }}>
                  {hora.endsWith(':00') ? hora : ''}
                </td>
                {vista === 'semana'
                  ? fechasToShow.map((fecha) =>
                    salones.map((salon: any) => {
                      const cs = getClasesSlot(salon.id, hora, formatFecha(fecha))
                      return (
                        <td key={`${formatFecha(fecha)}-${salon.id}-${hora}`}
                          onClick={() => abrirSlot(salon, hora, formatFecha(fecha))}
                          style={{ padding: '1px 3px', verticalAlign: 'top' as const, borderLeft: '1px solid #f1f5f9', cursor: 'pointer', height: '18px', maxHeight: '18px', overflow: 'hidden', width: '160px', minWidth: '160px' }}
                          onMouseEnter={e => { if (!cs.length) e.currentTarget.style.background = TEAL_LIGHT }}
                          onMouseLeave={e => { if (!cs.length) e.currentTarget.style.background = '' }}
                        >
                          {cs.map((c: any) => {
                            const col = getColorEstado(c.estado)
                            return <div key={c.id} style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: '3px', padding: '1px 4px', fontSize: '10px' }}>
                              {c.contratos?.clientes?.nombre?.split(' ')[0]}
                            </div>
                          })}
                        </td>
                      )
                    })
                  )
                  : salones.map((salon: any) => {
                    const cs = getClasesSlot(salon.id, hora, formatFecha(diaSeleccionado))
                    return (
                      <td key={`${salon.id}-${hora}`}
                        onClick={() => abrirSlot(salon, hora, formatFecha(diaSeleccionado))}
                        style={{ padding: '2px 6px', verticalAlign: 'top' as const, borderLeft: '1px solid #f1f5f9', cursor: 'pointer', height: '22px', maxHeight: '22px', overflow: 'hidden' }}
                        onMouseEnter={e => { if (!cs.length) e.currentTarget.style.background = TEAL_LIGHT }}
                        onMouseLeave={e => { if (!cs.length) e.currentTarget.style.background = '' }}
                      >
                        {cs.map((c: any) => {
                          const col = getColorEstado(c.estado)
                          return (
                            <div key={c.id} style={{ background: col.bg, color: col.color, border: `1px solid ${col.border}`, borderRadius: '6px', padding: '4px 8px', fontSize: '12px', marginBottom: '2px' }}>
                              <strong>{c.contratos?.clientes?.nombre}</strong>
                              <div style={{ fontSize: '11px', opacity: 0.85 }}>{c.contratos?.instrumentos?.nombre} · {c.duracion_min}min</div>
                              <div style={{ fontSize: '11px', opacity: 0.85 }}>{c.profesores?.nombre}</div>
                            </div>
                          )
                        })}
                      </td>
                    )
                  })
                }
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalAbierto && slotSeleccionado && (
        <div style={{ position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>Asignar clase</h3>
                <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                  {slotSeleccionado.salon.nombre} · {slotSeleccionado.fecha} · {slotSeleccionado.hora}
                </p>
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>

              {/* Buscar cliente */}
              <div style={{ marginBottom: '14px', position: 'relative' as const }}>
                <label style={{ display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555' }}>Cliente</label>
                <input
                  placeholder="Buscar cliente..."
                  value={busquedaCliente}
                  onChange={e => buscarClientes(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
                />
                {clientesBuscados.length > 0 && (
                  <div style={{ position: 'absolute' as const, top: '100%', left: 0, right: 0, background: 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflow: 'auto' }}>
                    {clientesBuscados.map((c: any) => (
                      <div key={c.id} onClick={() => seleccionarCliente(c)}
                        style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = TEAL_LIGHT}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}
                      >
                        <strong>{c.nombre}</strong>
                        <div style={{ fontSize: '11px', color: '#888' }}>{c.grupo_whatsapp}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan */}
              {contratos.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555' }}>Plan</label>
                  <select
                    value={(contratoSeleccionado as any)?.id || ''}
                    onChange={e => seleccionarContrato(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
                  >
                    {contratos.map((ct: any) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.instrumentos?.nombre || '—'} · {ct.profesores?.nombre || '—'} · {ct.clases_tomadas}/{ct.total_clases} clases · {ct.duracion_min || '?'} min
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Profesor */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555' }}>
                  Profesor <span style={{ color: '#999', fontWeight: '400' }}>(titular por defecto, editable para reemplazos)</span>
                </label>
                <select
                  value={profesorId}
                  onChange={e => setProfesorId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
                >
                  <option value="">— Seleccionar profesor —</option>
                  {profesores.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Duración */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555' }}>Duración</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['30', '45', '60'].map(d => (
                    <button key={d} onClick={() => setDuracion(d)} style={{
                      flex: 1, padding: '9px', border: `1px solid ${duracion === d ? TEAL : TEAL_MID}`,
                      borderRadius: '8px', cursor: 'pointer', fontSize: '14px',
                      background: duracion === d ? TEAL : 'white',
                      color: duracion === d ? 'white' : '#333',
                      fontWeight: duracion === d ? '600' : '400'
                    }}>{d} min</button>
                  ))}
                </div>
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={guardarClase} disabled={guardando} style={{
                  flex: 1, padding: '11px', background: TEAL, color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500'
                }}>
                  {guardando ? 'Guardando...' : 'Asignar clase'}
                </button>
                <button onClick={() => setModalAbierto(false)} style={{
                  padding: '11px 18px', background: '#f1f5f9', color: '#334155',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
