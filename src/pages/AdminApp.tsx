import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { calcularNumeracion } from '../utils/numeracionClases'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'
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

  const [vistaActual, setVistaActual] = useState<'clientes' | 'reportes'>('clientes')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [profesores, setProfesores] = useState<{ id: string; nombre: string }[]>([])
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

  // Talleres por cliente
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

  // Edición sesión taller
  const [editSesionFecha, setEditSesionFecha] = useState('')
  const [editSesionHora, setEditSesionHora] = useState('')
  const [editSesionProfesorId, setEditSesionProfesorId] = useState('')
  const [editSesionValor, setEditSesionValor] = useState('')
  const [editSesionSedeNombre, setEditSesionSedeNombre] = useState('')

  const [editPlanEstado, setEditPlanEstado] = useState('')
  const [editPlanFechaFin, setEditPlanFechaFin] = useState('')
  const [editPlanDuracion, setEditPlanDuracion] = useState('')
  const [editPlanTotalClases, setEditPlanTotalClases] = useState('')
  const [editPlanValorPagado, setEditPlanValorPagado] = useState('')

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
    const [{ data: sedesData }, { data: profsData }] = await Promise.all([
      supabase.from('sedes').select('id, nombre').order('nombre'),
      supabase.from('profesores').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setSedes(sedesData || [])
    setProfesores(profsData || [])
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
        instrumentos(nombre), profesores(nombre), sedes(nombre), cliente_id`)
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
    // Obtener sesiones dadas del taller en el período de la inscripción
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
      setClasesPlan(prev => ({ ...prev, [planId]: clases }))
      setPlanesCliente(prev => {
        const planes = prev[clienteId] || []
        return {
    ...prev,
    [clienteId]: planes.map(p => p.id === planId ? { ...p, _conteo: maxNumeracion } : p)
  }
})
  }

  // ─── FILTROS ─────────────────────────────────────────────────────────────
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
        return planes.some(p => p.estado === 'activo')
      }
      return true
    })
    .filter(c => {
      if (!filtroProfesor) return true
      if (!clientesConProfesor) return false
      return clientesConProfesor.has(c.id)
    })

  // ─── ACCIONES PLAN ───────────────────────────────────────────────────────
  function abrirEditarPlan(plan: Plan) {
    setEditandoPlan(plan)
    setEditPlanEstado(plan.estado)
    setEditPlanFechaFin(plan.fecha_fin || '')
    setEditPlanDuracion(String(plan.duracion_min))
    setEditPlanTotalClases(String(plan.total_clases))
    setEditPlanValorPagado(String(plan.total_pagado))
  }

  async function guardarPlan() {
    if (!editandoPlan) return
    const cambios: string[] = []
    if (editPlanEstado !== editandoPlan.estado) cambios.push(`estado a "${editPlanEstado}"`)
    if (editPlanFechaFin !== (editandoPlan.fecha_fin || '')) cambios.push(`fecha fin a "${editPlanFechaFin || 'sin fecha'}"`)
    if (editPlanDuracion !== String(editandoPlan.duracion_min)) cambios.push(`duración a ${editPlanDuracion} min`)
    if (editPlanTotalClases !== String(editandoPlan.total_clases)) cambios.push(`clases contratadas a ${editPlanTotalClases}`)
    const planNombre = `${editandoPlan.instrumento_nombre} (${editandoPlan.sede_nombre})`
    setConfirmarCambio({
      mensaje: `¿Está seguro de modificar ${cambios.join(', ')} del plan ${planNombre}?`,
      accion: async () => {
        const payload: any = { estado: editPlanEstado, duracion_min: parseInt(editPlanDuracion), total_clases: parseInt(editPlanTotalClases) }
        if (editPlanFechaFin) payload.fecha_fin = editPlanFechaFin
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

  // ─── ACCIONES CLASE ──────────────────────────────────────────────────────
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
        const payload: any = { fecha: editFecha, hora: editHora + ':00', profesor_id: editProfesorId, honorario_valor: editHonorario !== '' ? Number(editHonorario) : null }
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

  // ─── ACCIONES SESIÓN TALLER ──────────────────────────────────────────────
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
        // Actualizar sesión — fecha y honorario se guardan en taller_sesiones
        await supabase.from('taller_sesiones').update({
          fecha: editSesionFecha,
          honorario_valor: editSesionValor !== '' ? Number(editSesionValor) : null,
        }).eq('id', editandoSesion.id)
        // Actualizar profesor en el taller si cambió
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
        // Borrar asistencias, confirmaciones y sesiones relacionadas
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

  // ─── LOGIN ────────────────────────────────────────────────────────────────
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

  // ─── APP PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}} *{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background: TEAL_DARK, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/Logo_RubySalamanca.png" alt="Logo" style={{ height: '28px', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px' }}>ADMIN</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>Salir</button>
        </div>
        <div style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {[{ key: 'clientes', label: '👥 Clientes' }, { key: 'reportes', label: '📊 Reportes' }].map(tab => (
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

      {/* Reportes */}
      {vistaActual === 'reportes' && (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#374151', margin: '0 0 8px' }}>Reportes</p>
          <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0 }}>Próximamente — módulo de reportes en desarrollo.</p>
        </div>
      )}

      {/* Clientes */}
      {vistaActual === 'clientes' && (
        <div style={{ padding: '16px', paddingBottom: '48px' }}>
          {/* Filtros */}
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
                    (data || [])
                      .map((c: any) => c.contratos?.cliente_id)
                      .filter(Boolean)
                  ))
              }}
                style={{ flex: 1, padding: '9px 10px', border: `1.5px solid ${filtroProfesor ? TEAL : TEAL_MID}`, borderRadius: '10px', fontSize: '13px', background: filtroProfesor ? TEAL_LIGHT : 'white' }}>
                <option value="">👨‍🏫 Todos los profes</option>
                {profesores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
          </div>

          {cargando && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Cargando...</p>}

          {/* Lista clientes */}
          {clientesFiltrados.map(cliente => {
            const expandido = clienteExpandido === cliente.id
            const planes = planesCliente[cliente.id] || []
            const talleres = talleresCliente[cliente.id] || []

            return (
              <div key={cliente.id} style={{ background: 'white', borderRadius: '14px', marginBottom: '10px', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center', padding: '14px 16px' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: '#1f2937' }}>{cliente.nombre}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>{cliente.grupo_whatsapp || '—'} · {cliente.sede_nombre}</p>
                  </div>
                  <button onClick={async () => {
                    if (expandido) { setClienteExpandido(null); return }
                    setClienteExpandido(cliente.id)
                    if (!planesCliente[cliente.id]) await cargarPlanes(cliente.id)
                    if (!talleresCliente[cliente.id]) await cargarTalleresCliente(cliente.id)
                  }}
                    style={{ padding: '6px 14px', background: TEAL_LIGHT, color: TEAL_DARK, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                    {expandido ? '▲ Cerrar' : '▼ Ver'}
                  </button>
                </div>

                {expandido && (
                  <div style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: '#f8fafc' }}>
                    {planes.length === 0 && talleres.length === 0 && (
                      <p style={{ padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Sin planes ni talleres registrados</p>
                    )}

                    {/* ── PLANES ── */}
                    {planes.map(plan => {
                      const planExp = planExpandido === plan.id
                      const clases = clasesPlan[plan.id] || []
                      const esActivo = plan.estado === 'activo'
                      return (
                        <div key={plan.id} style={{ borderBottom: `1px solid ${TEAL_LIGHT}` }}>
                          <div style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <div>
                                <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: esActivo ? '#dcfce7' : '#f1f5f9', color: esActivo ? '#166534' : '#64748b' }}>
                                  {esActivo ? '🟢 Activo' : plan.fecha_fin || 'Archivado'}
                                </span>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280' }}>{plan.instrumento_nombre} · {plan.profesor_nombre}</p>
                              </div>
                              <button onClick={() => abrirEditarPlan(plan)}
                                style={{ padding: '5px 12px', background: 'white', color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                                ✏️ Editar
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                              {[
                                { l: 'Duración', v: `${plan.duracion_min} min` },
                                { l: 'Plan', v: `${Math.round(plan.clases_tomadas)}/${plan.total_clases}` },
                                { l: 'Pagado', v: `$${plan.total_pagado.toLocaleString('es-CO')}` },
                                { l: 'Valor', v: plan.valor_plan ? `$${plan.valor_plan.toLocaleString('es-CO')}` : '—' },
                              ].map(d => (
                                <div key={d.l} style={{ background: 'white', borderRadius: '8px', padding: '8px', textAlign: 'center', border: `1px solid ${TEAL_MID}` }}>
                                  <p style={{ margin: 0, fontSize: '10px', color: '#9ca3af', fontWeight: '600' }}>{d.l}</p>
                                  <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '700', color: '#1f2937' }}>{d.v}</p>
                                </div>
                              ))}
                            </div>
                            <button onClick={async () => {
                              if (planExp) { setPlanExpandido(null); return }
                              setPlanExpandido(plan.id)
                              if (!clasesPlan[plan.id]) await cargarClases(plan.id, cliente.id)
                            }}
                              style={{ width: '100%', padding: '8px', background: planExp ? TEAL : 'white', color: planExp ? 'white' : TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                              {planExp ? '▲ Ocultar clases' : '▼ Ver clases'}
                            </button>
                          </div>

                          {planExp && (
                            <div style={{ background: 'white', borderTop: `1px solid ${TEAL_LIGHT}` }}>
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

                    {/* ── TALLERES ── */}
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

      {/* Modal editar plan */}
      {editandoPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: '480px', padding: '24px 20px 36px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 20px' }} />
            <p style={{ margin: '0 0 20px', fontSize: '17px', fontWeight: '800', color: '#111' }}>Editar plan — {editandoPlan.instrumento_nombre}</p>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Fecha de finalización</label>
                <input type="date" value={editPlanFechaFin} onChange={e => setEditPlanFechaFin(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
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
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#6b7280', marginBottom: '6px' }}>Valor pagado ($)</label>
                <input type="number" value={editPlanValorPagado} onChange={e => setEditPlanValorPagado(e.target.value)} style={{ width: '100%', padding: '11px 12px', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', fontSize: '14px' }} />
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>Si aumenta el valor, se registra un abono por la diferencia</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={guardarPlan} style={{ flex: 1, padding: '14px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '15px', fontWeight: '800' }}>Guardar cambios</button>
              <button onClick={() => setEditandoPlan(null)} style={{ padding: '14px 20px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
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
