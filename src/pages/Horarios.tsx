import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL       = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID   = '#b2d8d8'

const DIAS_SEMANA: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6
}
const DIAS_LARGO = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado']
const MESES_NOMBRE = ['enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fechaHoyLocal(): string  { return fechaLocal(new Date()) }
function fechaMananaLocal(): string { const d = new Date(); d.setDate(d.getDate()+1); return fechaLocal(d) }

function formatHoraAmPm(hora: string): string {
  if (!hora) return '—'
  const [h, m] = hora.substring(0,5).split(':').map(Number)
  const ampm = h >= 12 ? 'p.m.' : 'a.m.'
  const h12  = h % 12 || 12
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`
}

function labelDiaSemana(fecha: string): { texto: string; esHoy: boolean; esAtras: boolean } {
  const hoyStr    = fechaHoyLocal()
  const mananaStr = fechaMananaLocal()
  const diffDias  = Math.round((new Date(fecha+'T12:00:00').getTime() - new Date(hoyStr+'T12:00:00').getTime()) / 86400000)
  const diaNom    = DIAS_LARGO[new Date(fecha+'T12:00:00').getDay()]
  if (fecha === hoyStr)    return { texto: `Hoy ${diaNom}`,    esHoy: true,  esAtras: false }
  if (fecha === mananaStr) return { texto: `Mañana ${diaNom}`, esHoy: false, esAtras: false }
  if (diffDias === -1)     return { texto: `Ayer ${diaNom}`,   esHoy: false, esAtras: true  }
  if (diffDias === -2)     return { texto: 'Hace dos días',    esHoy: false, esAtras: true  }
  if (diffDias === -3)     return { texto: 'Hace tres días',   esHoy: false, esAtras: true  }
  if (diffDias < 0)        return { texto: `${fecha.substring(8,10)}/${fecha.substring(5,7)} ${diaNom}`, esHoy: false, esAtras: true }
  if (diaNom === 'sábado') return { texto: 'El sábado',        esHoy: false, esAtras: false }
  return { texto: `El ${diaNom}`, esHoy: false, esAtras: false }
}

function etiquetaSemana(): string {
  const hoy = new Date()
  const diaSemana = hoy.getDay()
  const lunesDiff = diaSemana === 0 ? -6 : 1 - diaSemana
  const lunes  = new Date(hoy); lunes.setDate(hoy.getDate() + lunesDiff)
  const diasHastaSabado = diaSemana === 6 ? 7 : 6 - diaSemana
  const sabado = new Date(hoy); sabado.setDate(hoy.getDate() + diasHastaSabado)
  return `📅 ${MESES_CORTO[lunes.getMonth()]} ${lunes.getDate()} – ${MESES_CORTO[sabado.getMonth()]} ${sabado.getDate()}`
}

function badgeEstado(estado: string, revisionPendiente?: boolean, esTaller?: boolean) {
  if (revisionPendiente) return { label: 'Inasistencia', bg: '#fff7ed', color: '#c2410c' }
  if (esTaller)          return { label: 'Taller',       bg: '#f3e8ff', color: '#7c3aed' }
  switch (estado) {
    case 'dada':       return { label: 'Dada ✓',    bg: '#fefce8', color: '#854d0e' }
    case 'confirmada': return { label: 'Confirmada', bg: '#dcfce7', color: '#166534' }
    case 'programada': return { label: 'Programada', bg: '#f1f5f9', color: '#94a3b8' }
    case 'cancelada':  return { label: 'Cancelada',  bg: '#fee2e2', color: '#991b1b' }
    default:           return { label: estado,       bg: '#f1f5f9', color: '#94a3b8' }
  }
}

function nombreCliente(c: any) {
  const cl = c.contratos?.clientes
  if (!cl) return '—'
  return cl.nombre || `${cl.nombres || ''} ${cl.apellidos || ''}`.trim() || '—'
}

function minutosParaClase(fecha: string, hora: string): number {
  const [h, m] = hora.substring(0,5).split(':').map(Number)
  const claseDate = new Date(fecha + 'T' + String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':00')
  return Math.floor((claseDate.getTime() - Date.now()) / 60000)
}

const SELECT_CLASES = [
  'id', 'fecha', 'hora', 'duracion_min', 'estado', 'modalidad', 'cancelado_por_academia',
  'observaciones', 'contrato_id', 'honorario_valor', 'motivo_cancelacion',
  'contratos(clientes(nombre, nombres, apellidos), instrumentos(nombre), duracion_min, clases_tomadas, total_clases)',
  'salones(nombre, sedes(nombre))'
].join(', ')

// Para historial: usa la view que incluye numero_calculado
const SELECT_HISTORIAL = [
  'id', 'fecha', 'hora', 'duracion_min', 'estado', 'modalidad', 'cancelado_por_academia', 'es_cortesia',
  'observaciones', 'contrato_id', 'honorario_valor', 'motivo_cancelacion', 'numero_calculado',
  'contratos(clientes(nombre, nombres, apellidos), instrumentos(nombre), duracion_min, clases_tomadas, total_clases)',
  'salones(nombre, sedes(nombre))'
].join(', ')

export default function ProfesorApp() {
  const [sesion, setSesion]               = useState<any>(null)
  const [profesor, setProfesor]           = useState<any>(null)
  const [cargandoAuth, setCargandoAuth]   = useState(true)

  const [loginEmail, setLoginEmail]       = useState('')
  const [loginPass, setLoginPass]         = useState('')
  const [loginError, setLoginError]       = useState('')
  const [loginCargando, setLoginCargando] = useState(false)

  const [vista, setVista]                 = useState<'hoy' | 'historial'>('hoy')
  const [clases, setClases]               = useState<any[]>([])
  const [cargandoClases, setCargandoClases] = useState(false)
  const [tarifas, setTarifas]             = useState<any[]>([])
  const [mes, setMes]                     = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`
  })

  const [claseActiva, setClaseActiva]     = useState<any>(null)
  const [resumen, setResumen]             = useState('')
  const [guardando, setGuardando]         = useState(false)
  const [exito, setExito]                 = useState('')
  const [resumenExpandido, setResumenExpandido] = useState<string | null>(null)
  const [pantallaModal, setPantallaModal] = useState<'acciones' | 'inasistencia' | 'cancelar' | 'avisoTardia'>('acciones')
  const [avisoCancelacion, setAvisoCancelacion] = useState('')

  const [tallerModal, setTallerModal]         = useState<any>(null)
  const [inscritosTaller, setInscritosTaller] = useState<any[]>([])
  const [sesionHoy, setSesionHoy]             = useState<any>(null)
  const [asistenciasTaller, setAsistenciasTaller] = useState<Record<string, boolean | null>>({})
  const [resumenTaller, setResumenTaller] = useState('')
  const [guardandoAsistTaller, setGuardandoAsistTaller] = useState(false)
  const [guardandoSesion, setGuardandoSesion] = useState(false)

  useEffect(() => {
    document.body.style.background = '#f8fafc'
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    return () => { document.body.style.background = '' }
  }, [])

  useEffect(() => {
    if (!exito) return
    const t = setTimeout(() => setExito(''), 4000)
    return () => clearTimeout(t)
  }, [exito])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session)
      if (session?.user?.email) buscarProfesor(session.user.email)
      else setCargandoAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSesion(session)
      if (!session) { setProfesor(null); setCargandoAuth(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!profesor) return
    cargarTarifas()
    if (vista === 'hoy') cargarHoy()
    else cargarHistorial()
  }, [vista, mes, profesor])

  async function buscarProfesor(email: string) {
    const { data } = await supabase.from('profesores').select('id, nombre, ciudad, email')
      .ilike('email', email.trim()).single()
    setProfesor(data || null)
    setCargandoAuth(false)
  }

  async function login() {
    if (!loginEmail || !loginPass) { setLoginError('Ingresa tu correo y contraseña'); return }
    setLoginCargando(true); setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(), password: loginPass
    })
    if (error) { setLoginError('Correo o contraseña incorrectos'); setLoginCargando(false); return }
    if (data.user?.email) { setSesion(data.session); await buscarProfesor(data.user.email) }
    setLoginCargando(false)
  }

  async function cargarTarifas() {
    if (!profesor) return
    const { data } = await supabase.from('profesor_tarifas').select('*')
      .eq('profesor_id', profesor.id).eq('taller_grupal', false)
    setTarifas(data || [])
  }

  function getHonorario(c: any): number | 'pendiente' {
    const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia
    if (c.estado !== 'dada' && !esInasistencia) return 0
    if (esInasistencia && c.honorario_valor === null) return 'pendiente'
    if (c.honorario_valor !== null && c.honorario_valor !== undefined) return Number(c.honorario_valor)
    if (c.estado !== 'dada') return 0
    const modalidad = (c.modalidad || 'presencial').toLowerCase()
    const duracion  = Number(c.duracion_min)
    let tarifa = tarifas.find((t: any) => t.modalidad?.toLowerCase() === modalidad && Number(t.duracion_min) === duracion)
    if (!tarifa && (modalidad === 'presencial' || modalidad === 'virtual')) {
      tarifa = tarifas.find((t: any) =>
        (t.modalidad?.toLowerCase() === 'presencial' || t.modalidad?.toLowerCase() === 'virtual') &&
        Number(t.duracion_min) === duracion
      )
    }
    return tarifa ? Number(tarifa.valor) : 0
  }

  function getValorTarifa(duracion: number, modalidad: string): number {
    let tarifa = tarifas.find((t: any) => t.modalidad?.toLowerCase() === modalidad && Number(t.duracion_min) === duracion)
    if (!tarifa) tarifa = tarifas.find((t: any) =>
      (t.modalidad?.toLowerCase() === 'presencial' || t.modalidad?.toLowerCase() === 'virtual') &&
      Number(t.duracion_min) === duracion
    )
    return tarifa ? Number(tarifa.valor) : 0
  }

  async function insertarNotificacion(tipo: string, mensaje: string, detalle: string, claseId?: string) {
    await supabase.from('notificaciones').insert({
      tipo, mensaje, detalle,
      profesor_id: profesor?.id || null,
      clase_id: claseId || null,
    })
  }

  async function cargarHoy() {
    if (!profesor) return
    setCargandoClases(true)
    const hoy = new Date()
    const diaSemana = hoy.getDay()
    const diasHastaSabado = diaSemana === 6 ? 7 : 6 - diaSemana
    const sabado = new Date(hoy); sabado.setDate(hoy.getDate() + diasHastaSabado)
    const fi = fechaHoyLocal()
    const ff = fechaLocal(sabado)

    // ── FIX 1: solo traer programadas/confirmadas en la cola ──
    const { data } = await supabase.from('clases').select(SELECT_CLASES)
      .eq('profesor_id', profesor.id)
      .gte('fecha', fi).lte('fecha', ff)
      .in('estado', ['programada', 'confirmada'])
      .order('fecha').order('hora')

    const { data: dataAtrasadas } = await supabase.from('clases').select(SELECT_CLASES)
      .eq('profesor_id', profesor.id)
      .eq('estado', 'confirmada')
      .lt('fecha', fi)
      .order('fecha').order('hora')

    const mesT = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
    const { data: talleresData } = await supabase.from('talleres')
      .select('id, nombre, dia_semana, hora, duracion_min, salones(nombre, sedes(nombre))')
      .eq('profesor_id', profesor.id)

    const ids = (talleresData || []).map((t: any) => t.id)
    let talleresConfirmados: any[] = []
    if (ids.length > 0) {
      const hoyStr2 = fechaLocal(new Date())
      // Use fecha_fin if available, fallback to mes for old records
      const { data: inscrip } = await supabase.from('taller_inscripciones')
        .select('taller_id, mes, fecha_inicio, fecha_fin')
        .in('taller_id', ids).eq('estado', 'activo')
      const confirmados = new Set(
        (inscrip || []).filter((i: any) => {
          if (i.fecha_fin) return i.fecha_fin >= hoyStr2
          if (i.mes) return i.mes >= mesT
          return true
        }).map((i: any) => i.taller_id)
      )
      // Show ALL talleres the professor has — even without active inscriptions (so programada ones appear)
      const talleresConInscritos = talleresData || []
      // Load sesion estado for each taller for this week
      const hoyStr = fechaLocal(new Date())
      const finSemana = fechaLocal(new Date(new Date().setDate(new Date().getDate() + 6)))
      if (talleresConInscritos.length > 0) {
        const { data: sesiones } = await supabase.from('taller_sesiones')
          .select('taller_id, fecha, estado')
          .in('taller_id', talleresConInscritos.map((t: any) => t.id))
        const sesionMap: Record<string, string> = {}
        ;(sesiones || []).forEach((s: any) => { sesionMap[`${s.taller_id}-${s.fecha}`] = s.estado })
        talleresConfirmados = talleresConInscritos.map((t: any) => ({ ...t, _sesionMap: sesionMap }))
      } else {
        talleresConfirmados = []
      }
    }

    const clasesFinales = [
      ...(dataAtrasadas || []).map((c: any) => ({ ...c, esAtrasada: true })),
      ...(data || [])
    ]

    for (let offset = 0; offset <= diasHastaSabado; offset++) {
      const dia = new Date(hoy); dia.setDate(hoy.getDate() + offset)
      const fechaStr = fechaLocal(dia)
      talleresConfirmados.forEach((t: any) => {
        if (DIAS_SEMANA[t.dia_semana] === dia.getDay()) {
          const sesionEstadoHoy = t._sesionMap?.[`${t.id}-${fechaStr}`] || null
          // Use sesionEstado as the card estado so all downstream logic works
          const estadoTaller = sesionEstadoHoy || 'programada'
          clasesFinales.push({
            id: `taller-${t.id}-${fechaStr}`,
            fecha: fechaStr, hora: t.hora,
            duracion_min: t.duracion_min,
            estado: estadoTaller, esTaller: true, sesionEstado: estadoTaller,
            tallerRealId: t.id, nombreTaller: t.nombre,
            salones: t.salones, contratos: null,
            observaciones: null,
            honorario_valor: null, modalidad: null,
          })
        }
      })
    }

    clasesFinales.sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))
    setClases(clasesFinales)
    setCargandoClases(false)
  }

  async function cargarHistorial() {
    if (!profesor) return
    setCargandoClases(true)
    const fi = `${mes}-01`
    const [a, m] = mes.split('-')
    const ul = new Date(parseInt(a), parseInt(m), 0).getDate()
    const ff = `${mes}-${String(ul).padStart(2,'0')}`

    // Historial: dadas + canceladas — usa clases_con_numero para obtener numero_calculado
    const { data } = await supabase.from('clases_con_numero').select(SELECT_HISTORIAL)
      .eq('profesor_id', profesor.id)
      .gte('fecha', fi).lte('fecha', ff)
      .in('estado', ['dada', 'cancelada'])
      .order('fecha', { ascending: false })

    setClases(data || [])
    setCargandoClases(false)
  }

  async function marcarDada() {
    if (!claseActiva) return
    setGuardando(true)
    const { data: contrato } = await supabase.from('contratos').select('id, clases_tomadas, duracion_min')
      .eq('id', claseActiva.contrato_id).single()
    const durPlan  = Number(contrato?.duracion_min) || Number(claseActiva.contratos?.duracion_min) || Number(claseActiva.duracion_min) || 60
    const durClase = Number(claseActiva.duracion_min) || durPlan
    const fraccion = parseFloat((durClase / durPlan).toFixed(4))
    const tomadas  = parseFloat(Number(contrato?.clases_tomadas || 0).toFixed(4))
    await supabase.from('clases').update({
      estado: 'dada',
      observaciones: resumen.trim() || claseActiva.observaciones || null
    }).eq('id', claseActiva.id)
    if (contrato) {
      await supabase.from('contratos').update({
        clases_tomadas: parseFloat((tomadas + fraccion).toFixed(4))
      }).eq('id', contrato.id)
    }
    setExito('¡Clase marcada como dada!')
    cerrarModal()
    setGuardando(false)
  }

  async function marcarInasistencia(pct: number) {
    if (!claseActiva) return
    setGuardando(true)
    const { data: contrato } = await supabase.from('contratos').select('id, clases_tomadas, duracion_min')
      .eq('id', claseActiva.contrato_id).single()
    const durPlan  = Number(contrato?.duracion_min) || Number(claseActiva.contratos?.duracion_min) || Number(claseActiva.duracion_min) || 60
    const durClase = Number(claseActiva.duracion_min) || durPlan
    const fraccion = parseFloat((durClase / durPlan).toFixed(4))
    const tomadas  = parseFloat(Number(contrato?.clases_tomadas || 0).toFixed(4))
    if (contrato) {
      await supabase.from('contratos').update({
        clases_tomadas: parseFloat((tomadas + fraccion).toFixed(4))
      }).eq('id', contrato.id)
    }
    const modalidad = (claseActiva.modalidad || 'presencial').toLowerCase()
    const baseHon   = getValorTarifa(Number(claseActiva.duracion_min), modalidad)
    const honorario = Math.round(baseHon * pct / 100)
    // Inasistencia: estado='cancelada' + cancelado_por_academia=false
    await supabase.from('clases').update({
      estado: 'cancelada',
      cancelado_por_academia: false,
      honorario_valor: honorario,
      observaciones: resumen.trim() || claseActiva.observaciones || null
    }).eq('id', claseActiva.id)
    await insertarNotificacion(
      'inasistencia',
      `Inasistencia — ${nombreCliente(claseActiva)}`,
      `Clase con ${profesor?.nombre} · ${formatHoraAmPm(claseActiva.hora)} · ${claseActiva.salones?.sedes?.nombre} · honorario ${pct}%`,
      claseActiva.id
    )
    setExito('Inasistencia registrada')
    cerrarModal()
    setGuardando(false)
  }

  async function cancelarClase() {
    if (!claseActiva) return
    setGuardando(true)
    const minutos  = minutosParaClase(claseActiva.fecha, claseActiva.hora)
    const esTardia = minutos < 180
    const motivo   = esTardia ? 'Cancelación tardía — posible clase de cortesía' : 'Cancelación a tiempo'
    await supabase.from('clases').update({
      estado: 'cancelada',
      motivo_cancelacion: motivo,
      cancelado_por_academia: true,
      cancelado_tarde: esTardia,
      observaciones: resumen.trim() || claseActiva.observaciones || null
    }).eq('id', claseActiva.id)
    await insertarNotificacion(
      esTardia ? 'cancelacion_tardia' : 'cancelacion_a_tiempo',
      `${motivo} — ${profesor?.nombre}`,
      `Clase de ${nombreCliente(claseActiva)} · ${claseActiva.fecha} ${formatHoraAmPm(claseActiva.hora)} · ${claseActiva.salones?.sedes?.nombre}`,
      claseActiva.id
    )
    if (esTardia) {
      setAvisoCancelacion(`La clase fue cancelada. Como faltaban menos de 3 horas, la asistente revisará si corresponde una clase de cortesía para ${nombreCliente(claseActiva)}.`)
      setPantallaModal('avisoTardia')
      setGuardando(false)
    } else {
      setExito('Clase cancelada')
      cerrarModal()
      setGuardando(false)
    }
  }

  async function guardarResumen() {
    if (!claseActiva) return
    setGuardando(true)
    await supabase.from('clases').update({ observaciones: resumen.trim() || null }).eq('id', claseActiva.id)
    setExito('Resumen guardado')
    cerrarModal()
    setGuardando(false)
  }

  async function abrirTaller(c: any) {
    setTallerModal(c)
    const hoy  = new Date()
    const mesT = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-01`
    const { data: inscritos } = await supabase.from('taller_inscripciones')
      .select('id, mes, fecha_inicio, fecha_fin, clientes(nombre, nombres, apellidos)')
      .eq('taller_id', c.tallerRealId).eq('estado', 'activo')
    const fechaClase = c.fecha
    const inscFiltradosFecha = (inscritos || []).filter((ins: any) => {
      if (ins.fecha_inicio && ins.fecha_fin) return ins.fecha_inicio <= fechaClase && ins.fecha_fin >= fechaClase
      return ins.mes && ins.mes.substring(0,7) === fechaClase.substring(0,7)
    })
    const { data: sesion } = await supabase.from('taller_sesiones').select('id, fecha, estado, observaciones')
      .eq('taller_id', c.tallerRealId).eq('fecha', c.fecha).maybeSingle()
    setSesionHoy(sesion || null)
    // If sesion is confirmada or dada, only show confirmed students
    let inscFiltrados = inscFiltradosFecha
    if (sesion?.id && (sesion.estado === 'confirmada' || sesion.estado === 'dada')) {
      const { data: confs } = await supabase.from('taller_confirmaciones')
        .select('inscripcion_id').eq('sesion_id', sesion.id)
      // Always filter by confirmaciones — if none exist, show empty list
      const confIds = new Set((confs || []).map((c: any) => c.inscripcion_id))
      inscFiltrados = inscFiltradosFecha.filter((ins: any) => confIds.has(ins.id))
    }
    setInscritosTaller(inscFiltrados)
    setResumenTaller(sesion?.observaciones || '')
    setAsistenciasTaller({})
    if (sesion?.id) {
      const { data: asis } = await supabase.from('taller_asistencias')
        .select('inscripcion_id, asistio').eq('sesion_id', sesion.id)
      const map: Record<string, boolean | null> = {}
      ;(asis || []).forEach((a: any) => { map[a.inscripcion_id] = a.asistio })
      setAsistenciasTaller(map)
    }
  }

  async function toggleAsistTaller(inscripcionId: string, asistio: boolean | null) {
    // Only allowed when session is confirmada or dada
    if (!sesionHoy?.id || (sesionHoy.estado !== 'confirmada' && sesionHoy.estado !== 'dada')) return
    setGuardandoAsistTaller(true)
    const yaExiste = inscripcionId in asistenciasTaller
    if (asistio === null) {
      await supabase.from('taller_asistencias').delete()
        .eq('sesion_id', sesionHoy.id).eq('inscripcion_id', inscripcionId)
      setAsistenciasTaller(prev => { const n = { ...prev }; delete n[inscripcionId]; return n })
    } else if (yaExiste) {
      await supabase.from('taller_asistencias').update({ asistio })
        .eq('sesion_id', sesionHoy.id).eq('inscripcion_id', inscripcionId)
      setAsistenciasTaller(prev => ({ ...prev, [inscripcionId]: asistio }))
    } else {
      await supabase.from('taller_asistencias').insert({
        sesion_id: sesionHoy.id, inscripcion_id: inscripcionId, asistio
      })
      setAsistenciasTaller(prev => ({ ...prev, [inscripcionId]: asistio }))
    }
    setGuardandoAsistTaller(false)
  }

  async function marcarSesionTaller(nuevoEstado: string) {
    // Never allow a professor to confirm — only admins can do that
    if (!tallerModal || nuevoEstado === 'confirmada') return
    setGuardandoSesion(true)
    if (sesionHoy) {
      await supabase.from('taller_sesiones').update({ estado: nuevoEstado }).eq('id', sesionHoy.id)
      setSesionHoy({ ...sesionHoy, estado: nuevoEstado })
    } else {
      const { data } = await supabase.from('taller_sesiones')
        .insert({ taller_id: tallerModal.tallerRealId, fecha: tallerModal.fecha, estado: nuevoEstado })
        .select().single()
      if (data) setSesionHoy(data)
    }
    setGuardandoSesion(false)
  }

  function abrirModal(clase: any) {
    if (clase.esTaller) {
      if (clase.estado === 'programada') return  // blocked — not yet confirmed by admin
      abrirTaller(clase); return
    }
    setClaseActiva(clase)
    setResumen(clase.observaciones || '')
    setPantallaModal('acciones')
  }

  function cerrarModal() {
    setClaseActiva(null); setResumen(''); setPantallaModal('acciones'); setAvisoCancelacion('')
    if (vista === 'hoy') cargarHoy(); else cargarHistorial()
  }

  function buildDocContent() {
    const [anio, mesNum] = mes.split('-')
    const mesLabel = `${MESES_NOMBRE[parseInt(mesNum)-1]} ${anio}`
    const clasesDadas = clases.filter(c => (c.estado === 'dada' && !c.es_cortesia) || (c.estado === 'cancelada' && !c.cancelado_por_academia))
    const totalHon = clasesDadas.reduce((s, c) => { const h = getHonorario(c); return h === 'pendiente' ? s : s + h }, 0)
    const filas = clasesDadas.map(c => {
      const hon = getHonorario(c)
      const honLabel = hon === 'pendiente' ? 'Pendiente' : `$${Number(hon).toLocaleString('es-CO')}`
      const tipoLabel = (c.estado === 'cancelada' && !c.cancelado_por_academia) ? 'Inasistencia' : 'Dada'
      const numLabel = c.numero_calculado && c.contratos?.total_clases ? ` (${c.numero_calculado}/${c.contratos.total_clases})` : ''
      return `
        <tr>
          <td>${c.fecha?.substring(8,10)}/${c.fecha?.substring(5,7)}</td>
          <td>${formatHoraAmPm(c.hora)}</td>
          <td>${nombreCliente(c)}${numLabel}</td>
          <td>${c.contratos?.instrumentos?.nombre || '—'}</td>
          <td>${c.duracion_min} min</td>
          <td>${tipoLabel}</td>
          <td style="font-weight:600">${honLabel}</td>
        </tr>
        ${c.observaciones ? `<tr><td colspan="7" style="padding:0 12px 10px"><div style="background:#f8fafc;border-left:3px solid #b2d8d8;padding:8px 12px;font-size:12px;color:#555;line-height:1.6">📝 ${c.observaciones.replace(/\n/g,' | ')}</div></td></tr>` : ''}
      `
    }).join('')
    return { mesLabel, totalHon, filas, clasesDadas }
  }

  function descargarPDF() {
    const { mesLabel, totalHon, filas } = buildDocContent()
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Honorarios ${mesLabel}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;padding:40px;color:#1a1a1a;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;border-bottom:3px solid #1a8a8a;padding-bottom:20px}
.logo h1{font-size:22px;color:#1a8a8a;font-weight:800}.logo p{color:#666;font-size:12px;margin-top:4px}
.info{text-align:right}.info h2{font-size:16px;font-weight:700}.info p{color:#555;font-size:12px;margin-top:3px}
table{width:100%;border-collapse:collapse;margin-top:20px}thead tr{background:#e8f5f5}
th{padding:10px 12px;text-align:left;font-size:11px;color:#1a8a8a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px}
td{padding:9px 12px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.total{background:#e8f5f5;font-weight:700}.total td{padding:14px 12px;font-size:15px;color:#1a8a8a;border-top:2px solid #1a8a8a}
.footer{margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px;font-size:11px;color:#aaa;display:flex;justify-content:space-between}
@media print{@page{margin:20mm}body{padding:0}}</style>
</head><body>
<div class="header"><div class="logo"><h1>Academia Ruby Salamanca</h1><p>Cuenta de cobro de honorarios</p></div>
<div class="info"><h2>${profesor?.nombre}</h2><p>${mesLabel.charAt(0).toUpperCase()+mesLabel.slice(1)}</p><p>Generado: ${new Date().toLocaleDateString('es-CO')}</p></div></div>
<table><thead><tr><th>Fecha</th><th>Hora</th><th>Estudiante</th><th>Instrumento</th><th>Duración</th><th>Tipo</th><th>Honorario</th></tr></thead>
<tbody>${filas||'<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">Sin clases este mes</td></tr>'}
<tr class="total"><td colspan="6">TOTAL HONORARIOS ${mesLabel.toUpperCase()}</td><td>$${totalHon.toLocaleString('es-CO')}</td></tr></tbody></table>
<div class="footer"><span>Academia Ruby Salamanca</span><span>Portal del profesor</span></div>
</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Honorarios_${profesor?.nombre?.replace(/ /g,'_')}_${mes}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarWord() {
    const { mesLabel, totalHon, filas } = buildDocContent()
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='UTF-8'><title>Honorarios ${mesLabel}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a}
h1{font-size:18pt;color:#1a8a8a}h2{font-size:14pt}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6pt 8pt;font-size:10pt}
thead{background:#e8f5f5}th{color:#1a8a8a;font-weight:bold;text-transform:uppercase;font-size:8pt}
.total{background:#e8f5f5;font-weight:bold;color:#1a8a8a;font-size:12pt}</style></head>
<body>
<h1>Academia Ruby Salamanca</h1><p>Cuenta de cobro de honorarios</p><br>
<h2>${profesor?.nombre}</h2>
<p>${mesLabel.charAt(0).toUpperCase()+mesLabel.slice(1)} &nbsp;·&nbsp; Generado: ${new Date().toLocaleDateString('es-CO')}</p><br>
<table><thead><tr><th>Fecha</th><th>Hora</th><th>Estudiante</th><th>Instrumento</th><th>Duración</th><th>Tipo</th><th>Honorario</th></tr></thead>
<tbody>${filas||'<tr><td colspan="7">Sin clases este mes</td></tr>'}
<tr class="total"><td colspan="6">TOTAL HONORARIOS ${mesLabel.toUpperCase()}</td><td>$${totalHon.toLocaleString('es-CO')}</td></tr></tbody></table>
</body></html>`
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Honorarios_${profesor?.nombre?.replace(/ /g,'_')}_${mes}.doc`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (cargandoAuth) return (
    <div style={{ position:'fixed', inset:0, background:TEAL, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width:'36px', height:'36px', border:'3px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!sesion) return (
    <div style={{ position:'fixed', inset:0, background:`linear-gradient(150deg,${TEAL} 0%,#0d5f5f 100%)`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px', boxSizing:'border-box' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .li:focus{border-color:${TEAL}!important;box-shadow:0 0 0 3px ${TEAL}33!important;outline:none!important;}`}</style>
      <div style={{ width:'100%', maxWidth:'360px', animation:'fadeUp 0.4s ease' }}>
        <div style={{ textAlign:'center', marginBottom:'40px' }}>
          <img src="/apple-touch-icon.png" alt="Logo" style={{ width:'88px', height:'88px', borderRadius:'28px', margin:'0 auto 18px', display:'block', objectFit:'contain', background:'white', padding:'6px', boxSizing:'border-box' }} />
          <h1 style={{ margin:0, color:'white', fontSize:'28px', fontWeight:'800', letterSpacing:'-0.5px' }}>Academia Ruby</h1>
          <p style={{ margin:'8px 0 0', color:'rgba(255,255,255,0.6)', fontSize:'13px', fontWeight:'500', letterSpacing:'0.5px' }}>PORTAL DEL PROFESOR</p>
        </div>
        <div style={{ background:'white', borderRadius:'24px', padding:'32px', boxShadow:'0 24px 80px rgba(0,0,0,0.3)' }}>
          <div style={{ marginBottom:'18px' }}>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'800', color:'#6b7280', marginBottom:'8px', letterSpacing:'1px' }}>CORREO ELECTRÓNICO</label>
            <input className="li" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && login()}
              style={{ width:'100%', padding:'14px 16px', border:'2px solid #e5e7eb', borderRadius:'12px', fontSize:'15px', boxSizing:'border-box', fontFamily:'inherit', background:'white', color:'#1f2937' }} placeholder="nombre@email.com" />
          </div>
          <div style={{ marginBottom:'24px' }}>
            <label style={{ display:'block', fontSize:'11px', fontWeight:'800', color:'#6b7280', marginBottom:'8px', letterSpacing:'1px' }}>CONTRASEÑA</label>
            <input className="li" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key==='Enter' && login()}
              style={{ width:'100%', padding:'14px 16px', border:'2px solid #e5e7eb', borderRadius:'12px', fontSize:'15px', boxSizing:'border-box', fontFamily:'inherit', background:'white', color:'#1f2937' }} placeholder="••••••••" />
          </div>
          {loginError && <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'10px', padding:'11px 14px', marginBottom:'18px', color:'#dc2626', fontSize:'13px', fontWeight:'600', textAlign:'center' }}>{loginError}</div>}
          <button onClick={login} disabled={loginCargando}
            style={{ width:'100%', padding:'15px', background:loginCargando ? TEAL_MID : TEAL, color:'white', border:'none', borderRadius:'12px', fontSize:'16px', fontWeight:'700', cursor:loginCargando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
            {loginCargando ? 'Entrando...' : 'Entrar →'}
          </button>
        </div>
      </div>
    </div>
  )

  if (!profesor) return (
    <div style={{ position:'fixed', inset:0, background:'#f8fafc', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px', textAlign:'center', gap:'14px' }}>
      <div style={{ fontSize:'52px' }}>🔍</div>
      <p style={{ color:'#1f2937', fontSize:'17px', fontWeight:'700', margin:0 }}>Cuenta no vinculada</p>
      <p style={{ color:'#6b7280', fontSize:'14px', margin:0, lineHeight:'1.6', maxWidth:'280px' }}>Tu correo no está registrado como profesor. Contacta al administrador.</p>
      <button onClick={() => supabase.auth.signOut()}
        style={{ marginTop:'10px', padding:'12px 28px', background:TEAL, color:'white', border:'none', borderRadius:'12px', cursor:'pointer', fontSize:'14px', fontWeight:'600', fontFamily:'inherit' }}>
        Cerrar sesión
      </button>
    </div>
  )

  const dadas           = clases.filter(c => c.estado === 'dada')
  const pendientesCobro = clases.filter(c => c.estado === 'cancelada' && !c.cancelado_por_academia).length
  const totalHon        = dadas.reduce((s, c) => { const h = getHonorario(c); return h === 'pendiente' ? s : s + h }, 0)
  const hayAtrasadas    = clases.some(c => c.esAtrasada)
  const claseAtrasada   = clases.find(c => c.esAtrasada)

  return (
    <div style={{ position:'fixed', inset:0, background:'#f8fafc', display:'flex', justifyContent:'center' }}>
      <style>{`
        @keyframes fadeUp  {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp {from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn  {from{opacity:0}to{opacity:1}}
        .tc:active{transform:scale(0.98);}
        .ba:active{transform:scale(0.97);}
        textarea:focus{border-color:${TEAL}!important;outline:none!important;box-shadow:0 0 0 3px ${TEAL}22!important;}
      `}</style>

      <div style={{ width:'100%', maxWidth:'480px', height:'100%', display:'flex', flexDirection:'column', background:'#f8fafc' }}>

        <div style={{ background:TEAL, padding:'18px 20px 0', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <img src="/Logo_RubySalamanca.png" alt="Ruby Salamanca"
                style={{ height:'36px', objectFit:'contain', filter:'brightness(0) invert(1)', opacity:0.9 }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ color:'rgba(255,255,255,0.8)', fontSize:'14px', fontWeight:'600' }}>{profesor.nombre.split(' ')[0]}</span>
              <button onClick={() => supabase.auth.signOut()}
                style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'rgba(255,255,255,0.85)', padding:'7px 13px', borderRadius:'20px', cursor:'pointer', fontSize:'12px', fontWeight:'700', fontFamily:'inherit' }}>
                Salir
              </button>
            </div>
          </div>
          <div style={{ display:'flex', gap:'3px' }}>
            {([
              { key:'hoy',       label: etiquetaSemana() },
              { key:'historial', label: '📋 Historial' },
            ] as const).map(v => (
              <button key={v.key} onClick={() => setVista(v.key)}
                style={{ flex:1, padding:'11px 4px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'700', borderRadius:'12px 12px 0 0', background:vista===v.key ? 'white' : 'transparent', color:vista===v.key ? TEAL : 'rgba(255,255,255,0.65)', transition:'all 0.2s', fontFamily:'inherit' }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'16px' }}>

          {exito && (
            <div style={{ background:'#dcfce7', border:'1px solid #86efac', borderRadius:'14px', padding:'13px 16px', marginBottom:'14px', color:'#166534', fontSize:'14px', fontWeight:'700', textAlign:'center', animation:'fadeUp 0.3s ease' }}>
              ✓ {exito}
            </div>
          )}

          {vista === 'hoy' && (
            <div style={{ animation:'fadeUp 0.3s ease' }}>
              {cargandoClases && <p style={{ textAlign:'center', color:'#9ca3af', padding:'50px 0' }}>Cargando...</p>}
              {!cargandoClases && clases.length === 0 && (
                <div style={{ textAlign:'center', padding:'70px 20px', color:'#9ca3af' }}>
                  <div style={{ fontSize:'44px', marginBottom:'12px' }}>🎵</div>
                  <p style={{ fontSize:'15px', fontWeight:'700', margin:'0 0 6px', color:'#6b7280' }}>Sin clases esta semana</p>
                </div>
              )}
              {(() => {
                let fechaAnterior: string | null = null
                return clases.map((c, i) => {
                  const mostrarSep = c.fecha !== fechaAnterior
                  fechaAnterior = c.fecha
                  const { texto, esHoy, esAtras } = labelDiaSemana(c.fecha)
                  return (
                    <div key={c.id}>
                      {mostrarSep && (
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', margin: i===0 ? '0 0 10px' : '20px 0 10px' }}>
                          <span style={{ fontSize:'13px', fontWeight:'800', color: esHoy ? TEAL : esAtras ? '#dc2626' : '#374151', whiteSpace:'nowrap', textTransform:'capitalize' }}>
                            {texto}
                          </span>
                          <div style={{ flex:1, height:'1px', background:'#e5e7eb' }} />
                        </div>
                      )}
                      <TarjetaClase c={c} i={i} onTap={() => abrirModal(c)}
                        resumenExpandido={resumenExpandido} setResumenExpandido={setResumenExpandido}
                        honorario={getHonorario(c)} mostrarHonorario={false} mostrarFecha={false} />
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {vista === 'historial' && (
            <div style={{ animation:'fadeUp 0.3s ease' }}>
              <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                style={{ width:'100%', padding:'13px 16px', border:`2px solid ${TEAL_MID}`, borderRadius:'14px', fontSize:'15px', fontWeight:'700', color:TEAL, background:'white', boxSizing:'border-box', marginBottom:'14px', fontFamily:'inherit' }} />
              {!cargandoClases && clases.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                  <div style={{ background:'#dcfce7', borderRadius:'14px', padding:'14px', textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:'24px', fontWeight:'800', color:'#166534', lineHeight:1 }}>{dadas.length}</p>
                    <p style={{ margin:'4px 0 0', fontSize:'10px', fontWeight:'700', color:'#166534', letterSpacing:'0.3px' }}>CLASES DADAS</p>
                  </div>
                  <div style={{ background:pendientesCobro > 0 ? '#fff7ed' : '#f1f5f9', borderRadius:'14px', padding:'14px', textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:'24px', fontWeight:'800', color:pendientesCobro > 0 ? '#c2410c' : '#9ca3af', lineHeight:1 }}>{pendientesCobro}</p>
                    <p style={{ margin:'4px 0 0', fontSize:'10px', fontWeight:'700', color:pendientesCobro > 0 ? '#c2410c' : '#9ca3af', letterSpacing:'0.3px' }}>INASISTENCIAS</p>
                  </div>
                  <div style={{ gridColumn:'1 / -1', background:TEAL_LIGHT, borderRadius:'14px', padding:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <p style={{ margin:0, fontSize:'11px', fontWeight:'700', color:TEAL, letterSpacing:'0.5px' }}>HONORARIOS CONFIRMADOS</p>
                      {pendientesCobro > 0 && <p style={{ margin:'3px 0 0', fontSize:'11px', color:'#c2410c', fontWeight:'600' }}>+ {pendientesCobro} inasistencia(s)</p>}
                    </div>
                    <p style={{ margin:0, fontSize:'28px', fontWeight:'800', color:TEAL, letterSpacing:'-1px' }}>${totalHon.toLocaleString('es-CO')}</p>
                  </div>
                </div>
              )}
              {!cargandoClases && clases.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
                  <button onClick={descargarPDF}
                    style={{ padding:'13px', background:TEAL, color:'white', border:'none', borderRadius:'14px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                    🖨️ Descargar PDF
                  </button>
                  <button onClick={descargarWord}
                    style={{ padding:'13px', background:'#1d4ed8', color:'white', border:'none', borderRadius:'14px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                    📄 Descargar Word
                  </button>
                </div>
              )}
              {cargandoClases && <p style={{ textAlign:'center', color:'#9ca3af', padding:'50px 0' }}>Cargando...</p>}
              {!cargandoClases && clases.length === 0 && <p style={{ textAlign:'center', color:'#9ca3af', padding:'40px 0' }}>Sin clases este mes</p>}
              {clases.map((c, i) => (
                <TarjetaClase key={c.id} c={c} i={i} onTap={() => abrirModal(c)}
                  resumenExpandido={resumenExpandido} setResumenExpandido={setResumenExpandido}
                  honorario={getHonorario(c)} mostrarHonorario={true} mostrarFecha={true} />
              ))}
            </div>
          )}
        </div>
      </div>

      {tallerModal && (
        <div onClick={e => e.target === e.currentTarget && setTallerModal(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200, animation:'fadeIn 0.2s ease' }}>
          <div style={{ width:'100%', maxWidth:'480px', background:'white', borderRadius:'28px 28px 0 0', padding:'20px 20px 36px', animation:'slideUp 0.3s ease', maxHeight:'88vh', overflow:'auto' }}>
            <div style={{ width:'44px', height:'5px', background:'#e5e7eb', borderRadius:'3px', margin:'0 auto 22px' }} />
            <div style={{ background:'#f3e8ff', borderRadius:'16px', padding:'16px', marginBottom:'20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <p style={{ margin:'0 0 6px', fontSize:'18px', fontWeight:'800', color:'#7c3aed' }}>🎸 {tallerModal.nombreTaller}</p>
                  <div style={{ display:'inline-block', background:'#7c3aed', color:'white', padding:'4px 12px', borderRadius:'20px', fontSize:'13px', fontWeight:'700', marginBottom:'6px' }}>
                    📍 {tallerModal.salones?.sedes?.nombre || '—'}
                  </div>
                  <p style={{ margin:0, fontSize:'13px', color:'#6b5b95' }}>
                    🏠 {tallerModal.salones?.nombre} · {formatHoraAmPm(tallerModal.hora)} · {tallerModal.duracion_min} min
                  </p>
                  <p style={{ margin:'4px 0 0', fontSize:'13px', color:'#6b5b95', textTransform:'capitalize' }}>
                    📅 {labelDiaSemana(tallerModal.fecha).texto}
                  </p>
                </div>
                <button onClick={() => setTallerModal(null)}
                  style={{ width:'34px', height:'34px', border:'none', background:'rgba(124,58,237,0.15)', borderRadius:'50%', cursor:'pointer', fontSize:'18px', color:'#7c3aed', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit' }}>×</button>
              </div>
            </div>
            <div style={{ background:'#fafbfc', borderRadius:'14px', padding:'14px', marginBottom:'20px', border:'1px solid #f1f5f9' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <p style={{ margin:0, fontSize:'13px', fontWeight:'700', color:'#555' }}>Sesión de hoy</p>
                <span style={{ padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700',
                  background: sesionHoy?.estado === 'dada' ? '#fefce8' : sesionHoy?.estado === 'cancelada' ? '#fee2e2' : sesionHoy?.estado === 'confirmada' ? '#dcfce7' : '#f3f4f6',
                  color: sesionHoy?.estado === 'dada' ? '#854d0e' : sesionHoy?.estado === 'cancelada' ? '#991b1b' : sesionHoy?.estado === 'confirmada' ? '#166534' : '#6b7280' }}>
                  {sesionHoy?.estado || 'programada'}
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {(!sesionHoy?.estado || sesionHoy.estado === 'programada') && (
                  <div style={{ padding:'14px', background:'#f3f4f6', borderRadius:'14px', fontSize:'14px', color:'#6b7280', fontWeight:'600', textAlign:'center' }}>
                    ⏳ Taller aún no confirmado por el administrador
                  </div>
                )}
                {sesionHoy?.estado === 'confirmada' && (<>
                  <button className="ba" onClick={() => {
                    const hay = Object.values(asistenciasTaller).some(v => v === true)
                    if (!hay) { alert('Selecciona al menos un asistente antes de marcar el taller como dado'); return }
                    marcarSesionTaller('dada')
                  }} disabled={guardandoSesion}
                    style={{ padding:'14px', background:'#7c3aed', color:'white', border:'none', borderRadius:'14px', fontSize:'15px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>
                    ✓ Marcar dado
                  </button>
                  <button className="ba" onClick={() => {
                    const hay = Object.values(asistenciasTaller).some(v => v === true)
                    if (hay) { alert('Hay asistentes seleccionados. Desmárcalos primero si ninguno asistió.'); return }
                    if (window.confirm('¿Confirmar que ningún inscrito asistió a esta sesión?')) marcarSesionTaller('dada')
                  }} disabled={guardandoSesion}
                    style={{ padding:'14px', background:'white', color:'#6b7280', border:'1px solid #e5e7eb', borderRadius:'14px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    Ningún inscrito asistió
                  </button>
                </>)}
                {sesionHoy?.estado === 'dada' && (
                  <div style={{ padding:'14px', background:'#fefce8', color:'#854d0e', border:'2px solid #fde68a', borderRadius:'14px', fontSize:'15px', fontWeight:'800', textAlign:'center' }}>✓ Dado</div>
                )}
                {sesionHoy?.estado === 'confirmada' && (
                  <button className="ba" onClick={() => {
                    const h2 = tallerModal?.hora || '00:00'
                    const claseDate = new Date(tallerModal.fecha + 'T' + h2.substring(0,5) + ':00')
                    const mins = Math.floor((claseDate.getTime() - Date.now()) / 60000)
                    const msg = mins >= 0 && mins < 180
                      ? '⚠️ Aviso tardío — quedan menos de 3 horas. Se notificará a la asistente para reasignar.'
                      : 'Se notificará a la asistente para reasignar el taller a otro profesor.'
                    if (window.confirm(msg)) marcarSesionTaller('cancelada')
                  }} disabled={guardandoSesion}
                    style={{ padding:'14px', background:'#fff7ed', color:'#c2410c', border:'2px solid #fed7aa', borderRadius:'14px', fontSize:'15px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>
                    No puedo asistir
                  </button>
                )}
                {sesionHoy?.estado === 'cancelada' && (
                  <div style={{ padding:'14px', background:'#fee2e2', color:'#991b1b', border:'2px solid #fecaca', borderRadius:'14px', fontSize:'14px', fontWeight:'700', textAlign:'center' }}>
                    ✗ Aviso enviado — la asistente reasignará el taller
                  </div>
                )}
              </div>
            </div>
            {(sesionHoy?.estado === 'dada' || sesionHoy?.estado === 'confirmada') && (
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block', fontSize:'13px', fontWeight:'700', color:'#374151', marginBottom:'6px' }}>
                  Resumen de la sesión
                </label>
                <textarea value={resumenTaller} onChange={e => setResumenTaller(e.target.value)}
                  placeholder="Descripción de lo trabajado en esta sesión..."
                  rows={3} style={{ width:'100%', padding:'10px 12px', border:'1px solid #e5e7eb', borderRadius:'10px', fontSize:'14px', fontFamily:'inherit', resize:'vertical', lineHeight:1.5, boxSizing:'border-box' as const }} />
                {sesionHoy?.id && (
                  <button onClick={async () => {
                    await supabase.from('taller_sesiones').update({ observaciones: resumenTaller.trim() || null }).eq('id', sesionHoy.id)
                    setSesionHoy((prev: any) => ({ ...prev, observaciones: resumenTaller.trim() || null }))
                  }} style={{ marginTop:'6px', padding:'9px 18px', background: '#7c3aed', color:'white', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                    Guardar resumen
                  </button>
                )}
              </div>
            )}
            <p style={{ margin:'0 0 10px', fontSize:'14px', fontWeight:'700', color:'#374151' }}>
              Inscritos esta sesión <span style={{ color:'#7c3aed' }}>({inscritosTaller.length})</span>
            </p>
            {(sesionHoy?.estado === 'dada' || sesionHoy?.estado === 'confirmada') && (
              <p style={{ fontSize:'12px', color:'#9ca3af', marginBottom:'8px', fontStyle:'italic' }}>Selecciona los estudiantes que asistieron a esta sesión</p>
            )}
            {inscritosTaller.length === 0
              ? <p style={{ textAlign:'center', color:'#9ca3af', fontSize:'13px', padding:'16px 0' }}>Sin inscritos esta sesión</p>
              : inscritosTaller.map((ins: any, i) => {
                  const cl = ins.clientes
                  const nombre = cl?.nombre || `${cl?.nombres||''} ${cl?.apellidos||''}`.trim() || '—'
                  const asistio = asistenciasTaller[ins.id]
                  const puedeMarcar = sesionHoy?.id && (sesionHoy.estado === 'dada' || sesionHoy.estado === 'confirmada')
                  return (
                    <div key={ins.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', background: i%2===0 ? '#fafbfc' : 'white', borderRadius:'10px', marginBottom:'4px' }}>
                      <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#f3e8ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'700', color:'#7c3aed', flexShrink:0 }}>
                        {nombre.charAt(0).toUpperCase()}
                      </div>
                      <p style={{ margin:0, fontSize:'14px', fontWeight:'600', color:'#1f2937', flex:1 }}>{nombre}</p>
                      {puedeMarcar ? (
                        <button onClick={() => toggleAsistTaller(ins.id, asistio === true ? null : true)} disabled={guardandoAsistTaller}
                          style={{ width:'36px', height:'36px', borderRadius:'8px', border: asistio === true ? '2px solid #166534' : '1px solid #e5e7eb', background: asistio === true ? '#dcfce7' : 'white', color: asistio === true ? '#166534' : '#aaa', fontSize:'18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {asistio === true ? '✓' : ''}
                        </button>
                      ) : (
                        <span style={{ fontSize:'13px', fontWeight:'600', color: asistio === true ? '#166534' : '#aaa' }}>
                          {asistio === true ? '✓ Asistió' : '—'}
                        </span>
                      )}
                    </div>
                  )
                })
            }
          </div>
        </div>
      )}

      {claseActiva && (
        <div onClick={e => e.target === e.currentTarget && cerrarModal()}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200, animation:'fadeIn 0.2s ease' }}>
          <div style={{ width:'100%', maxWidth:'480px', background:'white', borderRadius:'28px 28px 0 0', padding:'20px 20px 36px', animation:'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight:'92vh', overflow:'auto' }}>
            <div style={{ width:'44px', height:'5px', background:'#e5e7eb', borderRadius:'3px', margin:'0 auto 22px' }} />

            {pantallaModal === 'avisoTardia' && (
              <div style={{ textAlign:'center', padding:'10px 0' }}>
                <div style={{ fontSize:'52px', marginBottom:'16px' }}>⏰</div>
                <p style={{ fontSize:'18px', fontWeight:'800', color:'#dc2626', margin:'0 0 12px' }}>Cancelación tardía</p>
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'14px', padding:'16px', marginBottom:'24px', textAlign:'left' }}>
                  <p style={{ fontSize:'14px', color:'#991b1b', margin:0, lineHeight:'1.6' }}>{avisoCancelacion}</p>
                </div>
                <button className="ba" onClick={cerrarModal}
                  style={{ width:'100%', padding:'16px', background:TEAL, color:'white', border:'none', borderRadius:'16px', fontSize:'16px', fontWeight:'800', cursor:'pointer', fontFamily:'inherit' }}>
                  Entendido
                </button>
              </div>
            )}

            {pantallaModal === 'inasistencia' && (
              <div>
                <div style={{ background:'#fff7ed', borderRadius:'16px', padding:'16px', marginBottom:'20px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:'18px', fontWeight:'800', color:'#c2410c' }}>Estudiante no asistió</p>
                  <p style={{ margin:0, fontSize:'14px', color:'#92400e' }}>{nombreCliente(claseActiva)} · {formatHoraAmPm(claseActiva.hora)}</p>
                </div>
                <p style={{ fontSize:'14px', fontWeight:'700', color:'#374151', margin:'0 0 12px' }}>¿Cuánto te corresponde de honorario?</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'16px' }}>
                  <button className="ba" onClick={() => marcarInasistencia(100)} disabled={guardando}
                    style={{ padding:'24px 12px', background:'#dcfce7', color:'#166534', border:'2px solid #86efac', borderRadius:'16px', cursor:guardando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                    <p style={{ margin:0, fontSize:'28px', fontWeight:'800' }}>100%</p>
                  </button>
                  <button className="ba" onClick={() => marcarInasistencia(50)} disabled={guardando}
                    style={{ padding:'24px 12px', background:'#fefce8', color:'#854d0e', border:'2px solid #fde68a', borderRadius:'16px', cursor:guardando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                    <p style={{ margin:0, fontSize:'28px', fontWeight:'800' }}>50%</p>
                  </button>
                </div>
                <button onClick={() => setPantallaModal('acciones')} disabled={guardando}
                  style={{ width:'100%', padding:'13px', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:'14px', fontSize:'14px', cursor:'pointer', fontFamily:'inherit' }}>
                  ← Volver
                </button>
              </div>
            )}

            {pantallaModal === 'cancelar' && (
              <div>
                <div style={{ background:'#fef2f2', borderRadius:'16px', padding:'16px', marginBottom:'20px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:'18px', fontWeight:'800', color:'#dc2626' }}>Cancelar clase</p>
                  <p style={{ margin:0, fontSize:'14px', color:'#991b1b' }}>{nombreCliente(claseActiva)} · {formatHoraAmPm(claseActiva.hora)}</p>
                </div>
                {(() => {
                  const minutos  = minutosParaClase(claseActiva.fecha, claseActiva.hora)
                  const esTardia = minutos < 180
                  return (
                    <div style={{ background: esTardia ? '#fff7ed' : '#f0fdf4', border:`1px solid ${esTardia ? '#fed7aa' : '#86efac'}`, borderRadius:'12px', padding:'14px', marginBottom:'20px' }}>
                      <p style={{ margin:'0 0 4px', fontSize:'14px', fontWeight:'700', color: esTardia ? '#c2410c' : '#166534' }}>
                        {esTardia ? '⚠️ Cancelación tardía' : '✓ Cancelación a tiempo'}
                      </p>
                      <p style={{ margin:0, fontSize:'13px', color: esTardia ? '#92400e' : '#166634' }}>
                        {esTardia
                          ? `Faltan menos de 3 horas. Quedará una nota de posible clase de cortesía.`
                          : 'Faltan más de 3 horas. Sin consecuencias.'}
                      </p>
                    </div>
                  )
                })()}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <button className="ba" onClick={cancelarClase} disabled={guardando}
                    style={{ padding:'16px', background:'#dc2626', color:'white', border:'none', borderRadius:'16px', fontSize:'15px', fontWeight:'800', cursor:guardando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                    {guardando ? '...' : 'Confirmar'}
                  </button>
                  <button onClick={() => setPantallaModal('acciones')} disabled={guardando}
                    style={{ padding:'16px', background:'#f1f5f9', color:'#374151', border:'none', borderRadius:'16px', fontSize:'15px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
                    Volver
                  </button>
                </div>
              </div>
            )}

            {pantallaModal === 'acciones' && (
              <>
                <div style={{ background:TEAL_LIGHT, borderRadius:'16px', padding:'16px', marginBottom:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <div>
                      <p style={{ margin:'0 0 2px', fontSize:'13px', fontWeight:'700', color: claseActiva.esAtrasada ? '#dc2626' : '#6b7280', textTransform:'capitalize' }}>
                        📅 {labelDiaSemana(claseActiva.fecha).texto}
                      </p>
                      <p style={{ margin:'0 0 3px', fontSize:'22px', fontWeight:'800', color:'#111', letterSpacing:'-0.5px', lineHeight:1 }}>
                        {formatHoraAmPm(claseActiva.hora)} <span style={{ fontSize:'14px', color:'#6b7280', fontWeight:'500' }}>· {claseActiva.duracion_min} min</span>
                      </p>
                      <p style={{ margin:'3px 0 2px', fontSize:'16px', fontWeight:'700', color:'#1f2937' }}>{nombreCliente(claseActiva)}</p>
                      <p style={{ margin:0, fontSize:'13px', color:'#4b5563' }}>🎵 {claseActiva.contratos?.instrumentos?.nombre || '—'}</p>
                    </div>
                    <button onClick={cerrarModal}
                      style={{ width:'34px', height:'34px', border:'none', background:'rgba(0,0,0,0.08)', borderRadius:'50%', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#374151', fontFamily:'inherit' }}>×</button>
                  </div>
                  <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                    <div style={{ background:TEAL, color:'white', padding:'5px 12px', borderRadius:'20px', fontSize:'13px', fontWeight:'700' }}>
                      📍 {claseActiva.salones?.sedes?.nombre || '—'}
                    </div>
                    <div style={{ background:'rgba(0,0,0,0.08)', color:'#374151', padding:'5px 12px', borderRadius:'20px', fontSize:'13px', fontWeight:'600' }}>
                      🏠 {claseActiva.salones?.nombre || '—'}
                    </div>
                  </div>
                </div>

                {claseActiva.estado === 'cancelada' && !claseActiva.cancelado_por_academia && (
                  <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'12px', padding:'11px 14px', marginBottom:'18px', fontSize:'13px', color:'#c2410c', fontWeight:'600' }}>
                    ⚠️ Inasistencia registrada
                  </div>
                )}

                {claseActiva.estado !== 'programada' && (
                  <div style={{ marginBottom:'20px' }}>
                    <label style={{ display:'block', fontSize:'11px', fontWeight:'800', color:'#6b7280', marginBottom:'8px', letterSpacing:'0.8px' }}>
                      RESUMEN DE LA CLASE <span style={{ fontWeight:'500', color:'#9ca3af' }}>— puedes completarlo después</span>
                    </label>
                    <textarea value={resumen} onChange={e => setResumen(e.target.value)}
                      placeholder="Escribe aquí lo que se trabajó en la clase."
                      rows={4}
                      style={{ width:'100%', padding:'13px 14px', border:`2px solid ${TEAL_MID}`, borderRadius:'14px', fontSize:'14px', resize:'vertical', boxSizing:'border-box', fontFamily:'system-ui,-apple-system,sans-serif', lineHeight:'1.6', background:'white', color:'#1f2937', textAlign:'left', whiteSpace:'pre-wrap', transition:'border-color 0.2s' }} />
                  </div>
                )}

                {claseActiva.estado === 'confirmada' && vista === 'hoy' && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    <button className="ba" onClick={marcarDada}
                      disabled={guardando || (hayAtrasadas && !!claseActiva.esAtrasada === false)}
                      style={{ padding:'18px', background:TEAL, color:'white', border:'none', borderRadius:'16px', fontSize:'17px', fontWeight:'800', cursor: guardando || (hayAtrasadas && !claseActiva.esAtrasada) ? 'not-allowed' : 'pointer', opacity: guardando || (hayAtrasadas && !claseActiva.esAtrasada) ? 0.35 : 1, fontFamily:'inherit' }}>
                      ✓ Clase dada
                    </button>
                    {hayAtrasadas && !claseActiva.esAtrasada && claseAtrasada && (
                      <p style={{ margin:'-4px 0 0', fontSize:'12px', color:'#dc2626', fontWeight:'600', textAlign:'center' }}>
                        Resuelve primero la clase del {claseAtrasada.fecha}
                      </p>
                    )}
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                      <button className="ba" onClick={() => setPantallaModal('inasistencia')} disabled={guardando}
                        style={{ padding:'16px', background:'#fff7ed', color:'#c2410c', border:'2px solid #fed7aa', borderRadius:'16px', fontSize:'15px', fontWeight:'800', cursor:guardando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                        ✗ No asistió
                      </button>
                      <button className="ba" onClick={() => setPantallaModal('cancelar')} disabled={guardando}
                        style={{ padding:'16px', background:'#fef2f2', color:'#dc2626', border:'2px solid #fecaca', borderRadius:'16px', fontSize:'15px', fontWeight:'800', cursor:guardando ? 'not-allowed' : 'pointer', fontFamily:'inherit' }}>
                        ✕ Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {(claseActiva.estado === 'dada' || claseActiva.estado === 'cancelada') && (
                  <>
                    {!claseActiva.observaciones && (
                      <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'10px', padding:'10px 14px', marginBottom:'12px', fontSize:'13px', color:'#c2410c', fontWeight:'600' }}>
                        📝 Esta clase no tiene resumen aún
                      </div>
                    )}
                    <button className="ba" onClick={guardarResumen} disabled={guardando}
                      style={{ width:'100%', padding:'16px', background:TEAL, color:'white', border:'none', borderRadius:'16px', fontSize:'16px', fontWeight:'800', cursor:guardando ? 'not-allowed' : 'pointer', opacity:guardando ? 0.7 : 1, fontFamily:'inherit' }}>
                      {guardando ? 'Guardando...' : '💾 Guardar resumen'}
                    </button>
                  </>
                )}

                {claseActiva.estado === 'programada' && (
                  <p style={{ textAlign:'center', color:'#9ca3af', fontSize:'13px', margin:0, fontStyle:'italic' }}>
                    Clase aún no confirmada — sin acciones disponibles
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaClase({ c, i, onTap, resumenExpandido, setResumenExpandido, honorario, mostrarHonorario, mostrarFecha }: {
  c: any, i: number, onTap: () => void,
  resumenExpandido: string | null,
  setResumenExpandido: (id: string | null) => void,
  honorario: number | 'pendiente',
  mostrarHonorario: boolean,
  mostrarFecha: boolean
}) {
  const TEAL = '#1a8a8a'
  const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia
  const badge      = badgeEstado(c.estado, esInasistencia, c.esTaller)
  const confirmada = c.estado === 'confirmada' && !c.esTaller
  const expandido  = resumenExpandido === c.id
  const esProg     = c.estado === 'programada'
  const sinResumen = !c.esTaller && !c.observaciones && (c.estado === 'dada' || (c.estado === 'cancelada' && !c.cancelado_por_academia))

  const borderColor = c.esTaller ? '#7c3aed'
    : c.esAtrasada ? '#dc2626'
    : confirmada ? TEAL
    : '#e5e7eb'

  return (
    <div style={{
      background: esProg ? '#f8fafc' : 'white',
      borderRadius:'18px', padding:'16px', marginBottom:'12px',
      boxShadow: esProg ? '0 1px 4px rgba(0,0,0,0.04)' : '0 2px 12px rgba(0,0,0,0.06)',
      borderLeft:`4px solid ${borderColor}`,
      animation:`fadeUp ${0.1+i*0.03}s ease`,
      cursor: esProg ? 'default' : 'pointer',
      opacity: esProg ? 0.65 : 1
    }} onClick={esProg ? undefined : onTap}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'12px', marginBottom:'8px' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'22px', fontWeight:'800', color: esProg ? '#94a3b8' : '#111', letterSpacing:'-1px', lineHeight:1 }}>
              {mostrarFecha
                ? `${c.fecha?.substring(8,10)}/${c.fecha?.substring(5,7)}`
                : formatHoraAmPm(c.hora)}
            </span>
            {mostrarFecha && <span style={{ fontSize:'13px', color:'#9ca3af', fontWeight:'600' }}>{formatHoraAmPm(c.hora)}</span>}
            <span style={{ fontSize:'12px', color:'#9ca3af', fontWeight:'600' }}>{c.duracion_min} min</span>
          </div>
          <p style={{ margin:'0 0 4px', fontSize:'15px', fontWeight:'700', color: c.esTaller ? '#7c3aed' : esProg ? '#94a3b8' : '#1f2937', textAlign:'left' }}>
            {c.esTaller
              ? `🎸 ${c.nombreTaller}`
              : (c.contratos?.clientes?.nombre || `${c.contratos?.clientes?.nombres||''} ${c.contratos?.clientes?.apellidos||''}`.trim() || '—')}
          </p>
          {!c.esTaller && (
            <p style={{ margin:'0 0 4px', fontSize:'13px', color: esProg ? '#94a3b8' : '#6b7280', textAlign:'left' }}>
              🎸 {c.contratos?.instrumentos?.nombre || '—'}
            </p>
          )}
          {c.esAtrasada && (
            <p style={{ margin:'0 0 4px', fontSize:'12px', color:'#dc2626', fontWeight:'700' }}>
              ⚠️ Sin resultado — toca para resolver
            </p>
          )}
          {c.motivo_cancelacion && (
            <p style={{ margin:'0 0 4px', fontSize:'12px', color: c.motivo_cancelacion.includes('tardía') ? '#dc2626' : '#166534', fontWeight:'600' }}>
              {c.motivo_cancelacion.includes('tardía') ? '⏰' : '✓'} {c.motivo_cancelacion}
            </p>
          )}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            <span style={{ background: c.esTaller ? '#7c3aed' : esProg ? '#cbd5e1' : TEAL, color:'white', padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:'700' }}>
              📍 {c.salones?.sedes?.nombre || '—'}
            </span>
            <span style={{ background:'#f1f5f9', color: esProg ? '#94a3b8' : '#374151', padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:'600' }}>
              🏠 {c.salones?.nombre || '—'}
            </span>
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'6px' }}>
          <span style={{ padding:'4px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'700', background:badge.bg, color:badge.color, whiteSpace:'nowrap' }}>
            {badge.label}
          </span>
          {/* Conteo x/y — solo en historial (mostrarFecha=true) para clases dadas reales */}
          {mostrarFecha && !c.esTaller && !c.es_cortesia && c.numero_calculado && c.contratos?.total_clases && (
            <span style={{ fontSize:'12px', fontWeight:'800', color:TEAL, background:'#e8f5f5', padding:'2px 8px', borderRadius:'10px', whiteSpace:'nowrap' }}>
              {c.numero_calculado}/{c.contratos.total_clases}
            </span>
          )}
          {mostrarHonorario && !c.esTaller && (
            honorario === 'pendiente'
              ? <span style={{ fontSize:'11px', fontWeight:'700', color:'#c2410c', background:'#fff7ed', padding:'3px 8px', borderRadius:'10px', whiteSpace:'nowrap' }}>⏳ Pendiente</span>
              : (honorario as number) > 0
                ? <span style={{ fontSize:'14px', fontWeight:'800', color:TEAL }}>${Number(honorario).toLocaleString('es-CO')}</span>
                : null
          )}
          {confirmada && !mostrarHonorario && (
            <button onClick={e => { e.stopPropagation(); onTap() }}
              style={{ padding:'8px 14px', background:TEAL, color:'white', border:'none', borderRadius:'12px', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:'inherit' }}>
              Marcar →
            </button>
          )}
        </div>
      </div>

      {c.observaciones && (
        <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:'8px' }}>
          <button onClick={e => { e.stopPropagation(); setResumenExpandido(expandido ? null : c.id) }}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:TEAL, fontWeight:'700', padding:'2px 0', fontFamily:'inherit' }}>
            {expandido ? '▲ Ocultar resumen' : '▼ Ver resumen de la clase'}
          </button>
          {expandido && (
            <div style={{ marginTop:'8px', background:'#e8f5f5', borderRadius:'10px', padding:'10px 12px', fontSize:'13px', color:'#374151', lineHeight:'1.6', whiteSpace:'pre-wrap', textAlign:'left' }}>
              {c.observaciones}
            </div>
          )}
        </div>
      )}

      {sinResumen && (
        <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:'8px' }}>
          <button onClick={e => { e.stopPropagation(); onTap() }}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:'12px', color:'#c2410c', fontWeight:'700', padding:'2px 0', fontFamily:'inherit' }}>
            📝 Sin resumen — toca para agregar
          </button>
        </div>
      )}
    </div>
  )
}
