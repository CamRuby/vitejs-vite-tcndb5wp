import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { calcularNumeracion } from '../utils/numeracionClases'

const TEAL = '#1a8a8a'     
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

function fechaLocalVP(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fechaHoyLocalVP(): string { return fechaLocalVP(new Date()) }
const DIAS_SEMANA_VP: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 }
const SELECT_CLASES_VP = [
  'id', 'fecha', 'hora', 'duracion_min', 'estado', 'modalidad', 'cancelado_por_academia',
  'cancelado_tarde', 'es_cortesia', 'inasistencia_perdonada',
  'observaciones', 'contrato_id', 'honorario_valor', 'motivo_cancelacion',
  'contratos(clientes(nombre), instrumentos(nombre), duracion_min, clases_tomadas, total_clases, conteo_whatsapp)',
  'salones(nombre, sedes(nombre))'
].join(', ')
const PURPLE = '#7c3aed'
const PURPLE_LIGHT = '#f3e8ff'
const PURPLE_MID = '#d8b4fe'

interface Cliente {
  id: string
  nombre: string
  grupo_whatsapp: string | null
  sede_nombre: string
  sede_id: string | null
}

interface Plan {
  id: string
  cliente_id: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  duracion_min: number
  total_clases: number
  clases_tomadas: number
  valor_plan: number | null
  total_pagado: number
  instrumento_nombre: string
  profesor_nombre: string
  sede_nombre: string
  instrumento_id?: string
  profesor_id?: string
  sede_id?: string
}

interface Clase {
  id: string
  fecha: string
  hora: string
  duracion_min: number
  estado: string
  cancelado_por_academia: boolean | null
  cancelado_tarde: boolean | null
  es_cortesia: boolean
  inasistencia_perdonada: boolean
  honorario_valor: number | null
  numero_calculado: number | null
  total_clases: number
  profesor_nombre: string
  profesor_id: string
  contrato_id: string
  contrato_estado: string
  cliente_id: string
  numero_proyectado?: number | null
}

interface Taller {
  id: string
  inscripcion_id: string
  nombre: string
  sede_nombre: string
  valor_plan: number
  num_sesiones: number
  valor_sesion: number
  fecha_inicio: string
  fecha_fin: string
  estado: string
  taller_id: string
}

interface SesionTaller {
  id: string
  fecha: string
  hora: string
  sede_nombre: string
  profesor_nombre: string
  profesor_id: string
  valor: number
  taller_nombre: string
  taller_id: string
  inscripcion_id: string
}

interface Instrumento {
  id: string
  nombre: string
}

function etiquetaEstado(c: Clase): string {
  if (c.es_cortesia && c.estado === 'cancelada' && !c.cancelado_por_academia && c.cancelado_tarde) return 'Inasistencia perdonada'
  if (c.es_cortesia) return 'Cortesía'
  if (c.estado === 'dada') return 'Dada'
  if (c.estado === 'confirmada') return 'Confirmada'
  if (c.estado === 'programada') return 'Programada'
  if (c.estado === 'cancelada' && !c.cancelado_por_academia) return 'Inasistencia'
  if (c.estado === 'cancelada') return 'Cancelada'
  return c.estado
}

function colorEstado(c: Clase) {
  if (c.es_cortesia && c.estado === 'cancelada' && !c.cancelado_por_academia && c.cancelado_tarde) return { bg: PURPLE_LIGHT, color: PURPLE }
  if (c.es_cortesia) return { bg: '#e0f2fe', color: '#0369a1' }
  if (c.estado === 'dada') return { bg: '#fefce8', color: '#854d0e' }
  if (c.estado === 'confirmada') return { bg: '#dcfce7', color: '#166534' }
  if (c.estado === 'programada') return { bg: '#eff6ff', color: '#1d4ed8' }
  if (c.estado === 'cancelada' && !c.cancelado_por_academia) return { bg: '#fff7ed', color: '#c2410c' }
  return { bg: '#fee2e2', color: '#991b1b' }
}

function semanaVigente(): { lunes: string; sabado: string } {
  const hoy = new Date()
  const dia = hoy.getDay()
  const lunesDiff = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(hoy)
  lunes.setDate(hoy.getDate() + lunesDiff)
  const sabado = new Date(lunes)
  sabado.setDate(lunes.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { lunes: fmt(lunes), sabado: fmt(sabado) }
}

export default function AdminApp() {
  const [sesion, setSesion] = useState<any>(null)
  const [rolVerificado, setRolVerificado] = useState<'cargando' | 'ok' | 'denegado'>('cargando')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginCargando, setLoginCargando] = useState(false)

  const [vistaActual, setVistaActual] = useState<'clientes' | 'reportes' | 'vistaprofesor'>('clientes')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [profesores, setProfesores] = useState<{ id: string; nombre: string }[]>([])
  const [vpProfesorId, setVpProfesorId] = useState('')
  const [vpClases, setVpClases] = useState<any[]>([])
  const [vpCargando, setVpCargando] = useState(false)
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [cargando, setCargando] = useState(false)

  const [filtroVista, setFiltroVista] = useState<'todos' | 'activos'>('activos')
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroProfesor, setFiltroProfesor] = useState('')
  const [clientesConProfesor, setClientesConProfesor] = useState<Set<string> | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null)
  const [planesCliente, setPlanesCliente] = useState<Record<string, Plan[]>>({})
  const [planExpandido, setPlanExpandido] = useState<string | null>(null)
  const [clasesPlan, setClasesPlan] = useState<Record<string, Clase[]>>({})

  const [talleresCliente, setTalleresCliente] = useState<Record<string, Taller[]>>({})
  const [tallerExpandido, setTallerExpandido] = useState<string | null>(null)
  const [sesionesTaller, setSesionesTaller] = useState<Record<string, SesionTaller[]>>({})

  const [editandoClase, setEditandoClase] = useState<Clase | null>(null)
  const [editandoPlan, setEditandoPlan] = useState<Plan | null>(null)
  const [editandoSesion, setEditandoSesion] = useState<SesionTaller | null>(null)
  const [confirmarCambio, setConfirmarCambio] = useState<{ mensaje: string; accion: () => Promise<void> } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [mensajeOk, setMensajeOk] = useState('')

  const [editFecha, setEditFecha] = useState('')
  const [editHora, setEditHora] = useState('')
  const [editProfesorId, setEditProfesorId] = useState('')
  const [editEstado, setEditEstado] = useState('')
  const [editHonorario, setEditHonorario] = useState('')
  const [editDuracion, setEditDuracion] = useState('')

  const [editSesionFecha, setEditSesionFecha] = useState('')
  const [editSesionHora, setEditSesionHora] = useState('')
  const [editSesionProfesorId, setEditSesionProfesorId] = useState('')
  const [editSesionValor, setEditSesionValor] = useState('')
  const [editSesionSedeNombre, setEditSesionSedeNombre] = useState('')

  const [editPlanEstado, setEditPlanEstado] = useState('')
  const [editPlanFechaFin, setEditPlanFechaFin] = useState('')
  const [editPlanFechaInicio, setEditPlanFechaInicio] = useState('')
  const [editPlanDuracion, setEditPlanDuracion] = useState('')
  const [editPlanTotalClases, setEditPlanTotalClases] = useState('')
  const [editPlanValorPagado, setEditPlanValorPagado] = useState('')
  const [editPlanValorPlan, setEditPlanValorPlan] = useState('')
  const [editPlanInstrumentoId, setEditPlanInstrumentoId] = useState('')
  const [editPlanProfesorId, setEditPlanProfesorId] = useState('')
  const [editPlanSedeId, setEditPlanSedeId] = useState('')

  // Nuevo plan
  const [creandoPlan, setCreandoPlan] = useState<string | null>(null) // clienteId
  const [nuevoPlanInstrumentoId, setNuevoPlanInstrumentoId] = useState('')
  const [nuevoPlanProfesorId, setNuevoPlanProfesorId] = useState('')
  const [nuevoPlanSedeId, setNuevoPlanSedeId] = useState('')
  const [nuevoPlanTotalClases, setNuevoPlanTotalClases] = useState('4')
  const [nuevoPlanDuracion, setNuevoPlanDuracion] = useState('60')
  const [nuevoPlanValor, setNuevoPlanValor] = useState('')
  const [nuevoPlanFechaInicio, setNuevoPlanFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [nuevoPlanError, setNuevoPlanError] = useState('')

  // Nueva clase dada
  const [creandoClase, setCreandoClase] = useState<{ planId: string; clienteId: string } | null>(null)
  const [nuevaClaseFecha, setNuevaClaseFecha] = useState(new Date().toISOString().split('T')[0])
  const [nuevaClaseHora, setNuevaClaseHora] = useState('09:00')
  const [nuevaClaseProfesorId, setNuevaClaseProfesorId] = useState('')
  const [nuevaClaseHonorario, setNuevaClaseHonorario] = useState('')
  const [nuevaClaseDuracion, setNuevaClaseDuracion] = useState('60')
  const [nuevaClaseError, setNuevaClaseError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setRolVerificado('denegado'); return }
      setSesion(session)
      const { data } = await supabase.from('roles').select('rol').eq('email', session.user.email).single()
      if (data?.rol === 'superadmin') { setRolVerificado('ok'); cargarBase() }
      else setRolVerificado('denegado')
    })
  }, [])

  async function login() {
    if (!loginEmail || !loginPass) { setLoginError('Ingresa correo y contraseña'); return }
    setLoginCargando(true); setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim().toLowerCase(), password: loginPass })
    if (error) { setLoginError('Correo o contraseña incorrectos'); setLoginCargando(false); return }
    const { data: rolData } = await supabase.from('roles').select('rol').eq('email', data.user.email).single()
    if (rolData?.rol !== 'superadmin') { setLoginError('No tienes acceso a este panel'); await supabase.auth.signOut(); setLoginCargando(false); return }
    setSesion(data.session); setRolVerificado('ok'); setLoginCargando(false); cargarBase()
  }

  async function cargarBase() {
    const [{ data: sedesData }, { data: profsData }, { data: instData }] = await Promise.all([
      supabase.from('sedes').select('id, nombre').order('nombre'),
      supabase.from('profesores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('instrumentos').select('id, nombre').order('nombre'),
    ])
    setSedes(sedesData || [])
    setProfesores(profsData || [])
    setInstrumentos(instData || [])
    cargarClientes()
  }

  async function cargarClientes() {
    setCargando(true)
    const { data: contratos } = await supabase
      .from('contratos')
      .select('cliente_id, sede_id, estado, updated_at, sedes(nombre)')
      .order('updated_at', { ascending: false })
    const { data: clientesData } = await supabase
      .from('clientes').select('id, nombre, grupo_whatsapp')
      .eq('estado', 'activo').order('nombre')
    if (!clientesData) { setCargando(false); return }
    const contratosPorCliente: Record<string, any> = {}
    ;(contratos || []).forEach((ct: any) => {
      if (!contratosPorCliente[ct.cliente_id]) {
        contratosPorCliente[ct.cliente_id] = ct
      } else {
        const actual = contratosPorCliente[ct.cliente_id]
        if (ct.estado === 'activo' && actual.estado !== 'activo') contratosPorCliente[ct.cliente_id] = ct
      }
    })
    const lista: Cliente[] = clientesData.map((c: any) => ({
      id: c.id, nombre: c.nombre, grupo_whatsapp: c.grupo_whatsapp,
      sede_nombre: contratosPorCliente[c.id]?.sedes?.nombre || '—',
      sede_id: contratosPorCliente[c.id]?.sede_id || null,
    }))
    setClientes(lista); setCargando(false)
  }

  async function cargarPlanes(clienteId: string) {
    const { data } = await supabase.from('contratos')
      .select(`id, estado, fecha_inicio, fecha_fin, duracion_min, total_clases, clases_tomadas, valor_plan,
        instrumentos(id, nombre), profesores(id, nombre), sedes(id, nombre), cliente_id`)
      .eq('cliente_id', clienteId).order('fecha_inicio', { ascending: false })
    const ids = (data || []).map((p: any) => p.id)
    let pagosMap: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: pagos } = await supabase.from('pagos').select('contrato_id, monto').in('contrato_id', ids)
      ;(pagos || []).forEach((p: any) => { pagosMap[p.contrato_id] = (pagosMap[p.contrato_id] || 0) + Number(p.monto) })
    }
    const planes: Plan[] = (data || []).map((p: any) => ({
      id: p.id, cliente_id: p.cliente_id, estado: p.estado,
      fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin,
      duracion_min: p.duracion_min, total_clases: p.total_clases,
      clases_tomadas: p.clases_tomadas, valor_plan: p.valor_plan,
      total_pagado: pagosMap[p.id] || 0,
      instrumento_nombre: p.instrumentos?.nombre || '—',
      profesor_nombre: p.profesores?.nombre || '—',
      sede_nombre: p.sedes?.nombre || '—',
      instrumento_id: p.instrumentos?.id || '',
      profesor_id: p.profesores?.id || '',
      sede_id: p.sedes?.id || '',
    }))
    setPlanesCliente(prev => ({ ...prev, [clienteId]: planes }))
  }

  async function cargarTalleresCliente(clienteId: string) {
    const { data } = await supabase.from('taller_inscripciones')
      .select(`id, estado, fecha_inicio, fecha_fin, num_sesiones, valor_plan, valor_pagado,
        taller_id, talleres(id, nombre, salones(nombre, sedes(nombre)))`)
      .eq('cliente_id', clienteId)
      .neq('estado', 'archivado')
      .order('fecha_inicio', { ascending: false })
    const talleres: Taller[] = (data || []).map((ins: any) => ({
      id: ins.id,
      inscripcion_id: ins.id,
      nombre: ins.talleres?.nombre || '—',
      sede_nombre: ins.talleres?.salones?.sedes?.nombre || '—',
      valor_plan: ins.valor_plan || 0,
      num_sesiones: ins.num_sesiones || 1,
      valor_sesion: ins.num_sesiones > 0 ? Math.round((ins.valor_plan || 0) / ins.num_sesiones) : 0,
      fecha_inicio: ins.fecha_inicio || '',
      fecha_fin: ins.fecha_fin || '',
      estado: ins.estado,
      taller_id: ins.taller_id,
    }))
    setTalleresCliente(prev => ({ ...prev, [clienteId]: talleres }))
  }

  async function cargarSesionesTaller(inscripcionId: string, tallerId: string) {
    const inscripcion = Object.values(talleresCliente).flat().find(t => t.inscripcion_id === inscripcionId)
    const { data: sesiones } = await supabase.from('taller_sesiones')
      .select(`id, fecha, estado, honorario_valor,
        talleres(nombre, hora, duracion_min, profesores(id, nombre), salones(nombre, sedes(nombre)))`)
      .eq('taller_id', tallerId)
      .eq('estado', 'dada')
      .gte('fecha', inscripcion?.fecha_inicio || '2000-01-01')
      .lte('fecha', inscripcion?.fecha_fin || '2099-12-31')
      .order('fecha', { ascending: false })
    const valorSesion = inscripcion?.valor_sesion || 0
    const lista: SesionTaller[] = (sesiones || []).map((s: any) => ({
      id: s.id,
      fecha: s.fecha,
      hora: s.talleres?.hora?.substring(0, 5) || '—',
      sede_nombre: s.talleres?.salones?.sedes?.nombre || '—',
      profesor_nombre: s.talleres?.profesores?.nombre || '—',
      profesor_id: s.talleres?.profesores?.id || '',
      valor: s.honorario_valor ?? valorSesion,
      taller_nombre: s.talleres?.nombre || '—',
      taller_id: tallerId,
      inscripcion_id: inscripcionId,
    }))
    setSesionesTaller(prev => ({ ...prev, [inscripcionId]: lista }))
  }

  async function cargarClases(planId: string, clienteId: string) {
    const { data } = await supabase.from('clases')
      .select(`id, fecha, hora, duracion_min, estado, cancelado_por_academia, cancelado_tarde,
        honorario_valor, contrato_id, es_cortesia, inasistencia_perdonada,
        contratos(id, estado, cliente_id, total_clases), profesores(id, nombre)`)
      .eq('contrato_id', planId)
      .order('fecha', { ascending: false }).order('hora', { ascending: false })
    const { lunes, sabado } = semanaVigente()
    const clases: Clase[] = (data || [])
      .map((c: any) => ({
        id: c.id, fecha: c.fecha, hora: c.hora?.substring(0, 5) || '—',
        duracion_min: c.duracion_min, estado: c.estado,
        cancelado_por_academia: c.cancelado_por_academia,
        cancelado_tarde: c.cancelado_tarde,
        es_cortesia: c.es_cortesia || false,
        inasistencia_perdonada: c.inasistencia_perdonada || false,
        honorario_valor: c.honorario_valor !== null ? Number(c.honorario_valor) : null,
        numero_calculado: null,
        total_clases: c.contratos?.total_clases || 0,
        profesor_nombre: c.profesores?.nombre || '—',
        profesor_id: c.profesores?.id || '',
        contrato_id: planId,
        contrato_estado: c.contratos?.estado || '—',
        cliente_id: clienteId,
      }))
      .filter((c: Clase) => c.estado !== 'programada' || (c.fecha >= lunes && c.fecha <= sabado))
      const { data: planData } = await supabase.from('contratos').select('duracion_min').eq('id', planId).single()
      const numeracion = calcularNumeracion(clases, planData?.duracion_min || 60)
        clases.forEach(c => { c.numero_calculado = numeracion.get(c.id) ?? null })
        const maxNumeracion = numeracion.size > 0 ? Math.max(...numeracion.values()) : 0
        const durPlan = planData?.duracion_min || 60
        const clasesOrdenadas = [...clases].sort((a, b) =>
          (a.fecha + a.hora).localeCompare(b.fecha + b.hora)
        )
        let conteoProyectado = maxNumeracion
        clasesOrdenadas.forEach(c => {
          if (c.estado === 'confirmada') {
            const fraccion = parseFloat(((c.duracion_min || durPlan) / durPlan).toFixed(4))
            conteoProyectado = parseFloat((conteoProyectado + fraccion).toFixed(4))
            c.numero_proyectado = conteoProyectado
          }
        })
      setClasesPlan(prev => ({ ...prev, [planId]: clases }))
      setPlanesCliente(prev => {
        const planes = prev[clienteId] || []
        return {
    ...prev,
    [clienteId]: planes.map(p => p.id === planId ? { ...p, _conteo: maxNumeracion } : p)
  }
})
  }

  const clientesFiltrados = clientes
    .filter(c => {
      if (busqueda && !c.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      if (filtroSede && c.sede_id !== filtroSede) return false
      return true
    })
    .filter(c => {
      if (filtroVista === 'activos') {
        const planes = planesCliente[c.id]
        if (!planes) return true
        return planes.some(p => p.estado === 'activo' || p.estado === 'completado')
      }
      return true
    })
    .filter(c => {
      if (!filtroProfesor) return true
      if (!clientesConProfesor) return false
      return clientesConProfesor.has(c.id)
    })

  async function cargarVistaProfesor(profesorId: string) {
    if (!profesorId) return
    setVpCargando(true)
    const hoy = new Date()
    const diaSemana = hoy.getDay()
    const diasHastaSabado = diaSemana === 6 ? 7 : 6 - diaSemana
    const sabado = new Date(hoy); sabado.setDate(hoy.getDate() + diasHastaSabado)
    const fi = fechaHoyLocalVP()
    const ff = fechaLocalVP(sabado)
    const { data } = await supabase.from('clases').select(SELECT_CLASES_VP)
      .eq('profesor_id', profesorId)
      .gte('fecha', fi).lte('fecha', ff)
      .in('estado', ['programada', 'confirmada'])
      .order('fecha').order('hora')
    const [{ data: dataAtrasadas }, { data: talleresData }] = await Promise.all([
      supabase.from('clases').select(SELECT_CLASES_VP)
        .eq('profesor_id', profesorId).eq('estado', 'confirmada').lt('fecha', fi)
        .order('fecha').order('hora'),
      supabase.from('talleres')
        .select('id, nombre, dia_semana, hora, duracion_min, fecha_unica, fecha_fin_vacacional, salones(nombre, sedes(nombre))')
        .eq('profesor_id', profesorId)
    ])
    const ids = (talleresData || []).map((t: any) => t.id)
    let talleresConfirmados: any[] = []
    const talleresAtrasados: any[] = []
    if (ids.length > 0) {
      const { data: sesiones } = await supabase.from('taller_sesiones')
        .select('taller_id, fecha, estado')
        .in('taller_id', ids)
      const sesionMap: Record<string, string> = {}
      ;(sesiones || []).forEach((s: any) => { sesionMap[`${s.taller_id}-${s.fecha}`] = s.estado })
      talleresConfirmados = (talleresData || []).map((t: any) => ({ ...t, _sesionMap: sesionMap }))

      const { data: sesAtrasadas } = await supabase
        .from('taller_sesiones')
        .select('id, fecha, estado, taller_id')
        .in('taller_id', ids)
        .eq('estado', 'confirmada')
        .lt('fecha', fi)
        .order('fecha').order('taller_id')
      ;(sesAtrasadas || []).forEach((s: any) => {
        const t = (talleresData || []).find((x: any) => x.id === s.taller_id)
        if (!t) return
        talleresAtrasados.push({
          id: `taller-${t.id}-${s.fecha}`,
          fecha: s.fecha, hora: t.hora, duracion_min: t.duracion_min,
          estado: 'confirmada', esTaller: true, nombreTaller: t.nombre,
          salones: t.salones, contratos: null, esAtrasada: true,
        })
      })
    }
    const clasesFinales = [
      ...talleresAtrasados,
      ...(dataAtrasadas || []).map((c: any) => ({ ...c, esAtrasada: true })),
      ...(data || [])
    ]
    for (let offset = 0; offset <= diasHastaSabado; offset++) {
      const dia = new Date(hoy); dia.setDate(hoy.getDate() + offset)
      const fechaStr = fechaLocalVP(dia)
      talleresConfirmados.forEach((t: any) => {
        const matchFecha = t.fecha_fin_vacacional
          ? fechaStr >= t.fecha_unica && fechaStr <= t.fecha_fin_vacacional && ![0, 6].includes(new Date(fechaStr + 'T12:00:00').getDay())
          : t.fecha_unica ? t.fecha_unica === fechaStr
          : DIAS_SEMANA_VP[t.dia_semana] === dia.getDay()
        if (matchFecha) {
          const sesionEstadoHoy = t._sesionMap?.[`${t.id}-${fechaStr}`] || null
          const estadoTaller = sesionEstadoHoy || 'programada'
          if (estadoTaller === 'dada') { /* skip, ya se dio */ } else
            clasesFinales.push({
              id: `taller-${t.id}-${fechaStr}`,
              fecha: fechaStr, hora: t.hora, duracion_min: t.duracion_min,
              estado: estadoTaller, esTaller: true, nombreTaller: t.nombre,
              salones: t.salones, contratos: null,
            })
        }
      })
    }
    clasesFinales.sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
    setVpClases(clasesFinales)
    setVpCargando(false)
  }

  function abrirEditarPlan(plan: Plan) {
    setEditandoPlan(plan)
    setEditPlanEstado(plan.estado)
    setEditPlanFechaFin(plan.fecha_fin || '')
    setEditPlanFechaInicio(plan.fecha_inicio || '')
    setEditPlanDuracion(String(plan.duracion_min))
    setEditPlanTotalClases(String(plan.total_clases))
    setEditPlanValorPagado(String(plan.total_pagado))
    setEditPlanValorPlan(plan.valor_plan ? String(plan.valor_plan) : '')
    setEditPlanInstrumentoId(plan.instrumento_id || '')
    setEditPlanProfesorId(plan.profesor_id || '')
    setEditPlanSedeId(plan.sede_id || '')
  }

  async function guardarPlan() {
    if (!editandoPlan) return
    const planNombre = `${editandoPlan.instrumento_nombre} (${editandoPlan.sede_nombre})`
    setConfirmarCambio({
      mensaje: `¿Confirmar cambios en el plan ${planNombre}?`,
      accion: async () => {
        const payload: any = {
          estado: editPlanEstado,
          duracion_min: parseInt(editPlanDuracion),
          total_clases: parseInt(editPlanTotalClases),
          instrumento_id: editPlanInstrumentoId || null,
          profesor_id: editPlanProfesorId || null,
          sede_id: editPlanSedeId || null,
          valor_plan: editPlanValorPlan !== '' ? Number(editPlanValorPlan) : null,
        }
        if (editPlanFechaFin) payload.fecha_fin = editPlanFechaFin
        if (editPlanFechaInicio) payload.fecha_inicio = editPlanFechaInicio
        await supabase.from('contratos').update(payload).eq('id', editandoPlan.id)
        const diferencia = Number(editPlanValorPagado) - editandoPlan.total_pagado
        if (diferencia > 0) await supabase.from('pagos').insert({ contrato_id: editandoPlan.id, monto: diferencia, fecha: new Date().toISOString().split('T')[0], metodo: 'Ajuste manual' })
        setEditandoPlan(null)
        await cargarPlanes(editandoPlan.cliente_id)
        setMensajeOk('Plan actualizado correctamente')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  async function borrarPlanVacio(plan: Plan) {
    setConfirmarCambio({
      mensaje: `¿Borrar el plan de ${plan.instrumento_nombre} (${plan.sede_nombre})? Solo se puede borrar si no tiene clases dadas.`,
      accion: async () => {
        await supabase.from('pagos').delete().eq('contrato_id', plan.id)
        await supabase.from('clases').delete().eq('contrato_id', plan.id)
        await supabase.from('contratos').delete().eq('id', plan.id)
        setEditandoPlan(null)
        await cargarPlanes(plan.cliente_id)
        setMensajeOk('Plan eliminado')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  async function crearPlan() {
    if (!creandoPlan) return
    if (!nuevoPlanInstrumentoId) { setNuevoPlanError('Selecciona un instrumento'); return }
    if (!nuevoPlanProfesorId) { setNuevoPlanError('Selecciona un profesor'); return }
    if (!nuevoPlanSedeId) { setNuevoPlanError('Selecciona una sede'); return }
    setNuevoPlanError('')
    setGuardando(true)
    const { data: nuevoPlan, error } = await supabase.from('contratos').insert({
      cliente_id: creandoPlan,
      instrumento_id: nuevoPlanInstrumentoId,
      profesor_id: nuevoPlanProfesorId,
      sede_id: nuevoPlanSedeId,
      total_clases: parseInt(nuevoPlanTotalClases),
      duracion_min: parseInt(nuevoPlanDuracion),
      valor_plan: nuevoPlanValor !== '' ? Number(nuevoPlanValor) : null,
      fecha_inicio: nuevoPlanFechaInicio,
      estado: 'activo',
      clases_tomadas: 0,
    }).select().single()
    if (error) { setNuevoPlanError('Error: ' + error.message); setGuardando(false); return }
    if (nuevoPlan) {
      const hoy = new Date().toISOString().split('T')[0]
      // Heredar clases futuras programadas/confirmadas de otros planes del mismo cliente
      const { data: contratosCliente } = await supabase.from('contratos').select('id')
        .eq('cliente_id', creandoPlan).neq('id', nuevoPlan.id)
      const idsContratos = (contratosCliente || []).map((c: any) => c.id)
      if (idsContratos.length > 0) {
        await supabase.from('clases').update({ contrato_id: nuevoPlan.id, duracion_min: parseInt(nuevoPlanDuracion) })
          .in('contrato_id', idsContratos)
          .in('estado', ['programada', 'confirmada'])
          .gte('fecha', hoy)
      }
      // Archivar automáticamente los planes completados de este cliente
      await supabase.from('contratos').update({ estado: 'archivado' })
        .eq('cliente_id', creandoPlan).eq('estado', 'completado').neq('id', nuevoPlan.id)
    }
    setCreandoPlan(null)
    await cargarPlanes(creandoPlan)
    setMensajeOk('Plan creado correctamente')
    setTimeout(() => setMensajeOk(''), 3000)
    setGuardando(false)
  }

  async function crearClaseDada() {
    if (!creandoClase) return
    if (!nuevaClaseProfesorId) { setNuevaClaseError('Selecciona un profesor'); return }
    setNuevaClaseError('')
    setGuardando(true)
    const durMin = parseInt(nuevaClaseDuracion)
    const { data: planData } = await supabase.from('contratos').select('duracion_min, clases_tomadas, total_clases').eq('id', creandoClase.planId).single()
    const durPlan = planData?.duracion_min || durMin
    const fraccion = parseFloat((durMin / durPlan).toFixed(4))
    const tomadas = parseFloat(Number(planData?.clases_tomadas || 0).toFixed(4))
    const nuevasTomadas = parseFloat((tomadas + fraccion).toFixed(4))
    const { error } = await supabase.from('clases').insert({
      contrato_id: creandoClase.planId,
      profesor_id: nuevaClaseProfesorId,
      fecha: nuevaClaseFecha,
      hora: nuevaClaseHora + ':00',
      duracion_min: durMin,
      estado: 'dada',
      honorario_valor: nuevaClaseHonorario !== '' ? Number(nuevaClaseHonorario) : null,
      es_cortesia: false,
      cancelado_por_academia: null,
      cancelado_tarde: false,
    })
    if (error) { setNuevaClaseError('Error: ' + error.message); setGuardando(false); return }
    const totalClases = planData?.total_clases || 0
    const updateContrato: any = { clases_tomadas: nuevasTomadas }
    if (totalClases > 0 && nuevasTomadas >= totalClases) updateContrato.estado = 'completado'
    await supabase.from('contratos').update(updateContrato).eq('id', creandoClase.planId)
    setCreandoClase(null)
    await cargarClases(creandoClase.planId, creandoClase.clienteId)
    await cargarPlanes(creandoClase.clienteId)
    setMensajeOk('Clase agregada correctamente')
    setTimeout(() => setMensajeOk(''), 3000)
    setGuardando(false)
  }

  function abrirEditarClase(clase: Clase) {
    setEditandoClase(clase)
    setEditFecha(clase.fecha)
    setEditHora(clase.hora)
    setEditProfesorId(clase.profesor_id || '')
    const estadoEdicion =
      clase.es_cortesia && clase.cancelado_tarde ? 'inasistencia_perdonada' :
      clase.es_cortesia ? 'cortesia' :
      clase.estado === 'cancelada' && !clase.cancelado_por_academia ? 'inasistencia' :
      clase.estado
    setEditEstado(estadoEdicion)
    setEditHonorario(clase.honorario_valor !== null ? String(clase.honorario_valor) : '')
    setEditDuracion(String(clase.duracion_min || 60))
  }

  async function guardarClase() {
    if (!editandoClase) return
    const cambios: string[] = []
    if (editFecha !== editandoClase.fecha) cambios.push(`fecha a ${editFecha}`)
    if (editHora !== editandoClase.hora) cambios.push(`hora a ${editHora}`)
    const profNombre = profesores.find(p => p.id === editProfesorId)?.nombre
    if (editProfesorId !== editandoClase.profesor_id) cambios.push(`profesor a ${profNombre}`)
    const estadoOriginal =
      editandoClase.es_cortesia && editandoClase.cancelado_tarde ? 'inasistencia_perdonada' :
      editandoClase.es_cortesia ? 'cortesia' :
      editandoClase.estado === 'cancelada' && !editandoClase.cancelado_por_academia ? 'inasistencia' :
      editandoClase.estado
    if (editEstado !== estadoOriginal) cambios.push(`estado a ${editEstado}`)
    if (editHonorario !== (editandoClase.honorario_valor !== null ? String(editandoClase.honorario_valor) : '')) cambios.push(`honorario a $${Number(editHonorario).toLocaleString('es-CO')}`)
    const clienteNombre = clientes.find(c => c.id === editandoClase.cliente_id)?.nombre || '—'
    setConfirmarCambio({
      mensaje: `¿Está seguro de modificar ${cambios.join(', ')} de la clase de ${clienteNombre} del ${editandoClase.fecha}?`,
      accion: async () => {
        const payload: any = { fecha: editFecha, hora: editHora + ':00', profesor_id: editProfesorId, honorario_valor: editHonorario !== '' ? Number(editHonorario) : null, duracion_min: parseInt(editDuracion) }
        if (editEstado === 'inasistencia') {
          payload.estado = 'cancelada'; payload.cancelado_por_academia = false; payload.cancelado_tarde = true; payload.es_cortesia = false; payload.inasistencia_perdonada = false
        } else if (editEstado === 'inasistencia_perdonada') {
          payload.estado = 'cancelada'; payload.cancelado_por_academia = false; payload.cancelado_tarde = true; payload.es_cortesia = true; payload.inasistencia_perdonada = true
        } else if (editEstado === 'cortesia') {
          payload.estado = 'dada'; payload.es_cortesia = true; payload.cancelado_por_academia = null; payload.cancelado_tarde = false
        } else {
          payload.estado = editEstado; payload.es_cortesia = false
          if (editEstado !== 'cancelada') { payload.cancelado_por_academia = null; payload.cancelado_tarde = false }
        }
        await supabase.from('clases').update(payload).eq('id', editandoClase.id)
        setEditandoClase(null)
        await cargarClases(editandoClase.contrato_id, editandoClase.cliente_id)
        setMensajeOk('Clase actualizada correctamente')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  function abrirEditarSesion(sesion: SesionTaller) {
    setEditandoSesion(sesion)
    setEditSesionFecha(sesion.fecha)
    setEditSesionHora(sesion.hora)
    setEditSesionProfesorId(sesion.profesor_id)
    setEditSesionValor(String(sesion.valor))
    setEditSesionSedeNombre(sesion.sede_nombre)
  }

  async function guardarSesion() {
    if (!editandoSesion) return
    const cambios: string[] = []
    if (editSesionFecha !== editandoSesion.fecha) cambios.push(`fecha a ${editSesionFecha}`)
    if (editSesionHora !== editandoSesion.hora) cambios.push(`hora a ${editSesionHora}`)
    const profNombre = profesores.find(p => p.id === editSesionProfesorId)?.nombre
    if (editSesionProfesorId !== editandoSesion.profesor_id) cambios.push(`profesor a ${profNombre}`)
    if (editSesionValor !== String(editandoSesion.valor)) cambios.push(`valor a $${Number(editSesionValor).toLocaleString('es-CO')}`)
    setConfirmarCambio({
      mensaje: `¿Está seguro de modificar ${cambios.join(', ')} de la sesión del taller ${editandoSesion.taller_nombre} del ${editandoSesion.fecha}?`,
      accion: async () => {
        await supabase.from('taller_sesiones').update({
          fecha: editSesionFecha,
          honorario_valor: editSesionValor !== '' ? Number(editSesionValor) : null,
        }).eq('id', editandoSesion.id)
        if (editSesionProfesorId !== editandoSesion.profesor_id) {
          await supabase.from('taller_sesiones').update({ profesor_id: editSesionProfesorId }).eq('id', editandoSesion.id)
        }
        setEditandoSesion(null)
        await cargarSesionesTaller(editandoSesion.inscripcion_id, editandoSesion.taller_id)
        setMensajeOk('Sesión actualizada correctamente')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  async function borrarSesion(sesion: SesionTaller, clienteId: string) {
    setConfirmarCambio({
      mensaje: `¿Está seguro de BORRAR la sesión del ${sesion.fecha} del taller ${sesion.taller_nombre}? Esta acción no se puede deshacer.`,
      accion: async () => {
        await supabase.from('taller_asistencias').delete().eq('sesion_id', sesion.id)
        await supabase.from('taller_confirmaciones').delete().eq('sesion_id', sesion.id)
        await supabase.from('taller_sesiones').delete().eq('id', sesion.id)
        await cargarSesionesTaller(sesion.inscripcion_id, sesion.taller_id)
        setMensajeOk('Sesión eliminada')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  async function borrarInscripcionTaller(taller: Taller, clienteId: string) {
    setConfirmarCambio({
      mensaje: `¿Está seguro de BORRAR la inscripción al taller ${taller.nombre}? Se perderán los registros de sesiones y pagos.`,
      accion: async () => {
        const { data: sesiones } = await supabase.from('taller_sesiones').select('id').eq('taller_id', taller.taller_id)
        if (sesiones?.length) {
          const ids = sesiones.map((s: any) => s.id)
          await supabase.from('taller_asistencias').delete().in('sesion_id', ids)
          await supabase.from('taller_confirmaciones').delete().in('sesion_id', ids)
        }
        await supabase.from('pagos').delete().eq('inscripcion_id', taller.inscripcion_id)
        await supabase.from('taller_inscripciones').delete().eq('id', taller.inscripcion_id)
        await cargarTalleresCliente(clienteId)
        setMensajeOk('Inscripción eliminada')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  async function moverClase(clase: Clase, destino: 'activo' | 'archivado') {
    const clienteNombre = clientes.find(c => c.id === clase.cliente_id)?.nombre || '—'
    setConfirmarCambio({
      mensaje: `¿Mover la clase de ${clienteNombre} del ${clase.fecha} al plan ${destino}?`,
      accion: async () => {
        const { data: cts } = await supabase.from('contratos').select('id, clases_tomadas').eq('cliente_id', clase.cliente_id).eq('estado', destino).order('updated_at', { ascending: false }).limit(1)
        if (!cts?.length) { alert(`No hay plan ${destino} para este cliente`); return }
        const dest = cts[0]
        await supabase.from('clases').update({ contrato_id: dest.id }).eq('id', clase.id)
        const { data: origen } = await supabase.from('contratos').select('clases_tomadas').eq('id', clase.contrato_id).single()
        if (origen && clase.estado === 'dada' && !clase.es_cortesia) {
          await supabase.from('contratos').update({ clases_tomadas: Math.max(0, (origen.clases_tomadas || 0) - 1) }).eq('id', clase.contrato_id)
          await supabase.from('contratos').update({ clases_tomadas: (dest.clases_tomadas || 0) + 1 }).eq('id', dest.id)
        }
        await cargarClases(clase.contrato_id, clase.cliente_id)
        await cargarPlanes(clase.cliente_id)
        setMensajeOk('Clase movida correctamente')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  async function borrarClase(clase: Clase) {
    const clienteNombre = clientes.find(c => c.id === clase.cliente_id)?.nombre || '—'
    setConfirmarCambio({
      mensaje: `¿Está seguro de BORRAR la clase de ${clienteNombre} del ${clase.fecha}? Esta acción no se puede deshacer.`,
      accion: async () => {
        if (clase.estado === 'dada' && !clase.es_cortesia) {
          const { data: ct } = await supabase.from('contratos').select('clases_tomadas').eq('id', clase.contrato_id).single()
          if (ct) await supabase.from('contratos').update({ clases_tomadas: Math.max(0, (ct.clases_tomadas || 0) - 1) }).eq('id', clase.contrato_id)
        }
        await supabase.from('clases').delete().eq('id', clase.id)
        await cargarClases(clase.contrato_id, clase.cliente_id)
        await cargarPlanes(clase.cliente_id)
        setMensajeOk('Clase eliminada')
        setTimeout(() => setMensajeOk(''), 3000)
      }
    })
  }

  if (rolVerificado === 'cargando') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: TEAL }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (rolVerificado === 'denegado' && !sesion) return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(150deg,${TEAL} 0%,#0d5f5f 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ width: '100%', maxWidth: '360px', animation: 'fadeUp 0.4s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/apple-touch-icon.png" alt="Logo" style={{ width: '80px', height: '80px', borderRadius: '24px', margin: '0 auto 16px', display: 'block', background: 'white', padding: '6px', boxSizing: 'border-box' as const }} />
          <h1 style={{ margin: 0, color: 'white', fontSize: '26px', fontWeight: '800' }}>Academia Ruby</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '13px', letterSpacing: '0.5px' }}>PANEL ADMINISTRATIVO</p>
        </div>
        <div style={{ background: 'white', borderRadius: '20px', padding: '28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>CORREO</label>
            <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="correo@ejemplo.com" style={{ width: '100%', padding: '13px 14px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box' as const }} />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>CONTRASEÑA</label>
            <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()} placeholder="••••••••" style={{ width: '100%', padding: '13px 14px', border: '2px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box' as const }} />
          </div>
          {loginError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>{loginError}</div>}
          <button onClick={login} disabled={loginCargando} style={{ width: '100%', padding: '14px', background: loginCargando ? TEAL_MID : TEAL, color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}>
            {loginCargando ? 'Entrando...' : 'Entrar →'}
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>

      <div style={{ background: TEAL_DARK, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/Logo_RubySalamanca.png" alt="Logo" style={{ height: '28px', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>ADMIN</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Salir</button>
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {[{ key: 'clientes', label: '👥 Clientes' }, { key: 'reportes', label: '📊 Reportes' }, { key: 'vistaprofesor', label: '👁️ Ver como profesor' }].map(tab => (
            <button key={tab.key} onClick={() => setVistaActual(tab.key as any)}
              style={{ flex: 1, padding: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit', background: vistaActual === tab.key ? 'white' : 'transparent', color: vistaActual === tab.key ? TEAL_DARK : 'rgba(255,255,255,0.7)', borderRadius: vistaActual === tab.key ? '12px 12px 0 0' : '0' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {mensajeOk && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', margin: '12px 16px', padding: '12px 16px', borderRadius: '10px', color: '#166534', fontSize: '14px', fontWeight: '600', animation: 'fadeUp 0.3s ease' }}>
          ✓ {mensajeOk}
        </div>
      )}

      {vistaActual === 'reportes' && (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#374151', margin: '0 0 8px' }}>Reportes</p>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Próximamente — módulo de reportes en desarrollo.</p>
        </div>
      )}

      {vistaActual === 'vistaprofesor' && (
        <div style={{ padding: '16px', paddingBottom: '48px' }}>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px', lineHeight: '1.5' }}>
            Esto muestra exactamente lo mismo que ve el profesor en su celular (solo lectura, no cambia nada).
          </p>
          <select value={vpProfesorId} onChange={e => { setVpProfesorId(e.target.value); setVpClases([]); if (e.target.value) cargarVistaProfesor(e.target.value) }}
            style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px', marginBottom: '16px', background: 'white' }}>
            <option value="">— Selecciona un profesor —</option>
            {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>

          {vpCargando && <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>Cargando...</p>}

          {!vpCargando && vpProfesorId && vpClases.length === 0 && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '24px 0' }}>Este profesor no tiene nada programado esta semana.</p>
          )}

          {vpClases.map((c: any) => {
            const nombre = c.esTaller ? `🎸 ${c.nombreTaller}` : (c.contratos?.clientes?.nombre || '—')
            const estadoColor: any = { programada: '#6b7280', confirmada: '#166534', dada: '#854d0e', cancelada: '#991b1b' }
            return (
              <div key={c.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px 14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#374151' }}>{nombre}</p>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: estadoColor[c.estado] || '#6b7280' }}>
                    {c.esAtrasada ? '⚠️ ATRASADA · ' : ''}{c.estado}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                  {c.fecha} · {c.hora?.substring(0, 5)} · {c.salones?.nombre || '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {vistaActual === 'clientes' && (
        <div style={{ padding: '16px', paddingBottom: '48px' }}>
          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="text" placeholder="🔍 Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([{ k: 'activos', l: '🟢 Con plan activo' }, { k: 'todos', l: '👥 Todos' }] as const).map(f => (
                <button key={f.k} onClick={() => setFiltroVista(f.k)}
                  style={{ padding: '8px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', border: `1.5px solid ${filtroVista === f.k ? TEAL : TEAL_MID}`, background: filtroVista === f.k ? TEAL : 'white', color: filtroVista === f.k ? 'white' : TEAL_DARK }}>
                  {f.l}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)}
                style={{ flex: 1, padding: '9px 10px', border: `1.5px solid ${filtroSede ? TEAL : TEAL_MID}`, borderRadius: '10px', fontSize: '13px', background: filtroSede ? TEAL_LIGHT : 'white' }}>
                <option value="">🏢 Todas las sedes</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <select value={filtroProfesor} onChange={async e => {
                const prof = e.target.value
                setFiltroProfesor(prof)
                if (!prof) { setClientesConProfesor(null); return }
                const { data } = await supabase.from('clases')
                  .select('contratos(cliente_id)')
                  .eq('profesor_id', prof)
                setClientesConProfesor(new Set(
                  (data || []).map((c: any) => c.contratos?.cliente_id).filter(Boolean)
                ))
              }}
                style={{ flex: 1, padding: '9px 10px', border: `1.5px solid ${filtroProfesor ? TEAL : TEAL_MID}`, borderRadius: '10px', fontSize: '13px', background: filtroProfesor ? TEAL_LIGHT : 'white' }}>
                <option value="">👨‍🏫 Todos los profes</option>
                {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {cargando && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Cargando...</p>}

          {clientesFiltrados.map(cliente => {
            const expandido = clienteExpandido === cliente.id
            const planes = planesCliente[cliente.id] || []
            const talleres = talleresCliente[cliente.id] || []

            return (
              <div key={cliente.id} style={{ background: 'white', borderRadius: '14px', marginBottom: '10px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                {/* Nombre clickeable sin botón */}
                <div style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={async () => {
                  if (expandido) { setClienteExpandido(null); return }
                  setClienteExpandido(cliente.id)
                  if (!planesCliente[cliente.id]) await cargarPlanes(cliente.id)
                  if (!talleresCliente[cliente.id]) await cargarTalleresCliente(cliente.id)
                }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: expandido ? TEAL : '#1f2937', textDecoration: expandido ? 'underline' : 'none' }}>{cliente.nombre}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>{cliente.grupo_whatsapp || '—'} · {cliente.sede_nombre}</p>
                </div>

                {expandido && (
                  <div style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: '#f8fafc' }}>
                    {/* Botón crear plan */}
                    <div style={{ padding: '10px 16px' }}>
                      <button onClick={() => {
                        setCreandoPlan(cliente.id)
                        setNuevoPlanInstrumentoId('')
                        setNuevoPlanProfesorId('')
                        setNuevoPlanSedeId('')
                        setNuevoPlanTotalClases('4')
                        setNuevoPlanDuracion('60')
                        setNuevoPlanValor('')
                        setNuevoPlanFechaInicio(new Date().toISOString().split('T')[0])
                        setNuevoPlanError('')
                      }}
                        style={{ padding: '7px 14px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                        + Nuevo plan
                      </button>
                    </div>

                    {planes.length === 0 && talleres.length === 0 && (
                      <p style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Sin planes ni talleres registrados</p>
                    )}

                    {planes.map(plan => {
                      const planExp = planExpandido === plan.id
                      const clases = clasesPlan[plan.id] || []
                      const esActivo = plan.estado === 'activo'
                      const conteo = (plan as any)._conteo ?? Math.round(plan.clases_tomadas)
                      return (
                        <div key={plan.id} style={{ borderBottom: `1px solid ${TEAL_LIGHT}` }}>
                          {/* Fila compacta clickeable */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', cursor: 'pointer' }}
                            onClick={async (e) => {
                              if ((e.target as HTMLElement).closest('button')) return
                              if (planExp) { setPlanExpandido(null); return }
                              setPlanExpandido(plan.id)
                              if (!clasesPlan[plan.id]) await cargarClases(plan.id, cliente.id)
                            }}>
                            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: esActivo ? '#dcfce7' : '#f1f5f9', color: esActivo ? '#166534' : '#64748b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {esActivo ? '🟢 Activo' : plan.fecha_fin ? plan.fecha_fin.substring(0,7) : 'Archivado'}
                            </span>
                            <span style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>{plan.instrumento_nombre}</span>
                            <span style={{ fontSize: '12px', color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{plan.profesor_nombre}</span>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1f2937', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {conteo}/{plan.total_clases} · {plan.duracion_min}m{plan.valor_plan ? ` · $${plan.valor_plan.toLocaleString('es-CO')}` : ''}
                            </span>
                            <button onClick={e => { e.stopPropagation(); abrirEditarPlan(plan) }}
                              style={{ padding: '5px 8px', background: 'white', color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>
                              ✏️
                            </button>
                          </div>

                          {planExp && (
                            <div style={{ background: 'white', borderTop: `1px solid ${TEAL_LIGHT}` }}>
                              <div style={{ padding: '8px 16px', borderBottom: `1px solid ${TEAL_LIGHT}` }}>
                                <button onClick={() => {
                                  setCreandoClase({ planId: plan.id, clienteId: cliente.id })
                                  setNuevaClaseFecha(new Date().toISOString().split('T')[0])
                                  setNuevaClaseHora('09:00')
                                  setNuevaClaseProfesorId(plan.profesor_id || '')
                                  setNuevaClaseHonorario('')
                                  setNuevaClaseDuracion(String(plan.duracion_min))
                                  setNuevaClaseError('')
                                }}
                                  style={{ padding: '6px 12px', background: '#fefce8', color: '#854d0e', border: '1px solid #fde68a', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                                  + Agregar clase dada
                                </button>
                              </div>
                              {clases.length === 0 && <p style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Sin clases registradas</p>}
                              {clases.map((clase, ci) => {
                                const col = colorEstado(clase)
                                return (
                                  <div key={clase.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto auto', gap: '6px', alignItems: 'center', padding: '10px 16px', borderBottom: ci < clases.length - 1 ? `1px solid ${TEAL_LIGHT}` : 'none', background: ci % 2 === 0 ? 'white' : '#fafefe' }}>
                                    <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{clase.fecha}<br />{clase.hora}</span>
                                    <div>
                                      <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{clase.profesor_nombre}</p>
                                      {clase.numero_calculado !== null && (
                                        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: TEAL }}>{clase.numero_calculado}/{clase.total_clases}</p>
                                      )}
                                      {clase.numero_calculado === null && clase.numero_proyectado !== null && clase.estado === 'confirmada' && (
                                        <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#9ca3af' }}>~{clase.numero_proyectado}/{clase.total_clases}</p>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#166534', whiteSpace: 'nowrap' }}>
                                      {clase.honorario_valor !== null ? `$${clase.honorario_valor.toLocaleString('es-CO')}` : '—'}
                                    </span>
                                    <span style={{ padding: '2px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: '700', background: col.bg, color: col.color, whiteSpace: 'nowrap' }}>
                                      {etiquetaEstado(clase)}
                                    </span>
                                    <button onClick={() => abrirEditarClase(clase)}
                                      style={{ padding: '4px 8px', background: TEAL_LIGHT, color: TEAL_DARK, border: `1px solid ${TEAL_MID}`, borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>✏️</button>
                                    <button onClick={() => borrarClase(clase)}
                                      style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>🗑</button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {talleres.map(taller => {
                      const tallerExp = tallerExpandido === taller.inscripcion_id
                      const sesiones = sesionesTaller[taller.inscripcion_id] || []
                      return (
                        <div key={taller.inscripcion_id} style={{ borderBottom: `1px solid ${PURPLE_MID}` }}>
                          <div style={{ padding: '12px 16px', background: PURPLE_LIGHT }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div>
                                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: PURPLE, color: 'white' }}>
                                  🎸 Taller
                                </span>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '700', color: PURPLE }}>{taller.nombre}</p>
                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                  {taller.sede_nombre} · {taller.fecha_inicio} → {taller.fecha_fin}
                                </p>
                              </div>
                              <button onClick={() => borrarInscripcionTaller(taller, cliente.id)}
                                style={{ padding: '5px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                                🗑
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                              {[
                                { l: 'Sesiones', v: String(taller.num_sesiones) },
                                { l: 'Valor total', v: `$${taller.valor_plan.toLocaleString('es-CO')}` },
                                { l: 'Valor/sesión', v: `$${taller.valor_sesion.toLocaleString('es-CO')}` },
                              ].map(d => (
                                <div key={d.l} style={{ background: 'white', borderRadius: '8px', padding: '8px', textAlign: 'center', border: `1px solid ${PURPLE_MID}` }}>
                                  <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af', fontWeight: '600' }}>{d.l}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '700', color: PURPLE }}>{d.v}</p>
                                </div>
                              ))}
                            </div>
                            <button onClick={async () => {
                              if (tallerExp) { setTallerExpandido(null); return }
                              setTallerExpandido(taller.inscripcion_id)
                              if (!sesionesTaller[taller.inscripcion_id]) await cargarSesionesTaller(taller.inscripcion_id, taller.taller_id)
                            }}
                              style={{ width: '100%', padding: '8px', background: tallerExp ? PURPLE : 'white', color: tallerExp ? 'white' : PURPLE, border: `1px solid ${PURPLE_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                              {tallerExp ? '▲ Ocultar sesiones' : '▼ Ver sesiones'}
                            </button>
                          </div>

                          {tallerExp && (
                            <div style={{ background: 'white', borderTop: `1px solid ${PURPLE_MID}` }}>
                              {sesiones.length === 0 && <p style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Sin sesiones registradas</p>}
                              {sesiones.map((sesion, si) => (
                                <div key={sesion.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', gap: '6px', alignItems: 'center', padding: '10px 16px', borderBottom: si < sesiones.length - 1 ? `1px solid ${PURPLE_LIGHT}` : 'none', background: si % 2 === 0 ? 'white' : '#fdfcff' }}>
                                  <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap' }}>{sesion.fecha}<br />{sesion.hora}</span>
                                  <div>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{sesion.profesor_nombre}</p>
                                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{sesion.sede_nombre}</p>
                                  </div>
                                  <span style={{ fontSize: '11px', fontWeight: '700', color: PURPLE, whiteSpace: 'nowrap' }}>
                                    ${sesion.valor.toLocaleString('es-CO')}
                                  </span>
                                  <button onClick={() => abrirEditarSesion(sesion)}
                                    style={{ padding: '4px 8px', background: PURPLE_LIGHT, color: PURPLE, border: `1px solid ${PURPLE_MID}`, borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>✏️</button>
                                  <button onClick={() => borrarSesion(sesion, cliente.id)}
                                    style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: '700' }}>🗑</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal crear plan */}
      {creandoPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 20px' }} />
            <p style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: '800', color: '#111' }}>Nuevo plan</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Instrumento *</label>
                <select value={nuevoPlanInstrumentoId} onChange={e => setNuevoPlanInstrumentoId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Seleccionar —</option>
                  {instrumentos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Profesor *</label>
                <select value={nuevoPlanProfesorId} onChange={e => setNuevoPlanProfesorId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Seleccionar —</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Sede *</label>
                <select value={nuevoPlanSedeId} onChange={e => setNuevoPlanSedeId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Seleccionar —</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Número de clases</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['4','8','16','20','40','80'].map(n => (
                    <button key={n} onClick={() => setNuevoPlanTotalClases(n)}
                      style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', border: `2px solid ${nuevoPlanTotalClases === n ? TEAL : '#e5e7eb'}`, background: nuevoPlanTotalClases === n ? TEAL_LIGHT : 'white', color: nuevoPlanTotalClases === n ? TEAL_DARK : '#666' }}>
                      {n}
                    </button>
                  ))}
                  <input type="number" placeholder="Otro" value={!['4','8','16','20','40','80'].includes(nuevoPlanTotalClases) ? nuevoPlanTotalClases : ''} onChange={e => setNuevoPlanTotalClases(e.target.value)}
                    style={{ width: '70px', padding: '8px 10px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Duración por clase</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[30, 45, 60, 90, 120].map(d => (
                    <button key={d} onClick={() => setNuevoPlanDuracion(String(d))}
                      style={{ flex: 1, padding: '9px 4px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', border: `2px solid ${nuevoPlanDuracion === String(d) ? TEAL : '#e5e7eb'}`, background: nuevoPlanDuracion === String(d) ? TEAL_LIGHT : 'white', color: nuevoPlanDuracion === String(d) ? TEAL_DARK : '#666' }}>
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Valor del plan ($)</label>
                  <input type="number" value={nuevoPlanValor} onChange={e => setNuevoPlanValor(e.target.value)} placeholder="Opcional" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha de inicio</label>
                  <input type="date" value={nuevoPlanFechaInicio} onChange={e => setNuevoPlanFechaInicio(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              {nuevoPlanError && <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{nuevoPlanError}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={crearPlan} disabled={guardando} style={{ flex: 1, padding: '14px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>
                {guardando ? 'Creando...' : 'Crear plan'}
              </button>
              <button onClick={() => setCreandoPlan(null)} style={{ padding: '14px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear clase dada */}
      {creandoClase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 20px' }} />
            <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: '#854d0e' }}>+ Agregar clase dada</p>
            <p style={{ margin: '0 0 20px', fontSize: '12px', color: '#9ca3af' }}>Para clases que no se migraron o se dieron fuera del horario</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha</label>
                  <input type="date" value={nuevaClaseFecha} onChange={e => setNuevaClaseFecha(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Hora</label>
                  <input type="time" value={nuevaClaseHora} onChange={e => setNuevaClaseHora(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Profesor *</label>
                <select value={nuevaClaseProfesorId} onChange={e => setNuevaClaseProfesorId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Seleccionar —</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Duración</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[30, 45, 60, 90, 120].map(d => (
                    <button key={d} onClick={() => setNuevaClaseDuracion(String(d))}
                      style={{ flex: 1, padding: '9px 4px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', border: `2px solid ${nuevaClaseDuracion === String(d) ? TEAL : '#e5e7eb'}`, background: nuevaClaseDuracion === String(d) ? TEAL_LIGHT : 'white', color: nuevaClaseDuracion === String(d) ? TEAL_DARK : '#666' }}>
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Honorario ($)</label>
                <input type="number" value={nuevaClaseHonorario} onChange={e => setNuevaClaseHonorario(e.target.value)} placeholder="Sin honorario" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
              </div>
              {nuevaClaseError && <p style={{ color: '#dc2626', fontSize: '13px', margin: 0 }}>{nuevaClaseError}</p>}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={crearClaseDada} disabled={guardando} style={{ flex: 1, padding: '14px', background: '#854d0e', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>
                {guardando ? 'Agregando...' : 'Agregar clase'}
              </button>
              <button onClick={() => setCreandoClase(null)} style={{ padding: '14px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar plan */}
      {editandoPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 20px' }} />
            <p style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: '800', color: '#111' }}>Editar plan</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Estado del plan</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ k: 'activo', l: '🟢 Activo' }, { k: 'archivado', l: '📦 Archivado' }, { k: 'completado', l: '✅ Completado' }].map(op => (
                    <button key={op.k} onClick={() => setEditPlanEstado(op.k)}
                      style={{ flex: 1, padding: '9px 6px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', border: `2px solid ${editPlanEstado === op.k ? TEAL : '#e5e7eb'}`, background: editPlanEstado === op.k ? TEAL_LIGHT : 'white', color: editPlanEstado === op.k ? TEAL_DARK : '#666' }}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Instrumento</label>
                <select value={editPlanInstrumentoId} onChange={e => setEditPlanInstrumentoId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Sin instrumento —</option>
                  {instrumentos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Profesor</label>
                <select value={editPlanProfesorId} onChange={e => setEditPlanProfesorId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Sin profesor —</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Sede</label>
                <select value={editPlanSedeId} onChange={e => setEditPlanSedeId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Sin sede —</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha inicio</label>
                  <input type="date" value={editPlanFechaInicio} onChange={e => setEditPlanFechaInicio(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha fin</label>
                  <input type="date" value={editPlanFechaFin} onChange={e => setEditPlanFechaFin(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Duración (min)</label>
                  <select value={editPlanDuracion} onChange={e => setEditPlanDuracion(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                    {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Clases contratadas</label>
                  <input type="number" value={editPlanTotalClases} onChange={e => setEditPlanTotalClases(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Valor del plan ($)</label>
                  <input type="number" value={editPlanValorPlan} onChange={e => setEditPlanValorPlan(e.target.value)} placeholder="Sin valor" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Valor pagado ($)</label>
                  <input type="number" value={editPlanValorPagado} onChange={e => setEditPlanValorPagado(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>Si aumenta el valor pagado, se registra un abono por la diferencia</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={guardarPlan} style={{ flex: 1, padding: '14px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>Guardar cambios</button>
              <button onClick={() => setEditandoPlan(null)} style={{ padding: '14px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
            <button onClick={() => borrarPlanVacio(editandoPlan)} style={{ width: '100%', marginTop: '10px', padding: '11px', background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '12px', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
              🗑 Borrar plan (solo si está vacío)
            </button>
          </div>
        </div>
      )}

      {/* Modal editar clase */}
      {editandoClase && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 20px' }} />
            <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: '#111' }}>Editar clase</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#9ca3af' }}>{editandoClase.fecha} · {editandoClase.hora} · {editandoClase.profesor_nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha</label>
                  <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Hora</label>
                  <input type="time" value={editHora} onChange={e => setEditHora(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Profesor</label>
                <select value={editProfesorId} onChange={e => setEditProfesorId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Sin profesor —</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Duración</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[30, 45, 60, 90, 120].map(d => (
                    <button key={d} onClick={() => setEditDuracion(String(d))}
                      style={{ flex: 1, padding: '9px 4px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', border: `2px solid ${editDuracion === String(d) ? TEAL : '#e5e7eb'}`, background: editDuracion === String(d) ? TEAL_LIGHT : 'white', color: editDuracion === String(d) ? TEAL_DARK : '#666' }}>
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Estado</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { k: 'programada', l: 'Programada' },
                    { k: 'confirmada', l: 'Confirmada' },
                    { k: 'dada', l: 'Dada' },
                    { k: 'cortesia', l: '🎁 Cortesía' },
                    { k: 'inasistencia', l: 'Inasistencia' },
                    { k: 'inasistencia_perdonada', l: '🎁 Inasist. perdonada' },
                    { k: 'cancelada', l: 'Cancelada' },
                  ].map(op => (
                    <button key={op.k} onClick={() => setEditEstado(op.k)}
                      style={{ padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', border: `2px solid ${editEstado === op.k ? TEAL : '#e5e7eb'}`, background: editEstado === op.k ? TEAL_LIGHT : 'white', color: editEstado === op.k ? TEAL_DARK : '#666' }}>
                      {op.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Honorario ($)</label>
                <input type="number" value={editHonorario} onChange={e => setEditHonorario(e.target.value)} placeholder="Sin honorario" style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
              </div>
              <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '700', color: '#6b7280' }}>Mover clase a otro plan</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setEditandoClase(null); moverClase(editandoClase, 'activo') }} style={{ flex: 1, padding: '9px', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>→ Plan activo</button>
                  <button onClick={() => { setEditandoClase(null); moverClase(editandoClase, 'archivado') }} style={{ flex: 1, padding: '9px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>→ Plan archivado</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={guardarClase} style={{ flex: 1, padding: '14px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>Guardar cambios</button>
              <button onClick={() => setEditandoClase(null)} style={{ padding: '14px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar sesión taller */}
      {editandoSesion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 20px' }} />
            <p style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800', color: PURPLE }}>🎸 Editar sesión</p>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#9ca3af' }}>{editandoSesion.taller_nombre} · {editandoSesion.fecha}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha</label>
                  <input type="date" value={editSesionFecha} onChange={e => setEditSesionFecha(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${PURPLE_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Hora</label>
                  <input type="time" value={editSesionHora} onChange={e => setEditSesionHora(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${PURPLE_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Profesor</label>
                <select value={editSesionProfesorId} onChange={e => setEditSesionProfesorId(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${PURPLE_MID}`, borderRadius: '10px', fontSize: '14px' }}>
                  <option value="">— Sin profesor —</option>
                  {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Valor de la sesión ($)</label>
                <input type="number" value={editSesionValor} onChange={e => setEditSesionValor(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${PURPLE_MID}`, borderRadius: '10px', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={guardarSesion} style={{ flex: 1, padding: '14px', background: PURPLE, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>Guardar cambios</button>
              <button onClick={() => setEditandoSesion(null)} style={{ padding: '14px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar */}
      {confirmarCambio && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '24px', maxWidth: '360px', width: '100%' }}>
            <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '800', color: '#111' }}>¿Confirmar cambio?</p>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>{confirmarCambio.mensaje}</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={async () => {
                setGuardando(true)
                await confirmarCambio.accion()
                setConfirmarCambio(null)
                setGuardando(false)
              }} disabled={guardando}
                style={{ flex: 1, padding: '13px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>
                {guardando ? 'Guardando...' : 'Aceptar'}
              </button>
              <button onClick={() => setConfirmarCambio(null)} style={{ padding: '13px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
