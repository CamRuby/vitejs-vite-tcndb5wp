import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const ROW_H = 20

const HORAS = Array.from({ length: 57 }, (_, i) => {
  const totalMin = 7 * 60 + i * 15
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function formatFecha(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseFechaLocal(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

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

function formatFechaMostrar(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

function formatFechaLarga(d: Date): string {
  const nombreDia = DIAS_LARGO[d.getDay()]
  const cap = nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1)
  return `${cap}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

function horaAMinutos(hora: string): number {
  const parts = (hora || '').split(':').map(Number)
  return (parts[0] || 0) * 60 + (parts[1] || 0)
}

function esPasado(fechaStr: string): boolean {
  return fechaStr < formatFecha(new Date())
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`,
  borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555'
}

function getColorEstado(estado: string) {
  switch (estado) {
    case 'programada': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }
    case 'confirmada': return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
    case 'dada':       return { bg: '#fefce8', color: '#854d0e', border: '#fde68a' }
    case 'cancelada':  return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
    default:           return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' }
  }
}

export default function Horarios() {
  const [vista, setVista] = useState<'semana' | 'dia'>('dia')
  const [fechaBase, setFechaBase] = useState(new Date())
  const [diaSeleccionado, setDiaSeleccionado] = useState(new Date())
  const [sedeSeleccionada, setSedeSeleccionada] = useState('')
  const [sedes, setSedes] = useState<any[]>([])
  const [salones, setSalones] = useState<any[]>([])
  const [profesores, setProfesores] = useState<any[]>([])
  const [clases, setClases] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)

  // Modal crear
  const [modalAbierto, setModalAbierto] = useState(false)
  const [slotSeleccionado, setSlotSeleccionado] = useState<any>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientesBuscados, setClientesBuscados] = useState<any[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [contratos, setContratos] = useState<any[]>([])
  const [contratoSeleccionado, setContratoSeleccionado] = useState<any>(null)
  const [duracion, setDuracion] = useState('60')
  const [profesorId, setProfesorId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [recurrente, setRecurrente] = useState(false)
  const [semanasRecurrencia, setSemanasRecurrencia] = useState(4)

  // Modal editar
  const [modalEditar, setModalEditar] = useState(false)
  const [claseEditando, setClaseEditando] = useState<any>(null)
  const [editProfesorId, setEditProfesorId] = useState('')
  const [editDuracion, setEditDuracion] = useState('60')
  const [editHora, setEditHora] = useState('')
  const [editFecha, setEditFecha] = useState('')
  const [editSalonId, setEditSalonId] = useState('')
  const [editEstado, setEditEstado] = useState('programada')
  const [editError, setEditError] = useState('')
  const [editGuardando, setEditGuardando] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)

  const fechasSemana = getFechasSemana(fechaBase)

  const columns = useMemo(() => {
    if (vista === 'semana') {
      return fechasSemana.flatMap((fecha, i) =>
        salones.map((salon: any) => ({
          salon, fecha: formatFecha(fecha),
          header: `${DIAS[i]} ${formatFechaMostrar(fecha)}`,
          subheader: salon.nombre
        }))
      )
    }
    return salones.map((salon: any) => ({
      salon, fecha: formatFecha(diaSeleccionado),
      header: salon.nombre, subheader: ''
    }))
  }, [vista, salones, fechasSemana, diaSeleccionado])

  const skipSet = useMemo(() => {
    const skip = new Set<string>()
    clases.forEach((c: any) => {
      const salonId = c.salones?.id
      if (!salonId || !c.fecha || !c.hora || c.estado === 'cancelada') return
      const cInicio = horaAMinutos(c.hora.substring(0, 5))
      const numSlots = Math.max(1, Math.round((c.duracion_min || 60) / 15))
      for (let i = 1; i < numSlots; i++) {
        const min = cInicio + i * 15
        const hh = Math.floor(min / 60)
        const mm = min % 60
        skip.add(`${salonId}-${c.fecha}-${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`)
      }
    })
    return skip
  }, [clases])

  useEffect(() => { cargarSedes(); cargarProfesores() }, [])
  useEffect(() => { if (sedeSeleccionada) { cargarSalones(); cargarClases() } }, [sedeSeleccionada, fechaBase, diaSeleccionado, vista])

  async function cargarSedes() {
    const { data } = await supabase.from('sedes').select('id, nombre').order('nombre')
    setSedes(data || [])
    if (data?.length) setSedeSeleccionada(data[0].id)
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
    const fechaInicio = vista === 'semana' ? formatFecha(fechasSemana[0]) : formatFecha(diaSeleccionado)
    const fechaFin = vista === 'semana' ? formatFecha(fechasSemana[5]) : formatFecha(diaSeleccionado)
    const { data } = await supabase
      .from('clases')
      .select(`
        id, fecha, hora, duracion_min, estado, patron_id, recurrente,
        contratos (id, clases_tomadas, total_clases, clientes (id, nombre), instrumentos (nombre)),
        profesores (id, nombre),
        salones (id, nombre, sede_id)
      `)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .not('hora', 'is', null)
    setClases((data || []).filter((c: any) => c.salones?.sede_id === sedeSeleccionada))
    setCargando(false)
  }

  // Validación salón: no dos clases solapadas en mismo salón
  async function verificarConflictoSalon(
    salonId: string, fecha: string, hora: string, duracionMin: number, excluirId?: string
  ): Promise<string | null> {
    const inicio = horaAMinutos(hora)
    const fin = inicio + duracionMin
    const { data } = await supabase
      .from('clases')
      .select('id, hora, duracion_min, contratos(clientes(nombre))')
      .eq('salon_id', salonId).eq('fecha', fecha).neq('estado', 'cancelada')
    if (!data) return null
    for (const c of data) {
      if (excluirId && c.id === excluirId) continue
      const cI = horaAMinutos((c.hora || '').substring(0, 5))
      const cF = cI + ((c as any).duracion_min || 60)
      if (inicio < cF && fin > cI) {
        const nombre = (c as any).contratos?.clientes?.nombre || 'otra clase'
        const hi = `${String(Math.floor(cI/60)).padStart(2,'0')}:${String(cI%60).padStart(2,'0')}`
        const hf = `${String(Math.floor(cF/60)).padStart(2,'0')}:${String(cF%60).padStart(2,'0')}`
        return `Conflicto de salón con ${nombre} (${hi}–${hf})`
      }
    }
    return null
  }

  // Validación profesor: no dos clases solapadas con mismo profesor
  async function verificarConflictoProfesor(
    profId: string, fecha: string, hora: string, duracionMin: number, excluirId?: string
  ): Promise<string | null> {
    if (!profId) return null
    const inicio = horaAMinutos(hora)
    const fin = inicio + duracionMin
    const { data } = await supabase
      .from('clases')
      .select('id, hora, duracion_min, salones(nombre), contratos(clientes(nombre))')
      .eq('profesor_id', profId).eq('fecha', fecha).neq('estado', 'cancelada')
    if (!data) return null
    for (const c of data) {
      if (excluirId && c.id === excluirId) continue
      const cI = horaAMinutos((c.hora || '').substring(0, 5))
      const cF = cI + ((c as any).duracion_min || 60)
      if (inicio < cF && fin > cI) {
        const cliente = (c as any).contratos?.clientes?.nombre || 'otro cliente'
        const salon = (c as any).salones?.nombre || 'otro salón'
        const hi = `${String(Math.floor(cI/60)).padStart(2,'0')}:${String(cI%60).padStart(2,'0')}`
        const hf = `${String(Math.floor(cF/60)).padStart(2,'0')}:${String(cF%60).padStart(2,'0')}`
        return `El profesor ya tiene clase con ${cliente} en ${salon} (${hi}–${hf})`
      }
    }
    return null
  }

  // Validación cliente: no dos clases solapadas con mismo cliente
  async function verificarConflictoCliente(
    contratoId: string, fecha: string, hora: string, duracionMin: number, excluirId?: string
  ): Promise<string | null> {
    if (!contratoId) return null
    const inicio = horaAMinutos(hora)
    const fin = inicio + duracionMin
    // Obtener cliente_id desde el contrato
    const { data: ct } = await supabase.from('contratos').select('cliente_id').eq('id', contratoId).single()
    if (!ct) return null
    const { data: otrosContratos } = await supabase.from('contratos').select('id').eq('cliente_id', ct.cliente_id)
    if (!otrosContratos) return null
    const ids = otrosContratos.map((c: any) => c.id)
    const { data } = await supabase
      .from('clases')
      .select('id, hora, duracion_min, salones(nombre), profesores(nombre)')
      .in('contrato_id', ids).eq('fecha', fecha).neq('estado', 'cancelada')
    if (!data) return null
    for (const c of data) {
      if (excluirId && c.id === excluirId) continue
      const cI = horaAMinutos((c.hora || '').substring(0, 5))
      const cF = cI + ((c as any).duracion_min || 60)
      if (inicio < cF && fin > cI) {
        const salon = (c as any).salones?.nombre || 'otro salón'
        const prof = (c as any).profesores?.nombre || 'otro profesor'
        const hi = `${String(Math.floor(cI/60)).padStart(2,'0')}:${String(cI%60).padStart(2,'0')}`
        const hf = `${String(Math.floor(cF/60)).padStart(2,'0')}:${String(cF%60).padStart(2,'0')}`
        return `El cliente ya tiene clase con ${prof} en ${salon} (${hi}–${hf})`
      }
    }
    return null
  }

  async function verificarTodosLosConflictos(
    salonId: string, profId: string, contratoId: string,
    fecha: string, hora: string, durMin: number, excluirId?: string
  ): Promise<string | null> {
    const c1 = await verificarConflictoSalon(salonId, fecha, hora, durMin, excluirId)
    if (c1) return c1
    const c2 = await verificarConflictoProfesor(profId, fecha, hora, durMin, excluirId)
    if (c2) return c2
    const c3 = await verificarConflictoCliente(contratoId, fecha, hora, durMin, excluirId)
    if (c3) return c3
    return null
  }

  async function buscarClientes(texto: string) {
    setBusquedaCliente(texto)
    setClienteSeleccionado(null)
    setContratos([])
    setContratoSeleccionado(null)
    if (texto.length < 2) { setClientesBuscados([]); return }
    const { data } = await supabase.from('clientes').select('id, nombre, grupo_whatsapp')
      .ilike('nombre', `%${texto}%`).eq('estado', 'activo').limit(10)
    setClientesBuscados(data || [])
  }

  async function seleccionarCliente(c: any) {
    setClienteSeleccionado(c)
    setBusquedaCliente(c.nombre)
    setClientesBuscados([])
    const { data } = await supabase.from('contratos')
      .select('id, total_clases, clases_tomadas, duracion_min, instrumentos(nombre), profesores(id, nombre)')
      .eq('cliente_id', c.id).eq('estado', 'activo')
    setContratos(data || [])
    if (data?.length) {
      setContratoSeleccionado(data[0])
      setDuracion(String((data[0] as any).duracion_min || 60))
      setProfesorId((data[0] as any).profesores?.id || '')
    }
  }

  function seleccionarContrato(id: string) {
    const ct = contratos.find((c: any) => c.id === id) as any
    if (ct) {
      setContratoSeleccionado(ct)
      setDuracion(String(ct.duracion_min || 60))
      setProfesorId(ct.profesores?.id || '')
    }
  }

  function abrirSlot(salon: any, hora: string, fecha: string) {
    if (esPasado(fecha)) return
    setSlotSeleccionado({ salon, hora, fecha })
    setModalAbierto(true)
    setBusquedaCliente('')
    setClienteSeleccionado(null)
    setClientesBuscados([])
    setContratos([])
    setContratoSeleccionado(null)
    setDuracion('60')
    setProfesorId('')
    setRecurrente(false)
    setSemanasRecurrencia(4)
    setError('')
  }

  function abrirClaseExistente(e: React.MouseEvent, clase: any) {
    e.stopPropagation()
    setClaseEditando(clase)
    setEditProfesorId(clase.profesores?.id || '')
    setEditDuracion(String(clase.duracion_min || 60))
    setEditHora(clase.hora?.substring(0, 5) || '')
    setEditFecha(clase.fecha || '')
    setEditSalonId(clase.salones?.id || '')
    setEditEstado(clase.estado || 'programada')
    setEditError('')
    setConfirmarBorrar(false)
    setModalEditar(true)
  }

  async function guardarClase() {
    if (!clienteSeleccionado) { setError('Selecciona un cliente'); return }
    if (!contratoSeleccionado) { setError('Selecciona un plan'); return }
    if (!profesorId) { setError('Selecciona un profesor'); return }
    setGuardando(true)
    setError('')

    if (recurrente && semanasRecurrencia > 1) {
      const patronId = crypto.randomUUID()
      const batch: any[] = []
      for (let i = 0; i < semanasRecurrencia; i++) {
        const d = parseFechaLocal(slotSeleccionado.fecha)
        d.setDate(d.getDate() + i * 7)
        const fechaStr = formatFecha(d)
        const conflicto = await verificarTodosLosConflictos(
          slotSeleccionado.salon.id, profesorId, (contratoSeleccionado as any).id,
          fechaStr, slotSeleccionado.hora, parseInt(duracion)
        )
        if (conflicto) {
          if (batch.length === 0) {
            setError(`${conflicto} — semana 1. No se creó ninguna clase.`)
          } else {
            const { error: err } = await supabase.from('clases').insert(batch)
            if (err) setError('Error: ' + err.message)
            else { setError(`${conflicto} — semana ${i + 1}. Se crearon ${batch.length} clases.`); cargarClases() }
          }
          setGuardando(false)
          return
        }
        batch.push({
          contrato_id: (contratoSeleccionado as any).id,
          salon_id: slotSeleccionado.salon.id,
          profesor_id: profesorId,
          fecha: fechaStr,
          hora: slotSeleccionado.hora + ':00',
          duracion_min: parseInt(duracion),
          estado: 'programada',
          confirmada_cliente: false,
          confirmada_profesor: false,
          patron_id: patronId,
          recurrente: true
        })
      }
      const { error: err } = await supabase.from('clases').insert(batch)
      if (err) setError('Error: ' + err.message)
      else { setModalAbierto(false); cargarClases() }
    } else {
      const conflicto = await verificarTodosLosConflictos(
        slotSeleccionado.salon.id, profesorId, (contratoSeleccionado as any).id,
        slotSeleccionado.fecha, slotSeleccionado.hora, parseInt(duracion)
      )
      if (conflicto) { setError(conflicto); setGuardando(false); return }
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
      if (err) setError('Error: ' + err.message)
      else { setModalAbierto(false); cargarClases() }
    }
    setGuardando(false)
  }

  async function guardarEdicion(alcance: 'esta' | 'futuras') {
    setEditGuardando(true)
    setEditError('')
    const conflicto = await verificarTodosLosConflictos(
      editSalonId, editProfesorId, claseEditando.contratos?.id,
      editFecha, editHora, parseInt(editDuracion), claseEditando.id
    )
    if (conflicto) { setEditError(conflicto); setEditGuardando(false); return }

    const updates: any = {
      profesor_id: editProfesorId,
      duracion_min: parseInt(editDuracion),
      hora: editHora + ':00',
      salon_id: editSalonId,
      estado: editEstado,
      fecha: editFecha
    }

    let dbError: any = null
    if (alcance === 'futuras' && claseEditando.patron_id) {
      const { fecha: _f, ...sinFecha } = updates
      const { error } = await supabase.from('clases').update(sinFecha)
        .eq('patron_id', claseEditando.patron_id).gte('fecha', claseEditando.fecha)
      dbError = error
    } else {
      const { error } = await supabase.from('clases').update(updates).eq('id', claseEditando.id)
      dbError = error
    }
    if (dbError) { setEditError('Error: ' + dbError.message); setEditGuardando(false); return }
    setModalEditar(false)
    cargarClases()
    setEditGuardando(false)
  }

  async function borrarClase(alcance: 'esta' | 'futuras') {
    setEditGuardando(true)
    if (alcance === 'futuras' && claseEditando.patron_id) {
      await supabase.from('clases').delete()
        .eq('patron_id', claseEditando.patron_id).gte('fecha', claseEditando.fecha)
    } else {
      await supabase.from('clases').delete().eq('id', claseEditando.id)
    }
    setModalEditar(false)
    cargarClases()
    setEditGuardando(false)
  }

  function getClasesSlot(salonId: string, hora: string, fecha: string) {
    return clases.filter((c: any) =>
      c.salones?.id === salonId && c.fecha === fecha && c.hora?.substring(0, 5) === hora
    )
  }

  const DURACIONES = ['30', '45', '60', '90']

  // Detecta si algo cambió al editar (para saber si preguntar alcance en recurrentes)
  const hayEdicionReal = claseEditando && (
    editHora !== claseEditando.hora?.substring(0, 5) ||
    editFecha !== claseEditando.fecha ||
    editProfesorId !== claseEditando.profesores?.id ||
    editSalonId !== claseEditando.salones?.id ||
    editDuracion !== String(claseEditando.duracion_min)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* Encabezado — sin título "Horarios" */}
      <div style={{ padding: '12px 24px', background: 'white', borderBottom: '1px solid #eef2f7', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <p style={{ margin: 0, color: '#333', fontSize: '18px', fontWeight: '700' }}>
            {vista === 'dia'
              ? formatFechaLarga(diaSeleccionado)
              : `${formatFechaMostrar(fechasSemana[0])} – ${formatFechaMostrar(fechasSemana[5])}, ${fechasSemana[0].getFullYear()}`}
          </p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
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
              <button onClick={() => {
                const d = new Date(vista === 'semana' ? fechaBase : diaSeleccionado)
                d.setDate(d.getDate() - (vista === 'semana' ? 7 : 1))
                vista === 'semana' ? setFechaBase(d) : setDiaSeleccionado(d)
              }} style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', background: 'white', cursor: 'pointer' }}>‹</button>
              <button onClick={() => { setFechaBase(new Date()); setDiaSeleccionado(new Date()) }}
                style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '13px' }}>Hoy</button>
              <button onClick={() => {
                const d = new Date(vista === 'semana' ? fechaBase : diaSeleccionado)
                d.setDate(d.getDate() + (vista === 'semana' ? 7 : 1))
                vista === 'semana' ? setFechaBase(d) : setDiaSeleccionado(d)
              }} style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', background: 'white', cursor: 'pointer' }}>›</button>
            </div>
            {vista === 'dia' && (
              <input type="date" value={formatFecha(diaSeleccionado)}
                onChange={e => {
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  setDiaSeleccionado(new Date(y, m - 1, d))
                }}
                style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Programada', color: '#1d4ed8', bg: '#eff6ff' },
            { label: 'Confirmada', color: '#166534', bg: '#dcfce7' },
            { label: 'Dada', color: '#854d0e', bg: '#fefce8' },
            { label: 'Cancelada', color: '#991b1b', bg: '#fee2e2' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.bg, border: `1px solid ${l.color}` }} />
              <span style={{ fontSize: '12px', color: '#666' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '12px' }}>🔁</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Recurrente</span>
          </div>
        </div>
      </div>

      {/* Grilla */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {cargando && <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Cargando...</p>}
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', width: 'max-content' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
            <tr style={{ background: TEAL }}>
              <th style={{ padding: '10px 12px', color: 'white', fontSize: '12px', width: '64px', position: 'sticky', left: 0, background: TEAL, zIndex: 4 }}>Hora</th>
              {columns.map(col => (
                <th key={`${col.salon.id}-${col.fecha}`} style={{ padding: '8px 10px', color: 'white', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.2)', width: '160px', minWidth: '160px' }}>
                  <div style={{ fontWeight: '600', fontSize: vista === 'dia' ? '13px' : '11px' }}>{col.header}</div>
                  {col.subheader && <div style={{ opacity: 0.8, fontSize: '11px' }}>{col.subheader}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HORAS.map((hora) => (
              <tr key={hora} style={{ borderTop: hora.endsWith(':00') ? '2px solid #e2e8f0' : '1px solid #f8fafc' }}>
                <td style={{
                  padding: '0 8px', fontSize: '11px',
                  color: hora.endsWith(':00') ? '#444' : 'transparent',
                  fontWeight: '600', background: '#fafbfc',
                  position: 'sticky', left: 0, zIndex: 1,
                  borderRight: '2px solid #e2e8f0', whiteSpace: 'nowrap',
                  width: '64px', height: `${ROW_H}px`, verticalAlign: 'top'
                }}>
                  {hora}
                </td>
                {columns.map(col => {
                  const cellKey = `${col.salon.id}-${col.fecha}-${hora}`
                  if (skipSet.has(cellKey)) return null
                  const cs = getClasesSlot(col.salon.id, hora, col.fecha)
                  const mainClass = cs[0]
                  const rowSpan = mainClass ? Math.max(1, Math.round((mainClass.duracion_min || 60) / 15)) : 1
                  const esCeldaPasada = esPasado(col.fecha)
                  return (
                    <td key={cellKey}
                      rowSpan={rowSpan}
                      onClick={() => { if (!mainClass) abrirSlot(col.salon, hora, col.fecha) }}
                      style={{
                        padding: 0, height: '1px', verticalAlign: 'top',
                        borderLeft: '1px solid #f1f5f9',
                        cursor: mainClass ? 'default' : esCeldaPasada ? 'not-allowed' : 'pointer',
                        width: '160px', minWidth: '160px',
                        background: esCeldaPasada && !mainClass ? '#fafafa' : undefined
                      }}
                      onMouseEnter={e => { if (!mainClass && !esCeldaPasada) e.currentTarget.style.background = TEAL_LIGHT }}
                      onMouseLeave={e => { if (!mainClass) e.currentTarget.style.background = esCeldaPasada ? '#fafafa' : '' }}
                    >
                      {mainClass && (() => {
                        const col2 = getColorEstado(mainClass.estado)
                        const numPlan = mainClass.contratos?.total_clases
                          ? `${mainClass.contratos.clases_tomadas ?? '?'}/${mainClass.contratos.total_clases}`
                          : ''
                        return (
                          <div onClick={(e) => abrirClaseExistente(e, mainClass)} title="Clic para editar"
                            style={{
                              background: col2.bg, color: col2.color,
                              border: `1px solid ${col2.border}`,
                              borderRadius: '6px', padding: '4px 7px',
                              fontSize: vista === 'dia' ? '13px' : '11px',
                              cursor: 'pointer',
                              height: 'calc(100% - 4px)',
                              overflow: 'hidden', boxSizing: 'border-box', margin: '2px 3px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2px' }}>
                              <strong style={{ lineHeight: '1.3', fontSize: vista === 'dia' ? '13px' : '11px' }}>
                                {mainClass.contratos?.clientes?.nombre}
                              </strong>
                              <div style={{ display: 'flex', gap: '3px', flexShrink: 0, alignItems: 'center' }}>
                                {numPlan && (
                                  <span style={{
                                    fontSize: vista === 'dia' ? '12px' : '11px',
                                    fontWeight: '700',
                                    opacity: 0.9,
                                    whiteSpace: 'nowrap'
                                  }}>{numPlan}</span>
                                )}
                                {mainClass.recurrente && <span style={{ fontSize: '9px' }}>🔁</span>}
                              </div>
                            </div>
                            {(vista === 'dia' || rowSpan >= 3) && mainClass.profesores?.nombre && (
                              <div style={{ fontSize: vista === 'dia' ? '12px' : '10px', opacity: 0.85, marginTop: '1px' }}>
                                {mainClass.profesores.nombre}
                              </div>
                            )}
                            {vista === 'dia' && rowSpan >= 3 && (
                              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '1px' }}>
                                {mainClass.contratos?.instrumentos?.nombre}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                      {cs.slice(1).map((c: any) => {
                        const col2 = getColorEstado(c.estado)
                        return (
                          <div key={c.id} onClick={(e) => abrirClaseExistente(e, c)}
                            style={{ background: col2.bg, color: col2.color, border: `1px solid ${col2.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '11px', marginTop: '2px', cursor: 'pointer' }}>
                            {c.contratos?.clientes?.nombre} ⚠️
                          </div>
                        )
                      })}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ══ MODAL CREAR ══ */}
      {modalAbierto && slotSeleccionado && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>Asignar clase</h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{slotSeleccionado.salon.nombre}</p>
                <p style={{ margin: '6px 0 0', color: 'white', fontSize: '20px', fontWeight: '700' }}>
                  {formatFechaLarga(parseFechaLocal(slotSeleccionado.fecha))} · {slotSeleccionado.hora}
                </p>
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <label style={labelStyle}>Cliente</label>
                <input placeholder="Buscar cliente..." value={busquedaCliente}
                  onChange={e => buscarClientes(e.target.value)} style={fieldStyle} />
                {clientesBuscados.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, maxHeight: '200px', overflow: 'auto' }}>
                    {clientesBuscados.map((c: any) => (
                      <div key={c.id} onClick={() => seleccionarCliente(c)}
                        style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={e => e.currentTarget.style.background = TEAL_LIGHT}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <strong>{c.nombre}</strong>
                        <div style={{ fontSize: '11px', color: '#888' }}>{c.grupo_whatsapp}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {contratos.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Plan</label>
                  <select value={(contratoSeleccionado as any)?.id || ''} onChange={e => seleccionarContrato(e.target.value)} style={fieldStyle}>
                    {contratos.map((ct: any) => (
                      <option key={ct.id} value={ct.id}>
                        {ct.instrumentos?.nombre || '—'} · {ct.profesores?.nombre || '—'} · {ct.clases_tomadas}/{ct.total_clases} · {ct.duracion_min}min
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Profesor</label>
                <select value={profesorId} onChange={e => setProfesorId(e.target.value)} style={fieldStyle}>
                  <option value="">— Seleccionar profesor —</option>
                  {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={labelStyle}>Duración</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {DURACIONES.map(d => (
                    <button key={d} onClick={() => setDuracion(d)} style={{
                      flex: 1, padding: '9px', border: `1px solid ${duracion === d ? TEAL : TEAL_MID}`,
                      borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                      background: duracion === d ? TEAL : 'white', color: duracion === d ? 'white' : '#333',
                      fontWeight: duracion === d ? '600' : '400'
                    }}>{d}min</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '20px', background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 14px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                  <input type="checkbox" checked={recurrente} onChange={e => setRecurrente(e.target.checked)} />
                  🔁 Repetir semanalmente
                </label>
                {recurrente && (
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ ...labelStyle, marginBottom: '6px' }}>¿Cuántas semanas?</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {[4, 8, 12, 16].map(n => (
                        <button key={n} onClick={() => setSemanasRecurrencia(n)} style={{
                          padding: '6px 12px', border: `1px solid ${semanasRecurrencia === n ? TEAL : TEAL_MID}`,
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                          background: semanasRecurrencia === n ? TEAL : 'white',
                          color: semanasRecurrencia === n ? 'white' : '#333'
                        }}>{n} sem</button>
                      ))}
                      <input type="number" min={2} max={52} value={semanasRecurrencia}
                        onChange={e => setSemanasRecurrencia(parseInt(e.target.value) || 4)}
                        style={{ width: '60px', padding: '6px 8px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#666' }}>
                      Se crearán {semanasRecurrencia} clases · mismo día y hora
                    </p>
                  </div>
                )}
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={guardarClase} disabled={guardando} style={{
                  flex: 1, padding: '11px', background: TEAL, color: 'white',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500'
                }}>
                  {guardando ? 'Verificando...' : recurrente ? `Crear ${semanasRecurrencia} clases` : 'Asignar clase'}
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

      {/* ══ MODAL EDITAR ══ */}
      {modalEditar && claseEditando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>
                  {esPasado(claseEditando.fecha) ? 'Ver clase (solo lectura)' : 'Editar clase'}
                </h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{claseEditando.contratos?.clientes?.nombre}</p>
                <p style={{ margin: '4px 0 0', color: 'white', fontSize: '18px', fontWeight: '700' }}>
                  {formatFechaLarga(parseFechaLocal(claseEditando.fecha))} · {claseEditando.hora?.substring(0, 5)}
                </p>
              </div>
              <button onClick={() => setModalEditar(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>
              <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#333' }}>
                <div><strong>Cliente:</strong> {claseEditando.contratos?.clientes?.nombre}</div>
                <div><strong>Instrumento:</strong> {claseEditando.contratos?.instrumentos?.nombre}</div>
                <div><strong>Plan:</strong> {claseEditando.contratos?.clases_tomadas}/{claseEditando.contratos?.total_clases} clases</div>
                {claseEditando.recurrente && <div style={{ marginTop: '6px', color: TEAL, fontWeight: '600', fontSize: '12px' }}>🔁 Clase recurrente</div>}
                {esPasado(claseEditando.fecha) && <div style={{ marginTop: '6px', color: '#999', fontWeight: '600', fontSize: '12px' }}>🔒 Clase pasada — solo lectura</div>}
              </div>

              {!esPasado(claseEditando.fecha) && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Estado</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['programada', 'confirmada', 'dada', 'cancelada'].map(est => {
                        const col2 = getColorEstado(est)
                        return (
                          <button key={est} onClick={() => setEditEstado(est)} style={{
                            padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                            border: `1px solid ${editEstado === est ? col2.color : '#e2e8f0'}`,
                            background: editEstado === est ? col2.bg : 'white',
                            color: editEstado === est ? col2.color : '#666'
                          }}>{est.charAt(0).toUpperCase() + est.slice(1)}</button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Fecha</label>
                    <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} style={fieldStyle} />
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Hora de inicio</label>
                    <select value={editHora} onChange={e => setEditHora(e.target.value)} style={fieldStyle}>
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Duración</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {DURACIONES.map(d => (
                        <button key={d} onClick={() => setEditDuracion(d)} style={{
                          flex: 1, padding: '9px', border: `1px solid ${editDuracion === d ? TEAL : TEAL_MID}`,
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                          background: editDuracion === d ? TEAL : 'white', color: editDuracion === d ? 'white' : '#333',
                          fontWeight: editDuracion === d ? '600' : '400'
                        }}>{d}min</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Profesor</label>
                    <select value={editProfesorId} onChange={e => setEditProfesorId(e.target.value)} style={fieldStyle}>
                      <option value="">— Sin profesor —</option>
                      {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Salón</label>
                    <select value={editSalonId} onChange={e => setEditSalonId(e.target.value)} style={fieldStyle}>
                      {salones.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>

                  {editError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{editError}</p>}

                  {/* Botones guardar — recurrente Y con cambios reales: preguntar alcance */}
                  {claseEditando.recurrente && claseEditando.patron_id && hayEdicionReal ? (
                    <>
                      <p style={{ fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: '500' }}>
                        ¿A qué clases aplica el cambio?
                      </p>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <button onClick={() => guardarEdicion('esta')} disabled={editGuardando} style={{
                          flex: 1, padding: '10px', background: TEAL, color: 'white',
                          border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                        }}>{editGuardando ? '...' : 'Solo esta clase'}</button>
                        <button onClick={() => guardarEdicion('futuras')} disabled={editGuardando} style={{
                          flex: 1, padding: '10px', background: '#0f766e', color: 'white',
                          border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                        }}>{editGuardando ? '...' : 'Esta y las siguientes'}</button>
                      </div>
                    </>
                  ) : (
                    <button onClick={() => guardarEdicion('esta')} disabled={editGuardando} style={{
                      width: '100%', padding: '11px', background: TEAL, color: 'white',
                      border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', marginBottom: '10px'
                    }}>{editGuardando ? 'Guardando...' : 'Guardar cambios'}</button>
                  )}

                  {!confirmarBorrar ? (
                    <button onClick={() => setConfirmarBorrar(true)} style={{
                      width: '100%', padding: '10px', background: 'white', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
                    }}>Borrar clase</button>
                  ) : (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#991b1b', fontWeight: '700' }}>¿Confirmar eliminación?</p>
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#666' }}>
                        {claseEditando.recurrente && claseEditando.patron_id
                          ? 'Esta clase es parte de una serie recurrente.'
                          : `${claseEditando.contratos?.clientes?.nombre} · ${claseEditando.fecha} · ${claseEditando.hora?.substring(0, 5)}`}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {claseEditando.recurrente && claseEditando.patron_id ? (
                          <>
                            <button onClick={() => borrarClase('esta')} disabled={editGuardando} style={{
                              flex: 1, padding: '8px', background: '#dc2626', color: 'white',
                              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
                            }}>Borrar solo esta</button>
                            <button onClick={() => borrarClase('futuras')} disabled={editGuardando} style={{
                              flex: 1, padding: '8px', background: '#991b1b', color: 'white',
                              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
                            }}>Borrar esta y siguientes</button>
                          </>
                        ) : (
                          <button onClick={() => borrarClase('esta')} disabled={editGuardando} style={{
                            flex: 1, padding: '8px', background: '#dc2626', color: 'white',
                            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500'
                          }}>Sí, borrar clase</button>
                        )}
                        <button onClick={() => setConfirmarBorrar(false)} style={{
                          padding: '8px 14px', background: 'white', color: '#333',
                          border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
                        }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {esPasado(claseEditando.fecha) && (
                <button onClick={() => setModalEditar(false)} style={{
                  width: '100%', padding: '11px', background: '#f1f5f9', color: '#334155',
                  border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
                }}>Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
