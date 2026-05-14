import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const ROW_H = 20

const TALLER_BG     = '#f3e8ff'
const TALLER_COLOR  = '#7c3aed'
const TALLER_BORDER = '#d8b4fe'

const HORAS = Array.from({ length: 57 }, (_, i) => {
  const totalMin = 7 * 60 + i * 15
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const DURACIONES = ['30', '45', '60', '90', '120']
const MODALIDADES_CLASE = ['presencial', 'virtual', 'domicilio'] as const

const DIA_NUM: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6
}

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
function esBloqueada(clase: any): boolean {
  return clase?.estado === 'dada'
}

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`,
  borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555'
}

// ── FIX 5: removed duplicate cancelada condition ──
function getColorEstado(estado: string, revision?: boolean) {
  if (revision) return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
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
  const [talleres, setTalleres] = useState<any[]>([])
  const [inscritosPorTaller, setInscritosPorTaller] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(false)

  const [tipoModal, setTipoModal] = useState<'clase' | 'taller'>('clase')
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
  const [fechaFinRecurrencia, setFechaFinRecurrencia] = useState(`${new Date().getFullYear()}-12-31`)
  const [avisoCrear, setAvisoCrear] = useState<string[]>([])
  const [confirmarSedeDiferente, setConfirmarSedeDiferente] = useState(false)
  const [modalidadClase, setModalidadClase] = useState<'presencial' | 'virtual' | 'domicilio'>('presencial')

  const [tallerNombre, setTallerNombre] = useState('')
  const [tallerProfesorId, setTallerProfesorId] = useState('')
  const [tallerDuracion, setTallerDuracion] = useState('60')
  const [tallerValor, setTallerValor] = useState('')
  const [tallerError, setTallerError] = useState('')
  const [tallerGuardando, setTallerGuardando] = useState(false)

  const [modalVerTaller, setModalVerTaller] = useState(false)
  const [tallerViendo, setTallerViendo] = useState<any>(null)
  const [sesionesEstadoMap, setSesionesEstadoMap] = useState<Record<string, string>>({})
  const [inscritosDelTaller, setInscritosDelTaller] = useState<any[]>([])
  const [sesionActual, setSesionActual] = useState<any>(null)
  const [asistenciasSesion, setAsistenciasSesion] = useState<Record<string, boolean | null>>({})
  const [confirmacionesSesion, setConfirmacionesSesion] = useState<Set<string>>(new Set())
  const [guardandoConfirmacion, setGuardandoConfirmacion] = useState(false)
  const [guardandoAsistencia, setGuardandoAsistencia] = useState(false)
  const [fechaSesionViendo, setFechaSesionViendo] = useState<string>('')
  const [guardandoSesion, setGuardandoSesion] = useState(false)
  const [modoEdicionTaller, setModoEdicionTaller] = useState(false)
  const [teNombre, setTeNombre] = useState('')
  const [teProfesorId, setTeProfesorId] = useState('')
  const [teSalonId, setTeSalonId] = useState('')
  const [teDiaSemana, setTeDiaSemana] = useState('')
  const [teHora, setTeHora] = useState('')
  const [teDuracion, setTeDuracion] = useState('60')
  const [teValor, setTeValor] = useState('')
  const [teGuardando, setTeGuardando] = useState(false)
  const [teError, setTeError] = useState('')
  const [confirmarBorrarTaller, setConfirmarBorrarTaller] = useState(false)
  const [todosSalones, setTodosSalones] = useState<any[]>([])

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
  const [confirmarDada, setConfirmarDada] = useState(false)
  const [planCompleto, setPlanCompleto] = useState(false)
  const [procesandoRevision, setProcesandoRevision] = useState(false)

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
    talleres.forEach((t: any) => {
      if (!t.salon_id || !t.hora) return
      const tInicio = horaAMinutos(t.hora.substring(0, 5))
      const numSlots = Math.max(1, Math.round((t.duracion_min || 60) / 15))
      columns.forEach(col => {
        if (col.salon.id !== t.salon_id) return
        if (parseFechaLocal(col.fecha).getDay() !== DIA_NUM[t.dia_semana]) return
        for (let i = 1; i < numSlots; i++) {
          const min = tInicio + i * 15
          const hh = Math.floor(min / 60)
          const mm = min % 60
          skip.add(`${t.salon_id}-${col.fecha}-${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`)
        }
      })
    })
    return skip
  }, [clases, talleres, columns])

  useEffect(() => { cargarSedes(); cargarProfesores(); cargarTodosSalones() }, [])
  useEffect(() => { if (sedeSeleccionada) { setTalleres([]); setInscritosPorTaller({}); cargarSalones(); cargarClases() } }, [sedeSeleccionada, fechaBase, diaSeleccionado, vista])
  useEffect(() => { if (salones.length > 0 && sedeSeleccionada) cargarTalleres() }, [salones])

  async function cargarTodosSalones() {
    const { data } = await supabase.from('salones').select('id, nombre, sede_id').order('nombre')
    setTodosSalones(data || [])
  }

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
    const { data } = await supabase.from('salones').select('id, nombre, sede_id').eq('sede_id', sedeSeleccionada).order('orden').order('nombre')
    setSalones(data || [])
  }

  async function cargarClases() {
    setCargando(true)
    const fechaInicio = vista === 'semana' ? formatFecha(fechasSemana[0]) : formatFecha(diaSeleccionado)
    const fechaFin = vista === 'semana' ? formatFecha(fechasSemana[5]) : formatFecha(diaSeleccionado)
    const { data } = await supabase
      .from('clases_con_numero')
      .select(`
        id, fecha, hora, duracion_min, estado, es_cortesia, patron_id, recurrente, cancelado_por_academia, numero_calculado, modalidad,
        contratos (id, clases_tomadas, total_clases, sede_id, duracion_min, clientes (id, nombre), instrumentos (nombre)),
        profesores (id, nombre),
        salones (id, nombre, sede_id)
      `)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .not('hora', 'is', null)
    setClases((data || []).filter((c: any) => c.salones?.sede_id === sedeSeleccionada))
    setCargando(false)
  }

  async function cargarTalleres() {
    const ids = salones.map((s: any) => s.id)
    if (!ids.length) return
    const { data } = await supabase
      .from('talleres')
      .select('id, nombre, profesor_id, salon_id, dia_semana, hora, duracion_min, valor_mensual, profesores(nombre), salones(id, nombre, sede_id)')
      .in('salon_id', ids).neq('estado', 'archivado')
    setTalleres(data || [])
    if (data?.length) {
      const hoy = new Date()
      const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
      const [{ data: ins }, { data: sesiones }] = await Promise.all([
        supabase.from('taller_inscripciones').select('taller_id')
          .in('taller_id', data.map((t: any) => t.id)).eq('estado', 'activo').gte('mes', mes),
        supabase.from('taller_sesiones').select('taller_id, fecha, estado')
          .in('taller_id', data.map((t: any) => t.id))
      ])
      const conteo: Record<string, number> = {}
      ;(ins || []).forEach((i: any) => { conteo[i.taller_id] = (conteo[i.taller_id] || 0) + 1 })
      setInscritosPorTaller(conteo)
      const sMap: Record<string, string> = {}
      ;(sesiones || []).forEach((s: any) => { sMap[`${s.taller_id}-${s.fecha}`] = s.estado })
      setSesionesEstadoMap(sMap)
    }
  }

  async function verificarConflictoSalon(salonId: string, fecha: string, hora: string, durMin: number, excluirId?: string): Promise<string | null> {
    const inicio = horaAMinutos(hora)
    const fin = inicio + durMin
    const { data } = await supabase.from('clases').select('id, hora, duracion_min, contratos(clientes(nombre))')
      .eq('salon_id', salonId).eq('fecha', fecha).neq('estado', 'cancelada')
    if (!data) return null
    for (const c of data) {
      if (excluirId && c.id === excluirId) continue
      const cI = horaAMinutos((c.hora || '').substring(0, 5))
      const cF = cI + ((c as any).duracion_min || 60)
      if (inicio < cF && fin > cI) {
        const nombre = (c as any).contratos?.clientes?.nombre || 'otra clase'
        return `Conflicto de salón con ${nombre} (${String(Math.floor(cI/60)).padStart(2,'0')}:${String(cI%60).padStart(2,'0')}–${String(Math.floor(cF/60)).padStart(2,'0')}:${String(cF%60).padStart(2,'0')})`
      }
    }
    return null
  }

  async function verificarConflictoProfesor(profId: string, fecha: string, hora: string, durMin: number, excluirId?: string): Promise<string | null> {
    if (!profId) return null
    const inicio = horaAMinutos(hora)
    const fin = inicio + durMin
    const diaSemana = DIAS_LARGO[parseFechaLocal(fecha).getDay()]
    const { data } = await supabase.from('clases').select('id, hora, duracion_min, salones(nombre), contratos(clientes(nombre))')
      .eq('profesor_id', profId).eq('fecha', fecha).neq('estado', 'cancelada')
    if (data) {
      for (const c of data) {
        if (excluirId && c.id === excluirId) continue
        const cI = horaAMinutos((c.hora || '').substring(0, 5))
        const cF = cI + ((c as any).duracion_min || 60)
        if (inicio < cF && fin > cI) {
          const cliente = (c as any).contratos?.clientes?.nombre || 'otro cliente'
          const salon = (c as any).salones?.nombre || 'otro salón'
          return `Profesor ya tiene clase con ${cliente} en ${salon} (${String(Math.floor(cI/60)).padStart(2,'0')}:${String(cI%60).padStart(2,'0')}–${String(Math.floor(cF/60)).padStart(2,'0')}:${String(cF%60).padStart(2,'0')})`
        }
      }
    }
    const { data: talleresPro } = await supabase.from('talleres')
      .select('id, nombre, hora, duracion_min').eq('profesor_id', profId).eq('dia_semana', diaSemana)
    if (talleresPro) {
      for (const t of talleresPro) {
        const tI = horaAMinutos((t.hora || '').substring(0, 5))
        const tF = tI + (t.duracion_min || 60)
        if (inicio < tF && fin > tI) {
          return `Profesor tiene taller "${t.nombre}" ese día (${String(Math.floor(tI/60)).padStart(2,'0')}:${String(tI%60).padStart(2,'0')}–${String(Math.floor(tF/60)).padStart(2,'0')}:${String(tF%60).padStart(2,'0')})`
        }
      }
    }
    return null
  }

  async function verificarConflictoCliente(contratoId: string, fecha: string, hora: string, durMin: number, excluirId?: string): Promise<string | null> {
    if (!contratoId) return null
    const inicio = horaAMinutos(hora)
    const fin = inicio + durMin
    const { data: ct } = await supabase.from('contratos').select('cliente_id').eq('id', contratoId).single()
    if (!ct) return null
    const { data: otrosContratos } = await supabase.from('contratos').select('id').eq('cliente_id', ct.cliente_id)
    if (!otrosContratos) return null
    const ids = otrosContratos.map((c: any) => c.id)
    const { data } = await supabase.from('clases').select('id, hora, duracion_min, salones(nombre), profesores(nombre)')
      .in('contrato_id', ids).eq('fecha', fecha).neq('estado', 'cancelada')
    if (!data) return null
    for (const c of data) {
      if (excluirId && c.id === excluirId) continue
      const cI = horaAMinutos((c.hora || '').substring(0, 5))
      const cF = cI + ((c as any).duracion_min || 60)
      if (inicio < cF && fin > cI) {
        const salon = (c as any).salones?.nombre || 'otro salón'
        const prof = (c as any).profesores?.nombre || 'otro profesor'
        return `Cliente ya tiene clase con ${prof} en ${salon} (${String(Math.floor(cI/60)).padStart(2,'0')}:${String(cI%60).padStart(2,'0')}–${String(Math.floor(cF/60)).padStart(2,'0')}:${String(cF%60).padStart(2,'0')})`
      }
    }
    const diaSemanaCliente = DIAS_LARGO[parseFechaLocal(fecha).getDay()]
    const { data: inscripciones } = await supabase
      .from('taller_inscripciones')
      .select('taller_id, talleres(nombre, hora, duracion_min, dia_semana)')
      .eq('cliente_id', ct.cliente_id)
      .eq('estado', 'activo')
    if (inscripciones) {
      for (const ins of inscripciones) {
        const t = (ins as any).talleres
        if (!t || t.dia_semana !== diaSemanaCliente) continue
        const tI = horaAMinutos((t.hora || '').substring(0, 5))
        const tF = tI + (t.duracion_min || 60)
        if (inicio < tF && fin > tI) {
          return `Cliente tiene taller "${t.nombre}" ese día (${String(Math.floor(tI/60)).padStart(2,'0')}:${String(tI%60).padStart(2,'0')}–${String(Math.floor(tF/60)).padStart(2,'0')}:${String(tF%60).padStart(2,'0')})`
        }
      }
    }
    return null
  }

  async function verificarTodos(salonId: string, profId: string, contratoId: string, fecha: string, hora: string, durMin: number, excluirId?: string): Promise<string | null> {
    const c1 = await verificarConflictoSalon(salonId, fecha, hora, durMin, excluirId)
    if (c1) return c1
    const c2 = await verificarConflictoProfesor(profId, fecha, hora, durMin, excluirId)
    if (c2) return c2
    const c3 = await verificarConflictoCliente(contratoId, fecha, hora, durMin, excluirId)
    if (c3) return c3
    return null
  }

  function calcularAvisosCrear(contrato: any, profIdActual: string, durActual: string, salonSede: string) {
    if (!contrato) { setAvisoCrear([]); return }
    const avisos: string[] = []
    if (contrato.profesor_id && profIdActual && contrato.profesor_id !== profIdActual) {
      const nombrePlan = profesores.find(p => p.id === contrato.profesor_id)?.nombre || 'del plan'
      const nombreActual = profesores.find(p => p.id === profIdActual)?.nombre || 'seleccionado'
      avisos.push(`el profesor (plan: ${nombrePlan} → esta clase: ${nombreActual})`)
    }
    if (contrato.duracion_min && durActual && String(contrato.duracion_min) !== durActual) {
      avisos.push(`la duración (plan: ${contrato.duracion_min} min → esta clase: ${durActual} min)`)
    }
    setAvisoCrear(avisos)
  }

  async function buscarClientes(texto: string) {
    setBusquedaCliente(texto)
    setClienteSeleccionado(null)
    setContratos([])
    setContratoSeleccionado(null)
    setAvisoCrear([])
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
      .select('id, total_clases, clases_tomadas, duracion_min, sede_id, instrumentos(nombre), profesores(id, nombre)')
      .eq('cliente_id', c.id).eq('estado', 'activo')
    setContratos(data || [])
    if (data?.length) {
      const ct = data[0] as any
      setContratoSeleccionado(ct)
      setDuracion(String(ct.duracion_min || 60))
      setProfesorId(ct.profesores?.id || '')
      calcularAvisosCrear(ct, ct.profesores?.id || '', String(ct.duracion_min || 60), slotSeleccionado?.salon?.sede_id || '')
    }
  }

  function seleccionarContrato(id: string) {
    const ct = contratos.find((c: any) => c.id === id) as any
    if (ct) {
      setContratoSeleccionado(ct)
      setDuracion(String(ct.duracion_min || 60))
      setProfesorId(ct.profesores?.id || '')
      calcularAvisosCrear(ct, ct.profesores?.id || '', String(ct.duracion_min || 60), slotSeleccionado?.salon?.sede_id || '')
    }
  }

  function abrirSlot(salon: any, hora: string, fecha: string) {
    setSlotSeleccionado({ salon, hora, fecha })
    setTipoModal('clase')
    setTallerGuardando(false)
    setModalAbierto(true)
    setBusquedaCliente('')
    setClienteSeleccionado(null)
    setClientesBuscados([])
    setContratos([])
    setContratoSeleccionado(null)
    setDuracion('60')
    setProfesorId('')
    setRecurrente(false)
    setFechaFinRecurrencia(`${new Date().getFullYear()}-12-31`)
    setError('')
    setAvisoCrear([])
    setConfirmarSedeDiferente(false)
    setModalidadClase('presencial')
    setTallerNombre('')
    setTallerProfesorId('')
    setTallerDuracion('60')
    setTallerValor('')
    setTallerError('')
    setTallerGuardando(false)
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
    setConfirmarDada(false)
    setPlanCompleto(false)
    setProcesandoRevision(false)
    setModalEditar(true)
  }

  async function abrirTaller(e: React.MouseEvent, taller: any, fechaCol: string) {
    e.stopPropagation()
    setTallerViendo(taller)
    setFechaSesionViendo(fechaCol)
    setModoEdicionTaller(false)
    setConfirmarBorrarTaller(false)
    setTeNombre(taller.nombre || '')
    setTeProfesorId(taller.profesor_id || '')
    setTeSalonId(taller.salon_id || '')
    setTeDiaSemana(taller.dia_semana || '')
    setTeHora(taller.hora?.substring(0, 5) || '')
    setTeDuracion(String(taller.duracion_min || 60))
    setTeValor(taller.valor_mensual !== null && taller.valor_mensual !== undefined ? String(taller.valor_mensual) : '')
    setTeError('')
    // Inscritos cuyo período cubre la fecha de esta sesión
    // Try with fecha_inicio/fecha_fin first; fallback to mes if columns don't exist
    let inscData: any[] = []
    try {
      const { data, error } = await supabase
        .from('taller_inscripciones')
        .select('id, mes, fecha_inicio, fecha_fin, valor_pagado, estado, clientes(nombre, telefono)')
        .eq('taller_id', taller.id)
        .eq('estado', 'activo')
      // Filter client-side to handle nulls gracefully
      const mesCol = fechaCol.substring(0, 7) + '-01'
      inscData = (data || []).filter((ins: any) => {
        if (ins.fecha_inicio && ins.fecha_fin) {
          return ins.fecha_inicio <= fechaCol && ins.fecha_fin >= fechaCol
        }
        // fallback: same month
        return ins.mes && ins.mes.substring(0, 7) === fechaCol.substring(0, 7)
      })
    } catch { inscData = [] }
    setInscritosDelTaller(inscData)
    const { data: sesion } = await supabase
      .from('taller_sesiones')
      .select('id, fecha, estado, profesor_id')
      .eq('taller_id', taller.id)
      .eq('fecha', fechaCol)
      .single()
    setSesionActual(sesion || null)
    setAsistenciasSesion({})
    setConfirmacionesSesion(new Set())
    if (sesion?.id) {
      const [{ data: asis }, { data: confs }] = await Promise.all([
        supabase.from('taller_asistencias').select('inscripcion_id, asistio').eq('sesion_id', sesion.id),
        supabase.from('taller_confirmaciones').select('inscripcion_id').eq('sesion_id', sesion.id)
      ])
      const map: Record<string, boolean | null> = {}
      ;(asis || []).forEach((a: any) => { map[a.inscripcion_id] = a.asistio })
      setAsistenciasSesion(map)
      setConfirmacionesSesion(new Set((confs || []).map((c: any) => c.inscripcion_id)))
    }
    setModalVerTaller(true)
  }

  async function toggleConfirmacion(inscripcionId: string) {
    if (!sesionActual?.id) return
    setGuardandoConfirmacion(true)
    const yaConfirmado = confirmacionesSesion.has(inscripcionId)
    if (yaConfirmado) {
      await supabase.from('taller_confirmaciones').delete()
        .eq('sesion_id', sesionActual.id).eq('inscripcion_id', inscripcionId)
      setConfirmacionesSesion(prev => { const n = new Set(prev); n.delete(inscripcionId); return n })
    } else {
      await supabase.from('taller_confirmaciones').upsert({
        sesion_id: sesionActual.id, inscripcion_id: inscripcionId, confirmado: true
      }, { onConflict: 'sesion_id,inscripcion_id' })
      setConfirmacionesSesion(prev => new Set([...prev, inscripcionId]))
    }
    setGuardandoConfirmacion(false)
  }

  async function cargarAsistenciasSesion(sesionId: string) {
    const { data } = await supabase
      .from('taller_asistencias').select('inscripcion_id, asistio').eq('sesion_id', sesionId)
    const map: Record<string, boolean | null> = {}
    ;(data || []).forEach((a: any) => { map[a.inscripcion_id] = a.asistio })
    setAsistenciasSesion(map)
  }

  async function toggleAsistenciaSesion(_sesionId: string, inscripcionId: string, asistio: boolean | null) {
    setGuardandoAsistencia(true)
    // Get or create sesion
    let sesionId = sesionActual?.id
    if (!sesionId) {
      // Check if one already exists (avoid duplicates)
      const { data: existing } = await supabase.from('taller_sesiones')
        .select('id, estado').eq('taller_id', tallerViendo.id).eq('fecha', fechaSesionViendo).maybeSingle()
      if (existing) {
        setSesionActual(existing)
        sesionId = existing.id
        // If existing is cancelled, don't allow attendance
        if (existing.estado === 'cancelada' || existing.estado === 'programada') {
          setGuardandoAsistencia(false); return
        }
      } else {
        const { data: newSesion } = await supabase.from('taller_sesiones')
          .insert({ taller_id: tallerViendo.id, fecha: fechaSesionViendo, estado: 'confirmada' })
          .select().single()
        if (!newSesion) { setGuardandoAsistencia(false); return }
        setSesionActual(newSesion)
        setSesionesEstadoMap(prev => ({ ...prev, [`${tallerViendo.id}-${fechaSesionViendo}`]: 'confirmada' }))
        sesionId = newSesion.id
      }
    }
    const yaExiste = inscripcionId in asistenciasSesion
    if (asistio === null) {
      await supabase.from('taller_asistencias').delete()
        .eq('sesion_id', sesionId).eq('inscripcion_id', inscripcionId)
      const newMap = { ...asistenciasSesion }; delete newMap[inscripcionId]
      setAsistenciasSesion(newMap)
    } else {
      if (yaExiste) {
        await supabase.from('taller_asistencias').update({ asistio })
          .eq('sesion_id', sesionId).eq('inscripcion_id', inscripcionId)
      } else {
        await supabase.from('taller_asistencias').insert({ sesion_id: sesionId, inscripcion_id: inscripcionId, asistio })
      }
      setAsistenciasSesion(prev => ({ ...prev, [inscripcionId]: asistio }))
    }
    setGuardandoAsistencia(false)
  }

  async function marcarSesion(nuevoEstado: string) {
    // Validate before confirming
    if (nuevoEstado === 'confirmada') {
      if (inscritosDelTaller.length === 0) {
        alert('No hay inscritos activos para esta sesión. Inscribe al menos un estudiante antes de confirmar.')
        return
      }
      if (confirmacionesSesion.size === 0) {
        alert('Selecciona al menos un inscrito que haya confirmado su asistencia.')
        return
      }
    }
    setGuardandoSesion(true)
    let sesionId = sesionActual?.id
    if (sesionActual) {
      const { error } = await supabase.from('taller_sesiones').update({ estado: nuevoEstado }).eq('id', sesionActual.id)
      if (!error) setSesionActual({ ...sesionActual, estado: nuevoEstado })
    } else {
      const { data, error } = await supabase
        .from('taller_sesiones')
        .insert({ taller_id: tallerViendo.id, fecha: fechaSesionViendo, estado: nuevoEstado })
        .select().single()
      if (!error && data) {
        setSesionActual(data)
        sesionId = data.id
      }
    }
    setGuardandoSesion(false)
    if (sesionId) {
      await cargarAsistenciasSesion(sesionId)
      // Update sesionesEstadoMap so the card color updates immediately
      setSesionesEstadoMap(prev => ({ ...prev, [`${tallerViendo.id}-${fechaSesionViendo}`]: nuevoEstado }))
    }
  }

  async function guardarEdicionTaller() {
    if (!teNombre.trim()) { setTeError('El nombre es obligatorio'); return }
    if (!teProfesorId) { setTeError('Selecciona un profesor'); return }
    if (!teSalonId) { setTeError('Selecciona un salón'); return }
    setTeGuardando(true); setTeError('')
    const { error } = await supabase.from('talleres').update({
      nombre: teNombre.trim(), profesor_id: teProfesorId, salon_id: teSalonId,
      dia_semana: teDiaSemana, hora: teHora + ':00', duracion_min: parseInt(teDuracion),
      valor_mensual: teValor !== '' ? Number(teValor) : null
    }).eq('id', tallerViendo.id)
    if (error) { setTeError('Error: ' + error.message); setTeGuardando(false); return }
    setModalVerTaller(false)
    await cargarTalleres()
    setTeGuardando(false)
  }

  async function borrarTaller() {
    setTeGuardando(true)
    const hoy = new Date().toISOString().split('T')[0]
    // Block if there are active inscriptions
    const { data: inscritos } = await supabase
      .from('taller_inscripciones').select('id, fecha_fin, mes')
      .eq('taller_id', tallerViendo.id).eq('estado', 'activo')
    const activos = (inscritos || []).filter((i: any) => {
      if (i.fecha_fin) return i.fecha_fin >= hoy
      return i.mes >= hoy.substring(0, 7) + '-01'
    })
    if (activos.length > 0) {
      setTeError(`No se puede archivar: tiene ${activos.length} inscrito(s) activo(s).`)
      setConfirmarBorrarTaller(false); setTeGuardando(false); return
    }
    // Archive the taller — preserves historical inscriptions and payments
    // Only delete sesiones (not needed for history) and active inscriptions
    const { data: sesiones } = await supabase.from('taller_sesiones').select('id').eq('taller_id', tallerViendo.id)
    if (sesiones && sesiones.length > 0) {
      const sIds = sesiones.map((s: any) => s.id)
      await supabase.from('taller_asistencias').delete().in('sesion_id', sIds)
      await supabase.from('taller_sesiones').delete().eq('taller_id', tallerViendo.id)
    }
    // Mark taller as archived — does NOT delete inscripciones or pagos
    const { error } = await supabase.from('talleres').update({ estado: 'archivado' }).eq('id', tallerViendo.id)
    if (error) { setTeError('Error: ' + error.message); setTeGuardando(false); return }
    setModalVerTaller(false)
    setConfirmarBorrarTaller(false)
    await cargarTalleres()
    setTeGuardando(false)
  }

  async function crearTaller() {
    if (!tallerNombre.trim()) { setTallerError('El nombre es obligatorio'); return }
    if (!tallerProfesorId) { setTallerError('Selecciona un profesor'); return }
    setTallerGuardando(true); setTallerError('')
    const diaSemana = DIAS_LARGO[parseFechaLocal(slotSeleccionado.fecha).getDay()]
    const { error } = await supabase.from('talleres').insert({
      nombre: tallerNombre.trim(), profesor_id: tallerProfesorId,
      salon_id: slotSeleccionado.salon.id, dia_semana: diaSemana,
      hora: slotSeleccionado.hora + ':00', duracion_min: parseInt(tallerDuracion),
      valor_mensual: tallerValor !== '' ? Number(tallerValor) : null
    })
    if (error) { setTallerError('Error: ' + error.message); setTallerGuardando(false); return }
    setTallerGuardando(false)
    setModalAbierto(false)
    await cargarTalleres()
  }

  async function guardarClase() {
    if (!clienteSeleccionado) { setError('Selecciona un cliente'); return }
    if (!contratoSeleccionado) { setError('Selecciona un plan'); return }
    if (!profesorId) { setError('Selecciona un profesor'); return }

    const sedePlan = (contratoSeleccionado as any)?.sede_id
    const sedeSalon = slotSeleccionado?.salon?.sede_id
    if (sedePlan && sedeSalon && sedePlan !== sedeSalon && !confirmarSedeDiferente) {
      setConfirmarSedeDiferente(true); return
    }

    setGuardando(true); setError('')

    if (recurrente) {
      const patronId = crypto.randomUUID()
      const batch: any[] = []
      const fechaFin = parseFechaLocal(fechaFinRecurrencia)
      let i = 0
      while (true) {
        const d = parseFechaLocal(slotSeleccionado.fecha)
        d.setDate(d.getDate() + i * 7)
        if (d > fechaFin) break
        const fechaStr = formatFecha(d)
        const conflicto = await verificarTodos(slotSeleccionado.salon.id, profesorId, (contratoSeleccionado as any).id, fechaStr, slotSeleccionado.hora, parseInt(duracion))
        if (conflicto) {
          if (batch.length === 0) { setError(`${conflicto} — semana 1. No se creó ninguna clase.`) }
          else {
            const { error: err } = await supabase.from('clases').insert(batch)
            if (err) setError('Error: ' + err.message)
            else { setError(`${conflicto} — semana ${i + 1}. Se crearon ${batch.length} clases.`); cargarClases() }
          }
          setGuardando(false); return
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
          recurrente: true,
          modalidad: slotSeleccionado.salon.nombre === 'Domicilio' ? 'domicilio' : 'presencial',
        })
        i++
      }
      const { error: err } = await supabase.from('clases').insert(batch)
      if (err) setError('Error: ' + err.message)
      else { setModalAbierto(false); cargarClases() }
    } else {
      const conflicto = await verificarTodos(slotSeleccionado.salon.id, profesorId, (contratoSeleccionado as any).id, slotSeleccionado.fecha, slotSeleccionado.hora, parseInt(duracion))
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
        confirmada_profesor: false,
        modalidad: slotSeleccionado.salon.nombre === 'Domicilio' ? 'domicilio' : 'presencial',
      })
      if (err) setError('Error: ' + err.message)
      else { setModalAbierto(false); cargarClases() }
    }
    setGuardando(false)
  }

  async function guardarEdicion(alcance: 'esta' | 'futuras') {
    setEditGuardando(true); setEditError('')
    const conflicto = await verificarTodos(
      editSalonId, editProfesorId, claseEditando.contratos?.id || '',
      editFecha, editHora, parseInt(editDuracion), claseEditando.id
    )
    if (conflicto) { setEditError(conflicto); setEditGuardando(false); return }

    let numeroPlan: number | undefined = undefined
    if (editEstado === 'dada' && claseEditando.estado !== 'dada' && claseEditando.contratos?.id) {
      const duracionPlan = claseEditando.contratos?.duracion_min || parseInt(editDuracion)
      const fraccion = parseFloat((parseInt(editDuracion) / duracionPlan).toFixed(4))
      const clasesTomadas = parseFloat(((claseEditando.contratos?.clases_tomadas || 0) + fraccion).toFixed(4))
      numeroPlan = clasesTomadas
      const totalClases = claseEditando.contratos?.total_clases || 0
      const updateData: any = { clases_tomadas: clasesTomadas }
      if (totalClases > 0 && clasesTomadas >= totalClases) updateData.estado = 'completado'
      await supabase.from('contratos').update(updateData).eq('id', claseEditando.contratos.id)
      // numero_en_plan ya no se almacena — se calcula en tiempo real desde clases_con_numero
    }

    if (alcance === 'futuras' && claseEditando.patron_id) {
      const { data: clasesFuturas, error: errorBuscar } = await supabase
        .from('clases').select('id')
        .eq('patron_id', claseEditando.patron_id)
        .gte('fecha', claseEditando.fecha)
      if (errorBuscar || !clasesFuturas || clasesFuturas.length === 0) {
        setEditError('No se encontraron clases futuras en la serie.')
        setEditGuardando(false); return
      }
      const ids = clasesFuturas.map((c: any) => c.id)
      const { error } = await supabase.from('clases')
        .update({ hora: editHora + ':00', duracion_min: parseInt(editDuracion), profesor_id: editProfesorId, salon_id: editSalonId, estado: editEstado })
        .in('id', ids)
      if (error) { setEditError('Error: ' + error.message); setEditGuardando(false); return }
    } else {
      const updatePayload: any = { hora: editHora + ':00', duracion_min: parseInt(editDuracion), profesor_id: editProfesorId, salon_id: editSalonId, estado: editEstado, fecha: editFecha }

      // Cancelación desde admin = siempre por academia
      if (editEstado === 'cancelada') {
        updatePayload.cancelado_por_academia = true
        updatePayload.cancelado_tarde = true
      }
      const { error } = await supabase.from('clases')
        .update(updatePayload)
        .eq('id', claseEditando.id)
      if (error) { setEditError('Error: ' + error.message); setEditGuardando(false); return }
      // Notificación al cancelar desde admin
      if (editEstado === 'cancelada') {
        const esTardia = updatePayload.cancelado_tarde
        await supabase.from('notificaciones').insert({
          tipo: esTardia ? 'cancelacion_tardia' : 'cancelacion_a_tiempo',
          mensaje: `${esTardia ? 'Cancelación tardía' : 'Cancelación a tiempo'} — ${claseEditando.contratos?.clientes?.nombre || '—'}`,
          detalle: `${claseEditando.fecha} ${editHora} · ${claseEditando.salones?.nombre || '—'} · ${claseEditando.profesores?.nombre || '—'}`,
          clase_id: claseEditando.id
        })
      }
    }

    setModalEditar(false)
    cargarClases()
    setEditGuardando(false)
  }

  async function borrarClase(alcance: 'esta' | 'futuras') {
    setEditGuardando(true)
    if (claseEditando.estado === 'dada' && !claseEditando.es_cortesia && claseEditando.contratos?.id) {
      // Leer clases_tomadas fresco de BD para evitar valor desactualizado del objeto en memoria
      const { data: ctFresh } = await supabase.from('contratos').select('clases_tomadas, duracion_min').eq('id', claseEditando.contratos.id).single()
      const durPlan  = ctFresh?.duracion_min || claseEditando.contratos?.duracion_min || claseEditando.duracion_min || 60
      const durClase = claseEditando.duracion_min || durPlan
      const fraccion = parseFloat((durClase / durPlan).toFixed(4))
      const clasesTomadas = Math.max(0, parseFloat(((ctFresh?.clases_tomadas || 0) - fraccion).toFixed(4)))
      await supabase.from('contratos').update({ clases_tomadas: clasesTomadas }).eq('id', claseEditando.contratos.id)
    }
    if (alcance === 'futuras' && claseEditando.patron_id) {
      await supabase.from('clases').delete().eq('patron_id', claseEditando.patron_id).gte('fecha', claseEditando.fecha)
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

  function getTallerSlot(salonId: string, hora: string, fecha: string) {
    const diaSemana = DIAS_LARGO[parseFechaLocal(fecha).getDay()]
    return talleres.find(t =>
      t.salon_id === salonId && t.dia_semana === diaSemana && t.hora?.substring(0, 5) === hora
    ) || null
  }

  const hayEdicionReal = claseEditando && (
    editHora !== claseEditando.hora?.substring(0, 5) ||
    editFecha !== claseEditando.fecha ||
    editProfesorId !== claseEditando.profesores?.id ||
    editSalonId !== claseEditando.salones?.id ||
    editDuracion !== String(claseEditando.duracion_min)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', maxWidth: '100%' }}>

      {/* Encabezado */}
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
            { label: 'Dada',       color: '#854d0e', bg: '#fefce8' },
            { label: 'Cancelada',  color: '#991b1b', bg: '#fee2e2' },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: TALLER_BG, border: `1px solid ${TALLER_BORDER}` }} />
            <span style={{ fontSize: '12px', color: '#666' }}>Taller</span>
          </div>
          {/* ── FIX 4: "Revisión pendiente" → "Inasistencia" ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#fff7ed', border: '1px solid #fed7aa' }} />
            <span style={{ fontSize: '12px', color: '#666' }}>Inasistencia</span>
          </div>
        </div>
      </div>

      {/* Grilla */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {cargando && <p style={{ textAlign: 'center', color: '#666', padding: '20px' }}>Cargando...</p>}
        <table style={{ borderCollapse: 'collapse', minWidth: '100%', width: 'max-content' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
            {vista === 'semana' ? (
              <>
                <tr style={{ background: TEAL }}>
                  <th rowSpan={2} style={{ padding: '10px 12px', color: 'white', fontSize: '12px', width: '64px', position: 'sticky', left: 0, background: TEAL, zIndex: 4, verticalAlign: 'middle' }}>Hora</th>
                  {fechasSemana.map((fecha, i) => (
                    <th key={`dia-${i}`} colSpan={salones.length} style={{
                      padding: '6px 4px', color: 'white', textAlign: 'center', fontWeight: '700', fontSize: '12px',
                      borderLeft: '3px solid rgba(255,255,255,0.6)', borderBottom: `2px solid ${TEAL_MID}`
                    }}>
                      {DIAS[i]} {formatFechaMostrar(fecha)}
                    </th>
                  ))}
                </tr>
                <tr style={{ background: TEAL }}>
                  {fechasSemana.flatMap((_, i) =>
                    salones.map((salon: any, j) => (
                      <th key={`salon-${i}-${salon.id}`} style={{
                        padding: '4px 4px', color: 'rgba(255,255,255,0.85)', textAlign: 'center',
                        fontSize: '10px', fontWeight: '400',
                        borderLeft: j === 0 ? '3px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.15)',
                        width: '80px', minWidth: '80px', background: TEAL
                      }}>
                        {salon.nombre}
                      </th>
                    ))
                  )}
                </tr>
              </>
            ) : (
              <tr style={{ background: TEAL }}>
                <th style={{ padding: '10px 12px', color: 'white', fontSize: '12px', width: '64px', position: 'sticky', left: 0, background: TEAL, zIndex: 4 }}>Hora</th>
                {columns.map(col => (
                  <th key={`${col.salon.id}-${col.fecha}`} style={{
                    padding: '8px 10px', color: 'white', textAlign: 'center',
                    borderLeft: '1px solid rgba(255,255,255,0.2)',
                    width: '150px', minWidth: '140px'
                  }}>
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{col.header}</div>
                  </th>
                ))}
              </tr>
            )}
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
                  const taller = getTallerSlot(col.salon.id, hora, col.fecha)
                  const mainClass = cs[0]
                  const rowSpan = taller
                    ? Math.max(1, Math.round((taller.duracion_min || 60) / 15))
                    : mainClass ? Math.max(1, Math.round((mainClass.duracion_min || 60) / 15)) : 1
                  const esCeldaPasada = esPasado(col.fecha)
                  return (
                    <td key={cellKey}
                      rowSpan={rowSpan}
                      onClick={() => { if (!mainClass && !taller) abrirSlot(col.salon, hora, col.fecha) }}
                      style={{
                        padding: 0, height: '1px', verticalAlign: 'top',
                        borderLeft: '1px solid #f1f5f9',
                        cursor: (mainClass || taller) ? 'default' : 'pointer',
                        width: vista === 'semana' ? '80px' : '150px', minWidth: vista === 'semana' ? '72px' : '140px',
                        background: esCeldaPasada && !mainClass && !taller ? '#f0f0f0' :
                        (!mainClass && !taller && (col.salon.nombre === 'Virtual' || col.salon.nombre === 'Domicilio')) ? '#f0f4f4' : undefined
                      }}
                      onMouseEnter={e => { if (!mainClass && !taller) e.currentTarget.style.background = TEAL_LIGHT }}
                      onMouseLeave={e => { if (!mainClass && !taller) e.currentTarget.style.background = esCeldaPasada ? '#fafafa' : '' }}
                      ref={el => {
                        if (el && vista === 'semana' && col.subheader === salones[0]?.nombre) {
                          el.style.borderLeft = '3px solid #cbd5e1'
                        }
                      }}
                    >
                      {taller && (() => {
                          const sesEst = sesionesEstadoMap[`${taller.id}-${col.fecha}`] || 'programada'
                          const bg = sesEst === 'dada' ? '#fefce8' : sesEst === 'cancelada' ? '#fee2e2' : sesEst === 'confirmada' ? TALLER_BG : '#f3f4f6'
                          const color = sesEst === 'dada' ? '#854d0e' : sesEst === 'cancelada' ? '#991b1b' : sesEst === 'confirmada' ? TEAL : '#9ca3af'
                          const border = sesEst === 'dada' ? '#fde68a' : sesEst === 'cancelada' ? '#fecaca' : sesEst === 'confirmada' ? TEAL_MID : '#e5e7eb'
                          return <div key="tc" onClick={e => abrirTaller(e, taller, col.fecha)} title="Clic para ver inscritos"
                            style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: '6px', padding: '4px 7px',
                              fontSize: vista === 'dia' ? '13px' : '11px', cursor: 'pointer', height: 'calc(100% - 4px)',
                              overflow: 'hidden', boxSizing: 'border-box', margin: '2px 3px', opacity: sesEst === 'programada' ? 0.7 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2px' }}>
                              <strong>🎸 {taller.nombre}</strong>
                              <span style={{ fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap', background: 'rgba(124,58,237,0.15)', padding: '1px 6px', borderRadius: '10px' }}>
                                {inscritosPorTaller[taller.id] || 0} 👤
                              </span>
                            </div>
                            {vista === 'dia' && <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '1px' }}>{taller.profesores?.nombre}</div>}
                          </div>
                        })()}

                      {mainClass && !taller && (() => {
                        const col2 = getColorEstado(mainClass.es_cortesia ? 'dada' : mainClass.estado, mainClass.estado === 'cancelada' && !mainClass.cancelado_por_academia)
                        // número calculado en tiempo real desde la view de Supabase
                        const numPlan = mainClass.contratos?.total_clases && mainClass.numero_calculado
                          ? `${mainClass.numero_calculado}/${mainClass.contratos.total_clases}`
                          : ''
                        return (
                          <div onClick={(e) => abrirClaseExistente(e, mainClass)} title="Clic para editar"
                            style={{
                              background: col2.bg, color: col2.color, border: `1px solid ${col2.border}`,
                              borderRadius: '6px', padding: '4px 7px',
                              fontSize: vista === 'dia' ? '13px' : '11px',
                              cursor: 'pointer', height: 'calc(100% - 4px)',
                              overflow: 'hidden', boxSizing: 'border-box', margin: '2px 3px'
                            }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2px' }}>
                              <strong style={{ lineHeight: '1.3', fontSize: vista === 'dia' ? '13px' : '10px', wordBreak: 'break-word' }}>
                                {mainClass.contratos?.clientes?.nombre}
                              </strong>
                              <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}>
                                {numPlan && vista === 'dia' && (
                                  <span style={{ fontSize: '12px', fontWeight: '700', opacity: 0.9, whiteSpace: 'nowrap' }}>{numPlan}</span>
                                )}
                                {mainClass.recurrente && <span style={{ fontSize: '9px' }}>🔁</span>}
                                {mainClass.estado === 'cancelada' && !mainClass.cancelado_por_academia && <span style={{ fontSize: '9px' }}>⚠️</span>}
                              </div>
                            </div>
                            {vista === 'dia' && mainClass.profesores?.nombre && (
                              <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '1px' }}>{mainClass.profesores.nombre}</div>
                            )}
                            {vista === 'dia' && rowSpan >= 3 && (
                              <div style={{ fontSize: '11px', opacity: 0.75, marginTop: '1px' }}>{mainClass.contratos?.instrumentos?.nombre}</div>
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
            <div style={{ background: tipoModal === 'taller' ? TALLER_COLOR : TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>
                  {tipoModal === 'taller' ? '🎸 Nuevo taller' : 'Asignar clase'}
                </h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>{slotSeleccionado.salon.nombre}</p>
                <p style={{ margin: '6px 0 0', color: 'white', fontSize: '18px', fontWeight: '700' }}>
                  {formatFechaLarga(parseFechaLocal(slotSeleccionado.fecha))} · {slotSeleccionado.hora}
                </p>
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid #eef2f7' }}>
              {[{ key: 'clase', label: '📚 Clase regular' }, { key: 'taller', label: '🎸 Taller' }].map(op => (
                <button key={op.key} onClick={() => setTipoModal(op.key as any)} style={{
                  flex: 1, padding: '12px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                  background: tipoModal === op.key ? (op.key === 'taller' ? TALLER_BG : TEAL_LIGHT) : 'white',
                  color: tipoModal === op.key ? (op.key === 'taller' ? TALLER_COLOR : TEAL) : '#888',
                  borderBottom: tipoModal === op.key ? `2px solid ${op.key === 'taller' ? TALLER_COLOR : TEAL}` : '2px solid transparent'
                }}>{op.label}</button>
              ))}
            </div>

            <div style={{ padding: '20px 24px', maxHeight: '65vh', overflowY: 'auto' }}>
              {tipoModal === 'clase' && (
                <>
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

                  {clienteSeleccionado && contratos.length === 0 && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#991b1b' }}>🚫 Sin plan activo</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#7f1d1d' }}>Este cliente no tiene un plan activo. Crea el plan desde <strong>Clientes</strong> antes de asignar la clase.</p>
                    </div>
                  )}

                  {contratos.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={labelStyle}>Plan</label>
                      <select value={(contratoSeleccionado as any)?.id || ''} onChange={e => { seleccionarContrato(e.target.value); setConfirmarSedeDiferente(false) }} style={fieldStyle}>
                        {contratos.map((ct: any) => {
                          const sedePlan = sedes.find(s => s.id === ct.sede_id)?.nombre || '?'
                          return (
                            <option key={ct.id} value={ct.id}>
                              {ct.instrumentos?.nombre || '—'} · {sedePlan} · {ct.profesores?.nombre || '—'} · {ct.clases_tomadas}/{ct.total_clases} · {ct.duracion_min}min
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  )}

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Profesor</label>
                    <select value={profesorId} onChange={e => {
                      setProfesorId(e.target.value)
                      calcularAvisosCrear(contratoSeleccionado, e.target.value, duracion, slotSeleccionado?.salon?.sede_id || '')
                    }} style={fieldStyle}>
                      <option value="">— Seleccionar profesor —</option>
                      {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Duración</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {DURACIONES.map(d => (
                        <button key={d} onClick={() => {
                          setDuracion(d)
                          calcularAvisosCrear(contratoSeleccionado, profesorId, d, slotSeleccionado?.salon?.sede_id || '')
                        }} style={{
                          flex: 1, padding: '9px', border: `1px solid ${duracion === d ? TEAL : TEAL_MID}`,
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                          background: duracion === d ? TEAL : 'white', color: duracion === d ? 'white' : '#333',
                          fontWeight: duracion === d ? '600' : '400'
                        }}>{d}min</button>
                      ))}
                    </div>
                  </div>

                  {avisoCrear.length > 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: '600', color: '#92400e' }}>⚠️ Estás modificando:</p>
                      <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {avisoCrear.map((a, i) => <li key={i} style={{ fontSize: '13px', color: '#78350f', marginBottom: '2px' }}>{a}</li>)}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px', background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', color: '#333' }}>
                      <input type="checkbox" checked={recurrente} onChange={e => setRecurrente(e.target.checked)} />
                      🔁 Repetir semanalmente
                    </label>
                    {recurrente && (
                      <div style={{ marginTop: '10px' }}>
                        <label style={{ ...labelStyle, marginBottom: '6px' }}>Repetir hasta:</label>
                        <input type="date" value={fechaFinRecurrencia}
                          min={slotSeleccionado?.fecha || formatFecha(new Date())}
                          onChange={e => setFechaFinRecurrencia(e.target.value)} style={fieldStyle} />
                        {fechaFinRecurrencia && slotSeleccionado?.fecha && (() => {
                          const semanas = Math.floor((parseFechaLocal(fechaFinRecurrencia).getTime() - parseFechaLocal(slotSeleccionado.fecha).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                          return semanas > 0 ? <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#666' }}>Se crearán aprox. <strong>{semanas}</strong> clases · mismo día y hora</p> : null
                        })()}
                      </div>
                    )}
                  </div>

                  {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

                  {confirmarSedeDiferente && (
                    <div style={{ background: '#fff7ed', border: '2px solid #f97316', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: '#c2410c' }}>⚠️ Sede diferente</p>
                      <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#9a3412' }}>
                        El plan es de <strong>{sedes.find(s => s.id === (contratoSeleccionado as any)?.sede_id)?.nombre}</strong>, pero el salón está en <strong>{sedes.find(s => s.id === slotSeleccionado?.salon?.sede_id)?.nombre || 'otra sede'}</strong>.
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={guardarClase} disabled={guardando} style={{ flex: 1, padding: '9px', background: '#c2410c', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Crear de todas formas</button>
                        <button onClick={() => setConfirmarSedeDiferente(false)} style={{ padding: '9px 16px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={guardarClase} disabled={guardando} style={{ flex: 1, padding: '11px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                      {guardando ? 'Verificando...' : recurrente ? `Crear clases hasta ${fechaFinRecurrencia}` : 'Asignar clase'}
                    </button>
                    <button onClick={() => setModalAbierto(false)} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
                  </div>
                </>
              )}

              {tipoModal === 'taller' && (
                <>
                  <div style={{ background: TALLER_BG, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: TALLER_COLOR }}>
                    Se repetirá cada <strong>{DIAS_LARGO[parseFechaLocal(slotSeleccionado.fecha).getDay()]}</strong> a las <strong>{slotSeleccionado.hora}</strong> en <strong>{slotSeleccionado.salon.nombre}</strong>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Nombre del taller *</label>
                    <input value={tallerNombre} onChange={e => setTallerNombre(e.target.value)} placeholder="Ej: Taller de guitarra eléctrica" style={fieldStyle} />
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Profesor *</label>
                    <select value={tallerProfesorId} onChange={e => setTallerProfesorId(e.target.value)} style={fieldStyle}>
                      <option value="">— Seleccionar —</option>
                      {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Duración</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {DURACIONES.map(d => (
                        <button key={d} onClick={() => setTallerDuracion(d)} style={{
                          flex: 1, padding: '9px', border: `2px solid ${tallerDuracion === d ? TALLER_COLOR : TEAL_MID}`,
                          borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                          background: tallerDuracion === d ? TALLER_BG : 'white',
                          color: tallerDuracion === d ? TALLER_COLOR : '#333',
                          fontWeight: tallerDuracion === d ? '600' : '400'
                        }}>{d}min</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={labelStyle}>Valor mensual ($)</label>
                    <input type="number" min={0} value={tallerValor} onChange={e => setTallerValor(e.target.value)} placeholder="Opcional" style={fieldStyle} />
                  </div>
                  {tallerError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{tallerError}</p>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={crearTaller} disabled={tallerGuardando} style={{ flex: 1, padding: '11px', background: TALLER_COLOR, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                      {tallerGuardando ? 'Creando...' : 'Crear taller'}
                    </button>
                    <button onClick={() => setModalAbierto(false)} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL VER / EDITAR TALLER ══ */}
      {modalVerTaller && tallerViendo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: TALLER_COLOR, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>🎸 {tallerViendo.nombre}</h3>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  {sesionActual?.profesor_id && sesionActual.profesor_id !== tallerViendo?.profesor_id ? `${profesores.find((p: any) => p.id === sesionActual.profesor_id)?.nombre || tallerViendo.profesores?.nombre} (reemplazo)` : tallerViendo.profesores?.nombre} · {tallerViendo.salones?.nombre} · {tallerViendo.dia_semana} {tallerViendo.hora?.substring(0, 5)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setModoEdicionTaller(!modoEdicionTaller); setConfirmarBorrarTaller(false) }}
                  style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>
                  {modoEdicionTaller ? '👁 Ver inscritos' : '✏️ Editar'}
                </button>
                <button onClick={() => setModalVerTaller(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
              {!modoEdicionTaller ? (
                <>
                  <div style={{ background: '#fafbfc', border: '1px solid #eef2f7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#555' }}>Sesión del {fechaSesionViendo}</p>
                      <span style={{
                        padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                        background: sesionActual?.estado === 'dada' ? '#fefce8' : sesionActual?.estado === 'cancelada' ? '#fee2e2' : '#eff6ff',
                        color: sesionActual?.estado === 'dada' ? '#854d0e' : sesionActual?.estado === 'cancelada' ? '#991b1b' : '#1d4ed8'
                      }}>
                        {sesionActual?.estado || 'programada'}
                      </span>
                    </div>
                    {sesionActual?.estado === 'cancelada' ? (
                      <div>
                        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#991b1b', fontWeight: '600' }}>⚠️ Sesión cancelada</p>
                        <div style={{ marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', color: '#555', fontWeight: '600', display: 'block', marginBottom: '4px' }}>Reasignar profesor</label>
                          <select
                            value={sesionActual?.profesor_id || tallerViendo?.profesor_id || ''}
                            onChange={async e => {
                              const nuevoProf = e.target.value
                              if (!nuevoProf) return
                              // Update professor on the taller itself
                              await supabase.from('talleres').update({ profesor_id: nuevoProf }).eq('id', tallerViendo.id)
                              // Update sesion estado to confirmada
                              if (sesionActual?.id) {
                                await supabase.from('taller_sesiones').update({ estado: 'confirmada' }).eq('id', sesionActual.id)
                                setSesionActual((prev: any) => ({ ...prev, estado: 'confirmada' }))
                              } else {
                                const { data: newSes } = await supabase.from('taller_sesiones')
                                  .insert({ taller_id: tallerViendo.id, fecha: fechaSesionViendo, estado: 'confirmada' })
                                  .select().single()
                                if (newSes) setSesionActual(newSes)
                              }
                              setSesionesEstadoMap(prev => ({ ...prev, [`${tallerViendo.id}-${fechaSesionViendo}`]: 'confirmada' }))
                              // Refresh talleres to show new professor
                              await cargarTalleres()
                            }}
                            style={{ width: '100%', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px' }}>
                            <option value="">— Seleccionar nuevo profesor —</option>
                            {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                        </div>
                        <button onClick={async () => {
                          if (window.confirm('¿Borrar esta sesión cancelada?')) {
                            if (sesionActual?.id) {
                              await supabase.from('taller_asistencias').delete().eq('sesion_id', sesionActual.id)
                              await supabase.from('taller_confirmaciones').delete().eq('sesion_id', sesionActual.id)
                              await supabase.from('taller_sesiones').delete().eq('id', sesionActual.id)
                            }
                            setSesionActual(null)
                            setSesionesEstadoMap(prev => { const n = {...prev}; delete n[`${tallerViendo.id}-${fechaSesionViendo}`]; return n })
                          }
                        }} style={{ width: '100%', padding: '8px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                          🗑 Borrar esta sesión
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[
                          { est: 'programada', label: 'Programada', bg: '#eff6ff', color: '#1d4ed8' },
                          { est: 'confirmada', label: 'Confirmada', bg: '#dcfce7', color: '#166534' },
                          { est: 'dada', label: 'Dada', bg: '#fefce8', color: '#854d0e' },
                          { est: 'cancelada', label: 'Cancelada', bg: '#fee2e2', color: '#991b1b' },
                        ].map(op => {
                          const esActual = (sesionActual?.estado || 'programada') === op.est
                          return (
                            <button key={op.est} onClick={() => {
                              if (op.est === 'dada') {
                                const hay = Object.values(asistenciasSesion).some(v => v === true)
                                if (!hay) { alert('Selecciona al menos un asistente antes de marcar la sesión como dada'); return }
                              }
                              !esActual && marcarSesion(op.est)
                            }}
                              disabled={guardandoSesion || esActual}
                              style={{ flex: 1, padding: '6px', borderRadius: '8px', cursor: esActual ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', border: `1px solid ${esActual ? op.color : '#e2e8f0'}`, background: esActual ? op.bg : 'white', color: esActual ? op.color : '#666' }}>
                              {op.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#333' }}>
                      Inscritos esta sesión <span style={{ color: TALLER_COLOR }}>({inscritosDelTaller.length})</span>
                    </p>
                  </div>
                  {inscritosDelTaller.length === 0
                    ? <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 0', fontSize: '14px' }}>Sin inscritos esta sesión</p>
                    : (<>
                        {/* PROGRAMADA: show confirmation checkboxes */}
                        {(!sesionActual || sesionActual.estado === 'programada') && (
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#1d4ed8', fontStyle: 'italic' }}>
                            Selecciona los estudiantes que confirmaron asistencia para esta sesión.
                          </p>
                        )}
                        {/* CONFIRMADA/DADA: show attendance checkboxes */}
                        {(sesionActual?.estado === 'confirmada' || sesionActual?.estado === 'dada') && (
                          <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#166534', fontStyle: 'italic' }}>
                            Selecciona los estudiantes que asistieron a esta sesión.
                          </p>
                        )}
                        {inscritosDelTaller.map((ins: any, i) => {
                          const sesionId = sesionActual?.id
                          const esProg = !sesionActual || sesionActual.estado === 'programada'
                          const esConfirmadaODada = sesionActual?.estado === 'confirmada' || sesionActual?.estado === 'dada'
                          const confirmado = confirmacionesSesion.has(ins.id)
                          const asistio = asistenciasSesion[ins.id]
                          return (
                            <div key={ins.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: i % 2 === 0 ? '#fafbfc' : 'white', marginBottom: '4px' }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: '500', fontSize: '14px' }}>{ins.clientes?.nombre || '—'}</p>
                                <p style={{ margin: 0, fontSize: '12px', color: '#888' }}>{ins.clientes?.telefono || '—'}</p>
                              </div>
                              {/* Confirmation checkbox — visible in programada state */}
                              {esProg && (
                                <button onClick={async () => {
                                  if (!sesionActual?.id) {
                                    const { data } = await supabase.from('taller_sesiones')
                                      .insert({ taller_id: tallerViendo.id, fecha: fechaSesionViendo, estado: 'programada' })
                                      .select().single()
                                    if (data) {
                                      setSesionActual(data)
                                      setSesionesEstadoMap(prev => ({ ...prev, [`${tallerViendo.id}-${fechaSesionViendo}`]: 'programada' }))
                                    }
                                    return
                                  }
                                  toggleConfirmacion(ins.id)
                                }}
                                  disabled={guardandoConfirmacion}
                                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: confirmado ? '2px solid #1d4ed8' : '1px solid #e2e8f0', background: confirmado ? '#eff6ff' : 'white', color: confirmado ? '#1d4ed8' : '#aaa', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {confirmado ? '✓' : ''}
                                </button>
                              )}
                              {/* Attendance checkbox — visible in confirmada/dada state */}
                              {esConfirmadaODada && (
                                <button onClick={() => toggleAsistenciaSesion(sesionId, ins.id, asistio === true ? null : true)}
                                  disabled={guardandoAsistencia}
                                  style={{ width: '32px', height: '32px', borderRadius: '8px', border: asistio === true ? '2px solid #166534' : '1px solid #e2e8f0', background: asistio === true ? '#dcfce7' : 'white', color: asistio === true ? '#166534' : '#aaa', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {asistio === true ? '✓' : ''}
                                </button>
                              )}
                              {/* Read-only badge for other states */}
                              {!esProg && !esConfirmadaODada && (
                                <span style={{ fontSize: '12px', color: '#aaa' }}>—</span>
                              )}
                            </div>
                          )
                        })}
                      </>)
                  }
                  <button onClick={() => setModalVerTaller(false)} style={{ width: '100%', marginTop: '16px', padding: '10px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cerrar</button>
                </>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Nombre del taller *</label>
                      <input value={teNombre} onChange={e => setTeNombre(e.target.value)} style={fieldStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Profesor *</label>
                      <select value={teProfesorId} onChange={e => setTeProfesorId(e.target.value)} style={fieldStyle}>
                        <option value="">— Seleccionar —</option>
                        {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Salón *</label>
                      <select value={teSalonId} onChange={e => setTeSalonId(e.target.value)} style={fieldStyle}>
                        <option value="">— Seleccionar —</option>
                        {todosSalones.filter((s: any) => s.sede_id === tallerViendo?.salones?.sede_id).map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Día de la semana</label>
                      <select value={teDiaSemana} onChange={e => setTeDiaSemana(e.target.value)} style={fieldStyle}>
                        {['lunes','martes','miércoles','jueves','viernes','sábado'].map(d => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Hora de inicio</label>
                      <select value={teHora} onChange={e => setTeHora(e.target.value)} style={fieldStyle}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Duración</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        {DURACIONES.map(d => (
                          <button key={d} onClick={() => setTeDuracion(d)} style={{
                            flex: 1, padding: '9px', border: `2px solid ${teDuracion === d ? TALLER_COLOR : TEAL_MID}`,
                            borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                            background: teDuracion === d ? TALLER_BG : 'white', color: teDuracion === d ? TALLER_COLOR : '#333',
                            fontWeight: teDuracion === d ? '600' : '400'
                          }}>{d}min</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Valor mensual ($)</label>
                      <input type="number" min={0} value={teValor} onChange={e => setTeValor(e.target.value)} placeholder="Opcional" style={fieldStyle} />
                    </div>
                  </div>
                  {teError && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{teError}</p>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                    <button onClick={guardarEdicionTaller} disabled={teGuardando} style={{ flex: 1, padding: '10px', background: TALLER_COLOR, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                      {teGuardando ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button onClick={() => setModoEdicionTaller(false)} style={{ padding: '10px 16px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
                  </div>
                  {!confirmarBorrarTaller ? (
                    <button onClick={() => setConfirmarBorrarTaller(true)} style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Archivar taller</button>
                  ) : (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px', marginTop: '10px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#991b1b', fontWeight: '700' }}>¿Archivar el taller "{tallerViendo.nombre}"?</p>
                      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#666' }}>Se eliminará permanentemente.</p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={borrarTaller} disabled={teGuardando} style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Sí, archivar</button>
                        <button onClick={() => setConfirmarBorrarTaller(false)} style={{ padding: '8px 14px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EDITAR CLASE ══ */}
      {modalEditar && claseEditando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>
                  {esBloqueada(claseEditando) ? '🔒 Clase dada' : 'Editar clase'}
                </h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{claseEditando.contratos?.clientes?.nombre}</p>
                <p style={{ margin: '4px 0 0', color: 'white', fontSize: '18px', fontWeight: '700' }}>
                  {formatFechaLarga(parseFechaLocal(claseEditando.fecha))} · {claseEditando.hora?.substring(0, 5)}
                </p>
              </div>
              <button onClick={() => setModalEditar(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px', maxHeight: '75vh', overflowY: 'auto' }}>

              {claseEditando.estado === 'cancelada' && !claseEditando.cancelado_por_academia ? (
                <div style={{ background: TEAL_LIGHT, borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#555', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <span>👤 {claseEditando.contratos?.clientes?.nombre}</span>
                  <span>🎵 {claseEditando.contratos?.instrumentos?.nombre}</span>
                  <span>🏫 {claseEditando.salones?.nombre}</span>
                  <span>⏰ {claseEditando.hora?.substring(0,5)} · {claseEditando.duracion_min}min</span>
                  {claseEditando.modalidad && <span style={{ textTransform: 'capitalize' }}>📱 {claseEditando.modalidad}</span>}
                </div>
              ) : (
                <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#333' }}>
                  <div><strong>Cliente:</strong> {claseEditando.contratos?.clientes?.nombre}</div>
                  <div><strong>Instrumento:</strong> {claseEditando.contratos?.instrumentos?.nombre}</div>
                  <div><strong>Plan:</strong> {claseEditando.contratos?.clases_tomadas}/{claseEditando.contratos?.total_clases} clases</div>
                  <div><strong>Sede del plan:</strong> {sedes.find(s => s.id === claseEditando.contratos?.sede_id)?.nombre || '—'}</div>
                  {claseEditando.modalidad && <div><strong>Modalidad:</strong> <span style={{ textTransform: 'capitalize' }}>{claseEditando.modalidad}</span></div>}
                  {claseEditando.contratos?.sede_id && claseEditando.salones?.sede_id && claseEditando.contratos.sede_id !== claseEditando.salones.sede_id && (
                    <div style={{ marginTop: '8px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '8px 10px', color: '#c2410c', fontWeight: '600', fontSize: '12px' }}>
                      ⚠️ El salón pertenece a <strong>{sedes.find(s => s.id === claseEditando.salones?.sede_id)?.nombre || 'otra sede'}</strong>, pero el plan es de <strong>{sedes.find(s => s.id === claseEditando.contratos?.sede_id)?.nombre || 'otra sede'}</strong>
                    </div>
                  )}
                  {claseEditando.recurrente && <div style={{ marginTop: '6px', color: TEAL, fontWeight: '600', fontSize: '12px' }}>🔁 Clase recurrente</div>}
                  {esBloqueada(claseEditando) && <div style={{ marginTop: '6px', color: '#854d0e', fontWeight: '600', fontSize: '12px' }}>🔒 No se puede editar — solo borrar si es necesario</div>}
                </div>
              )}

              {!esBloqueada(claseEditando) && !(claseEditando.estado === 'cancelada' && !claseEditando.cancelado_por_academia) && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={labelStyle}>Estado</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {claseEditando.estado === 'cancelada' ? (
                        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#c2410c', fontWeight: '600' }}>
                          ⚠️ Clase cancelada — solo puede borrarse
                        </div>
                      ) : (
                        ['programada', 'confirmada', 'dada', 'cancelada'].map(est => {
                          const col2 = getColorEstado(est)
                          return (
                            <button key={est} onClick={() => {
                              if (est === 'confirmada' && editEstado !== 'confirmada') {
                                const tomadas = claseEditando.contratos?.clases_tomadas ?? 0
                                const total = claseEditando.contratos?.total_clases ?? 0
                                if (total > 0 && tomadas >= total) { setPlanCompleto(true); setConfirmarDada(false) }
                                else { setEditEstado('confirmada'); setPlanCompleto(false) }
                              } else if (est === 'dada' && editEstado !== 'dada') {
                                if (editEstado !== 'confirmada') { setEditError('La clase debe estar Confirmada antes de marcarla como Dada'); return }
                                setConfirmarDada(true); setPlanCompleto(false)
                              } else {
                                setEditEstado(est); setConfirmarDada(false); setPlanCompleto(false)
                              }
                            }} style={{
                              padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                              border: `1px solid ${editEstado === est ? col2.color : '#e2e8f0'}`,
                              background: editEstado === est ? col2.bg : 'white',
                              color: editEstado === est ? col2.color : '#666'
                            }}>{est.charAt(0).toUpperCase() + est.slice(1)}</button>
                          )
                        })
                      )}
                    </div>

                    {planCompleto && (
                      <div style={{ marginTop: '10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#991b1b', fontWeight: '700' }}>
                          🚫 El plan está completo ({claseEditando.contratos?.clases_tomadas}/{claseEditando.contratos?.total_clases} clases)
                        </p>
                        <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#666' }}>Renueva el plan del cliente para continuar.</p>
                        <button onClick={() => setPlanCompleto(false)} style={{ padding: '6px 14px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Entendido</button>
                      </div>
                    )}

                    {confirmarDada && (
                      <div style={{ marginTop: '10px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: '10px', padding: '12px 14px' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#854d0e', fontWeight: '600' }}>⚠️ Una vez marcada como "Dada" no se podrá editar.</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => { setEditEstado('dada'); setConfirmarDada(false) }} style={{ flex: 1, padding: '7px', background: '#854d0e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Sí, marcar como dada</button>
                          <button onClick={() => setConfirmarDada(false)} style={{ padding: '7px 14px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                        </div>
                      </div>
                    )}
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
                </>
              )}

              {/* ── FIX 3: Inasistencia — info solo, sin panel de resolución manual ── */}
              {claseEditando.estado === 'cancelada' && !claseEditando.cancelado_por_academia && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#c2410c' }}>
                    ⚠️ Inasistencia registrada — suma al plan del cliente
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#92400e' }}>
                    Si se quiere perdonar: abrir la siguiente clase dada del cliente y marcarla como cortesía.
                  </p>
                </div>
              )}

              {editError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{editError}</p>}

              {!esBloqueada(claseEditando) && claseEditando.estado !== 'cancelada' && (
                claseEditando.recurrente && claseEditando.patron_id && hayEdicionReal ? (
                  <>
                    <p style={{ fontSize: '13px', color: '#555', marginBottom: '8px', fontWeight: '500' }}>¿A qué clases aplica el cambio?</p>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <button onClick={() => guardarEdicion('esta')} disabled={editGuardando} style={{ flex: 1, padding: '10px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                        {editGuardando ? '...' : 'Solo esta clase'}
                      </button>
                      <button onClick={() => guardarEdicion('futuras')} disabled={editGuardando} style={{ flex: 1, padding: '10px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                        {editGuardando ? '...' : 'Esta y las siguientes'}
                      </button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => guardarEdicion('esta')} disabled={editGuardando} style={{ width: '100%', padding: '11px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500', marginBottom: '10px' }}>
                    {editGuardando ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                )
              )}

              {!confirmarBorrar ? (
                <button onClick={() => setConfirmarBorrar(true)} style={{ width: '100%', padding: '10px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Borrar clase</button>
              ) : (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#991b1b', fontWeight: '700' }}>¿Confirmar eliminación?</p>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#666' }}>
                    {claseEditando.estado === 'dada'
                      ? `⚠️ Esta clase ya fue dada. El contador del plan se ajustará.`
                      : claseEditando.recurrente && claseEditando.patron_id
                        ? 'Esta clase es parte de una serie recurrente.'
                        : `${claseEditando.contratos?.clientes?.nombre} · ${claseEditando.fecha} · ${claseEditando.hora?.substring(0, 5)}`}
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {!esBloqueada(claseEditando) && !(claseEditando.estado === 'cancelada' && !claseEditando.cancelado_por_academia) && claseEditando.recurrente && claseEditando.patron_id ? (
                      <>
                        <button onClick={() => borrarClase('esta')} disabled={editGuardando} style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Borrar solo esta</button>
                        <button onClick={() => borrarClase('futuras')} disabled={editGuardando} style={{ flex: 1, padding: '8px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Borrar esta y siguientes</button>
                      </>
                    ) : (
                      <button onClick={() => borrarClase('esta')} disabled={editGuardando} style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                        {editGuardando ? 'Borrando...' : 'Sí, borrar clase'}
                      </button>
                    )}
                    <button onClick={() => setConfirmarBorrar(false)} style={{ padding: '8px 14px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                  </div>
                </div>
              )}

              {esBloqueada(claseEditando) && !confirmarBorrar && (
                <button onClick={() => setModalEditar(false)} style={{ width: '100%', padding: '11px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', marginTop: '10px' }}>Cerrar</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
