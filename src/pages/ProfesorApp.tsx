import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL       = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID   = '#b2d8d8'

const DIAS_SEMANA: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3,
  'jueves': 4, 'viernes': 5, 'sábado': 6
}

const MESES_NOMBRE = ['enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre']

function badgeEstado(estado: string, revisionPendiente?: boolean) {
  if (revisionPendiente) return { label: 'Inasistencia', bg: '#fff7ed', color: '#c2410c' }
  switch (estado) {
    case 'dada':       return { label: 'Dada ✓',    bg: '#dcfce7', color: '#166534' }
    case 'confirmada': return { label: 'Confirmada', bg: '#dbeafe', color: '#1e40af' }
    case 'programada': return { label: 'Programada', bg: '#f1f5f9', color: '#475569' }
    case 'cancelada':  return { label: 'Cancelada',  bg: '#fee2e2', color: '#991b1b' }
    default:           return { label: estado,       bg: '#f1f5f9', color: '#475569' }
  }
}

function nombreCliente(c: any) {
  const cl = c.contratos?.clientes
  if (!cl) return '—'
  return cl.nombre || `${cl.nombres || ''} ${cl.apellidos || ''}`.trim() || '—'
}

const SELECT_CLASES = [
  'id', 'fecha', 'hora', 'duracion_min', 'estado', 'modalidad',
  'revision_pendiente', 'observaciones', 'contrato_id', 'honorario_valor',
  'contratos(clientes(nombre, nombres, apellidos), instrumentos(nombre), duracion_min, clases_tomadas)',
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

  const [vista, setVista]                 = useState<'hoy' | 'talleres' | 'historial'>('hoy')
  const [clases, setClases]               = useState<any[]>([])
  const [cargandoClases, setCargandoClases] = useState(false)
  const [tarifas, setTarifas]             = useState<any[]>([])
  const [mes, setMes]                     = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
  })

  // Talleres
  const [talleres, setTalleres]           = useState<any[]>([])
  const [cargandoTalleres, setCargandoTalleres] = useState(false)
  const [tallerModal, setTallerModal]     = useState<any>(null)
  const [inscritosTaller, setInscritosTaller] = useState<any[]>([])
  const [sesionHoy, setSesionHoy]         = useState<any>(null)
  const [guardandoSesion, setGuardandoSesion] = useState(false)

  // Modal clase
  const [claseActiva, setClaseActiva]     = useState<any>(null)
  const [resumen, setResumen]             = useState('')
  const [guardando, setGuardando]         = useState(false)
  const [exito, setExito]                 = useState('')
  const [resumenExpandido, setResumenExpandido] = useState<string | null>(null)

  // ── Fondo global ──────────────────────────────────────
  useEffect(() => {
    document.body.style.background = '#f8fafc'
    document.body.style.margin = '0'
    document.body.style.padding = '0'
    return () => { document.body.style.background = '' }
  }, [])

  useEffect(() => {
    if (!exito) return
    const t = setTimeout(() => setExito(''), 3000)
    return () => clearTimeout(t)
  }, [exito])

  // ── Auth ──────────────────────────────────────────────
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
    else if (vista === 'historial') cargarHistorial()
    else cargarTalleres()
  }, [vista, mes, profesor])

  async function buscarProfesor(email: string) {
    const { data } = await supabase
      .from('profesores')
      .select('id, nombre, ciudad, email')
      .ilike('email', email.trim())
      .single()
    setProfesor(data || null)
    setCargandoAuth(false)
  }

  async function login() {
    if (!loginEmail || !loginPass) { setLoginError('Ingresa tu correo y contraseña'); return }
    setLoginCargando(true); setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPass
    })
    if (error) { setLoginError('Correo o contraseña incorrectos'); setLoginCargando(false); return }
    if (data.user?.email) {
      setSesion(data.session)
      await buscarProfesor(data.user.email)
    }
    setLoginCargando(false)
  }

  // ── Tarifas del profesor ──────────────────────────────
  async function cargarTarifas() {
    if (!profesor) return
    const { data } = await supabase
      .from('profesor_tarifas')
      .select('*')
      .eq('profesor_id', profesor.id)
      .eq('taller_grupal', false)
    setTarifas(data || [])
  }

  // ── Calcula honorario de una clase ────────────────────
  function getHonorario(c: any): number | 'pendiente' {
    if (c.revision_pendiente) return 'pendiente'
    if (c.estado !== 'dada') return 0
    // Si ya tiene valor editado manualmente (admin lo ajustó)
    if (c.honorario_valor !== null && c.honorario_valor !== undefined)
      return Number(c.honorario_valor)
    const modalidad = (c.modalidad || 'presencial').toLowerCase()
    const duracion  = Number(c.duracion_min)
    // Busca tarifa exacta por modalidad
    let tarifa = tarifas.find((t: any) =>
      t.modalidad?.toLowerCase() === modalidad &&
      Number(t.duracion_min) === duracion
    )
    // Presencial y virtual comparten tarifa
    if (!tarifa && (modalidad === 'presencial' || modalidad === 'virtual')) {
      tarifa = tarifas.find((t: any) =>
        (t.modalidad?.toLowerCase() === 'presencial' || t.modalidad?.toLowerCase() === 'virtual') &&
        Number(t.duracion_min) === duracion
      )
    }
    return tarifa ? Number(tarifa.valor) : 0
  }

  // ── Clases ────────────────────────────────────────────
  async function cargarHoy() {
    if (!profesor) return
    setCargandoClases(true)
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
  async function cargarHistorial() {
    if (!profesor) return
    setCargandoClases(true)
    const fi = `${mes}-01`
    const [a, m] = mes.split('-')
    const ul = new Date(parseInt(a), parseInt(m), 0).getDate()
    const ff = `${mes}-${String(ul).padStart(2, '0')}`
    const { data } = await supabase
      .from('clases').select(SELECT_CLASES)
      .eq('profesor_id', profesor.id)
      .gte('fecha', fi).lte('fecha', ff)
      .order('fecha', { ascending: false })
    setClases(data || [])
    setCargandoClases(false)
  }

  // ── Talleres ──────────────────────────────────────────
  async function cargarTalleres() {
    if (!profesor) return
    setCargandoTalleres(true)
    const hoy  = new Date()
    const mesT = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const { data: talleresData } = await supabase
      .from('talleres')
      .select('id, nombre, dia_semana, hora, duracion_min, salones(nombre, sedes(nombre))')
      .eq('profesor_id', profesor.id)
    if (!talleresData?.length) { setTalleres([]); setCargandoTalleres(false); return }
    const ids = talleresData.map((t: any) => t.id)
    const { data: inscripciones } = await supabase
      .from('taller_inscripciones').select('taller_id')
      .in('taller_id', ids).eq('estado', 'activo').gte('mes', mesT)
    const confirmados = new Set((inscripciones || []).map((i: any) => i.taller_id))
    setTalleres(talleresData.filter((t: any) => confirmados.has(t.id)))
    setCargandoTalleres(false)
  }

  async function abrirTaller(taller: any) {
    setTallerModal(taller)
    const hoy  = new Date()
    const mesT = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const fechaHoy = hoy.toISOString().split('T')[0]
    const { data: inscritos } = await supabase
      .from('taller_inscripciones')
      .select('id, clientes(nombre, nombres, apellidos)')
      .eq('taller_id', taller.id).eq('estado', 'activo').gte('mes', mesT)
    setInscritosTaller(inscritos || [])
    const { data: sesion } = await supabase
      .from('taller_sesiones').select('id, fecha, estado')
      .eq('taller_id', taller.id).eq('fecha', fechaHoy).maybeSingle()
    setSesionHoy(sesion || null)
  }

  async function marcarSesionTaller(nuevoEstado: string) {
    if (!tallerModal) return
    setGuardandoSesion(true)
    const fechaHoy = new Date().toISOString().split('T')[0]
    if (sesionHoy) {
      await supabase.from('taller_sesiones').update({ estado: nuevoEstado }).eq('id', sesionHoy.id)
      setSesionHoy({ ...sesionHoy, estado: nuevoEstado })
    } else {
      const { data } = await supabase.from('taller_sesiones')
        .insert({ taller_id: tallerModal.id, fecha: fechaHoy, estado: nuevoEstado })
        .select().single()
      if (data) {
        setSesionHoy(data)
        if (nuevoEstado === 'dada' && inscritosTaller.length > 0) {
          await supabase.from('taller_asistencias').insert(
            inscritosTaller.map((ins: any) => ({
              sesion_id: data.id, inscripcion_id: ins.id, asistio: true
            }))
          )
        }
      }
    }
    setGuardandoSesion(false)
  }

  // ── Marcar DADA ───────────────────────────────────────
  async function marcarDada() {
    if (!claseActiva) return
    setGuardando(true)
    const { data: contrato } = await supabase
      .from('contratos').select('id, clases_tomadas, duracion_min')
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

  async function marcarInasistencia() {
    if (!claseActiva) return
    setGuardando(true)
    await supabase.from('clases').update({
      revision_pendiente: true,
      observaciones: resumen.trim() || claseActiva.observaciones || null
    }).eq('id', claseActiva.id)
    setExito('Inasistencia registrada — pendiente de revisión')
    cerrarModal()
    setGuardando(false)
  }

  async function guardarResumen() {
    if (!claseActiva) return
    setGuardando(true)
    await supabase.from('clases').update({
      observaciones: resumen.trim() || null
    }).eq('id', claseActiva.id)
    setExito('Resumen guardado')
    cerrarModal()
    setGuardando(false)
  }

  function abrirModal(clase: any) { setClaseActiva(clase); setResumen(clase.observaciones || '') }
  function cerrarModal() {
    setClaseActiva(null); setResumen('')
    if (vista === 'hoy') cargarHoy(); else if (vista === 'historial') cargarHistorial()
  }

  // ── Exportar PDF de honorarios ────────────────────────
  function exportarPDF() {
    const [anio, mesNum] = mes.split('-')
    const mesLabel = `${MESES_NOMBRE[parseInt(mesNum) - 1]} ${anio}`
    const clasesDadas = clases.filter(c => c.estado === 'dada' || c.revision_pendiente)
    const totalHon = clasesDadas.reduce((s, c) => {
      const h = getHonorario(c)
      return h === 'pendiente' ? s : s + h
    }, 0)

    const filas = clasesDadas.map(c => {
      const hon = getHonorario(c)
      const honLabel = hon === 'pendiente'
        ? '<span style="color:#c2410c;font-weight:700">Pendiente revisión</span>'
        : `$${Number(hon).toLocaleString('es-CO')}`
      const modalidad = c.modalidad || 'presencial'
      return `
        <tr>
          <td>${c.fecha?.substring(8,10)}/${c.fecha?.substring(5,7)}</td>
          <td>${c.hora?.substring(0,5)}</td>
          <td>${nombreCliente(c)}</td>
          <td>${c.contratos?.instrumentos?.nombre || '—'}</td>
          <td>${c.duracion_min} min</td>
          <td style="text-transform:capitalize">${modalidad}</td>
          <td style="font-weight:600">${honLabel}</td>
        </tr>
        ${c.observaciones ? `
        <tr class="resumen-row">
          <td colspan="7">
            <div class="resumen-box">📝 <em>${c.observaciones.replace(/\n/g, '<br>')}</em></div>
          </td>
        </tr>` : ''}
      `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Honorarios ${mesLabel} — ${profesor?.nombre}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; font-size: 13px; }
  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 32px; border-bottom: 3px solid #1a8a8a; padding-bottom: 20px; }
  .logo-area h1 { font-size: 22px; color: #1a8a8a; font-weight: 800; }
  .logo-area p { color: #666; font-size: 12px; margin-top: 4px; }
  .info-area { text-align: right; }
  .info-area h2 { font-size: 16px; color: #1a1a1a; font-weight: 700; }
  .info-area p { color: #555; font-size: 12px; margin-top: 3px; }
  table { width:100%; border-collapse: collapse; margin-top: 20px; }
  thead tr { background: #e8f5f5; }
  th { padding: 10px 12px; text-align: left; font-size: 11px; color: #1a8a8a; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:hover td { background: #fafbfc; }
  .resumen-row td { padding: 0 12px 10px; border-bottom: 1px solid #f1f5f9; }
  .resumen-box { background: #f8fafc; border-left: 3px solid #b2d8d8; padding: 8px 12px; font-size: 12px; color: #555; line-height: 1.6; border-radius: 0 6px 6px 0; }
  .total-row { background: #e8f5f5; font-weight: 700; }
  .total-row td { padding: 14px 12px; font-size: 15px; color: #1a8a8a; border-top: 2px solid #1a8a8a; }
  .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; }
  @media print { 
    body { padding: 20px; }
    .no-print { display: none !important; }
    tr { page-break-inside: avoid; }
  }
  .print-btn { margin-bottom: 24px; padding: 10px 24px; background: #1a8a8a; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
<div class="header">
  <div class="logo-area">
    <h1>Academia Ruby Salamanca</h1>
    <p>Cuenta de cobro de honorarios</p>
  </div>
  <div class="info-area">
    <h2>${profesor?.nombre}</h2>
    <p>${mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1)}</p>
    <p>Generado: ${new Date().toLocaleDateString('es-CO')}</p>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th>Fecha</th><th>Hora</th><th>Estudiante</th><th>Instrumento</th>
      <th>Duración</th><th>Modalidad</th><th>Honorario</th>
    </tr>
  </thead>
  <tbody>
    ${filas || '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:24px">Sin clases dadas este mes</td></tr>'}
    <tr class="total-row">
      <td colspan="6">TOTAL HONORARIOS ${mesLabel.toUpperCase()}</td>
      <td>$${totalHon.toLocaleString('es-CO')}</td>
    </tr>
  </tbody>
</table>

<div class="footer">
  <span>Academia Ruby Salamanca</span>
  <span>Documento generado desde el portal del profesor</span>
</div>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // ════════════════════════════════════════════════════
  //  PANTALLAS
  // ════════════════════════════════════════════════════

  if (cargandoAuth) return (
    <div style={{ position: 'fixed', inset: 0, background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  if (!sesion) return (
    <div style={{ position: 'fixed', inset: 0, background: `linear-gradient(150deg,${TEAL} 0%,#0d5f5f 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .li:focus{border-color:${TEAL}!important;box-shadow:0 0 0 3px ${TEAL}33!important;outline:none!important;}`}</style>
      <div style={{ width: '100%', maxWidth: '360px', animation: 'fadeUp 0.4s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <img src="/apple-touch-icon.png" alt="Logo" style={{ width: '88px', height: '88px', borderRadius: '28px', margin: '0 auto 18px', display: 'block', objectFit: 'contain', background: 'white', padding: '6px', boxSizing: 'border-box' }} />
          <h1 style={{ margin: 0, color: 'white', fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Academia Ruby</h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: '500', letterSpacing: '0.5px' }}>PORTAL DEL PROFESOR</p>
        </div>
        <div style={{ background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>CORREO ELECTRÓNICO</label>
            <input className="li" type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white', color: '#1f2937' }} placeholder="nombre@email.com" />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>CONTRASEÑA</label>
            <input className="li" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white', color: '#1f2937' }} placeholder="••••••••" />
          </div>
          {loginError && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '11px 14px', marginBottom: '18px', color: '#dc2626', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{loginError}</div>}
          <button onClick={login} disabled={loginCargando}
            style={{ width: '100%', padding: '15px', background: loginCargando ? TEAL_MID : TEAL, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: loginCargando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
            {loginCargando ? 'Entrando...' : 'Entrar →'}
          </button>
        </div>
      </div>
    </div>
  )

  if (!profesor) return (
    <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', gap: '14px' }}>
      <div style={{ fontSize: '52px' }}>🔍</div>
      <p style={{ color: '#1f2937', fontSize: '17px', fontWeight: '700', margin: 0 }}>Cuenta no vinculada</p>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0, lineHeight: '1.6', maxWidth: '280px' }}>Tu correo no está registrado como profesor. Contacta al administrador.</p>
      <button onClick={() => supabase.auth.signOut()}
        style={{ marginTop: '10px', padding: '12px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}>
        Cerrar sesión
      </button>
    </div>
  )

  // ── Dashboard ─────────────────────────────────────────
  const hoyDate     = new Date()
  const DIAS_CORTO  = ['dom','lun','mar','mié','jue','vie','sáb']
  const MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  const fechaHoy    = `${DIAS_CORTO[hoyDate.getDay()]} ${hoyDate.getDate()} de ${MESES_CORTO[hoyDate.getMonth()]}`

  // Stats del mes para historial
  const dadas      = clases.filter(c => c.estado === 'dada')
  const inasistencias = clases.filter(c => c.revision_pendiente)
  const totalHon   = dadas.reduce((s, c) => {
    const h = getHonorario(c)
    return h === 'pendiente' ? s : s + h
  }, 0)
  const pendientesCobro = clases.filter(c => c.revision_pendiente).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', justifyContent: 'center' }}>
      <style>{`
        @keyframes fadeUp  {from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp {from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn  {from{opacity:0}to{opacity:1}}
        .tc:active{transform:scale(0.98);}
        .ba:active{transform:scale(0.97);}
        textarea:focus{border-color:${TEAL}!important;outline:none!important;box-shadow:0 0 0 3px ${TEAL}22!important;}
      `}</style>

      <div style={{ width: '100%', maxWidth: '480px', height: '100%', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>

        {/* Header */}
        <div style={{ background: TEAL, padding: '18px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/apple-touch-icon.png" alt="Logo" style={{ width: '38px', height: '38px', borderRadius: '10px', objectFit: 'contain', background: 'white', padding: '3px', boxSizing: 'border-box' }} />
              <div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.55)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px' }}>ACADEMIA RUBY</p>
                <h2 style={{ margin: 0, color: 'white', fontSize: '20px', fontWeight: '800', letterSpacing: '-0.3px' }}>{profesor.nombre.split(' ')[0]}</h2>
              </div>
            </div>
            <button onClick={() => supabase.auth.signOut()}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.85)', padding: '7px 13px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'inherit' }}>
              Salir
            </button>
          </div>
          <div style={{ display: 'flex', gap: '3px' }}>
            {([
              { key: 'hoy',       label: '📅 Esta semana' },
              { key: 'talleres',  label: '🎸 Talleres' },
              { key: 'historial', label: '📋 Historial' },
            ] as const).map(v => (
              <button key={v.key} onClick={() => setVista(v.key)}
                style={{ flex: 1, padding: '11px 4px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', borderRadius: '12px 12px 0 0', background: vista === v.key ? 'white' : 'transparent', color: vista === v.key ? TEAL : 'rgba(255,255,255,0.65)', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>

          {exito && (
            <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '14px', padding: '13px 16px', marginBottom: '14px', color: '#166534', fontSize: '14px', fontWeight: '700', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
              ✓ {exito}
            </div>
          )}

          {/* ── HOY ──────────────────────────────────────── */}
          {vista === 'hoy' && (
            <div style={{ animation: 'fadeUp 0.3s ease' }}>
              <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px', fontWeight: '600' }}>Desde hoy hasta el sábado</p>
              {cargandoClases && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '50px 0' }}>Cargando...</p>}
              {!cargandoClases && clases.length === 0 && (
                <div style={{ textAlign: 'center', padding: '70px 20px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '44px', marginBottom: '12px' }}>🎵</div>
                  <p style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 6px', color: '#6b7280' }}>Sin clases hoy</p>
                  <p style={{ fontSize: '13px', margin: 0 }}>Consulta el historial para ver clases anteriores</p>
                </div>
              )}
              {clases.map((c, i) => (
                <TarjetaClase key={c.id} c={c} i={i} onTap={() => abrirModal(c)}
                  resumenExpandido={resumenExpandido} setResumenExpandido={setResumenExpandido}
                  honorario={getHonorario(c)} mostrarHonorario={false} />
              ))}
            </div>
          )}

          {/* ── TALLERES ─────────────────────────────────── */}
          {vista === 'talleres' && (
            <div style={{ animation: 'fadeUp 0.3s ease' }}>
              <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px', fontWeight: '600' }}>Talleres confirmados este mes</p>
              {cargandoTalleres && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '50px 0' }}>Cargando...</p>}
              {!cargandoTalleres && talleres.length === 0 && (
                <div style={{ textAlign: 'center', padding: '70px 20px', color: '#9ca3af' }}>
                  <div style={{ fontSize: '44px', marginBottom: '12px' }}>🎸</div>
                  <p style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 6px', color: '#6b7280' }}>Sin talleres este mes</p>
                  <p style={{ fontSize: '13px', margin: 0 }}>Un taller aparece aquí cuando tiene inscritos activos</p>
                </div>
              )}
              {talleres.map((t: any, i) => {
                const esHoy = DIAS_SEMANA[t.dia_semana] === hoyDate.getDay()
                return (
                  <div key={t.id} className="tc" onClick={() => abrirTaller(t)}
                    style={{ background: 'white', borderRadius: '18px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${esHoy ? '#7c3aed' : '#e5e7eb'}`, cursor: 'pointer', animation: `fadeUp ${0.1 + i * 0.05}s ease` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '800', color: '#1f2937' }}>🎸 {t.nombre}</p>
                        <div style={{ display: 'inline-block', background: '#7c3aed', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', marginBottom: '6px' }}>
                          📍 {t.salones?.sedes?.nombre || '—'}
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
                          🏠 {t.salones?.nombre || '—'} · {t.dia_semana} {t.hora?.substring(0, 5)} · {t.duracion_min} min
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#f3e8ff', color: '#7c3aed', display: 'block', marginBottom: '6px' }}>Confirmado</span>
                        {esHoy && <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '700' }}>Hoy →</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── HISTORIAL + HONORARIOS ────────────────────── */}
          {vista === 'historial' && (
            <div style={{ animation: 'fadeUp 0.3s ease' }}>

              {/* Selector de mes */}
              <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                style={{ width: '100%', padding: '13px 16px', border: `2px solid ${TEAL_MID}`, borderRadius: '14px', fontSize: '15px', fontWeight: '700', color: TEAL, background: 'white', boxSizing: 'border-box', marginBottom: '14px', fontFamily: 'inherit' }} />

              {/* Stats */}
              {!cargandoClases && clases.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                  <div style={{ background: '#dcfce7', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#166534', lineHeight: 1 }}>{dadas.length}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px', fontWeight: '700', color: '#166534', letterSpacing: '0.3px' }}>CLASES DADAS</p>
                  </div>
                  <div style={{ background: pendientesCobro > 0 ? '#fff7ed' : '#f1f5f9', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: pendientesCobro > 0 ? '#c2410c' : '#9ca3af', lineHeight: 1 }}>{pendientesCobro}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px', fontWeight: '700', color: pendientesCobro > 0 ? '#c2410c' : '#9ca3af', letterSpacing: '0.3px' }}>INASISTENCIAS</p>
                  </div>
                  {/* Honorarios totales — ancho completo */}
                  <div style={{ gridColumn: '1 / -1', background: TEAL_LIGHT, borderRadius: '14px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: TEAL, letterSpacing: '0.5px' }}>HONORARIOS CONFIRMADOS</p>
                      {pendientesCobro > 0 && (
                        <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#c2410c', fontWeight: '600' }}>+ {pendientesCobro} clase(s) pendiente(s) de revisión</p>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: TEAL, letterSpacing: '-1px' }}>
                      ${totalHon.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              )}

              {/* Botón exportar PDF */}
              {!cargandoClases && clases.length > 0 && (
                <button onClick={exportarPDF}
                  style={{ width: '100%', padding: '14px', background: TEAL, color: 'white', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: 'pointer', marginBottom: '16px', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  🖨️ Exportar cuenta de cobro PDF
                </button>
              )}

              {cargandoClases && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '50px 0' }}>Cargando...</p>}
              {!cargandoClases && clases.length === 0 && <p style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 0' }}>Sin clases este mes</p>}

              {/* Lista de clases con honorario */}
              {clases.map((c, i) => (
                <TarjetaClase key={c.id} c={c} i={i} onTap={() => abrirModal(c)}
                  resumenExpandido={resumenExpandido} setResumenExpandido={setResumenExpandido}
                  honorario={getHonorario(c)} mostrarHonorario={true} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ MODAL TALLER ══ */}
      {tallerModal && (
        <div onClick={e => e.target === e.currentTarget && setTallerModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '28px 28px 0 0', padding: '20px 20px 36px', animation: 'slideUp 0.3s ease', maxHeight: '88vh', overflow: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 22px' }} />
            <div style={{ background: '#f3e8ff', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: '800', color: '#7c3aed' }}>🎸 {tallerModal.nombre}</p>
                  <div style={{ display: 'inline-block', background: '#7c3aed', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700', marginBottom: '6px' }}>
                    📍 {tallerModal.salones?.sedes?.nombre || '—'}
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#6b5b95' }}>
                    🏠 {tallerModal.salones?.nombre} · {tallerModal.dia_semana} {tallerModal.hora?.substring(0, 5)} · {tallerModal.duracion_min} min
                  </p>
                </div>
                <button onClick={() => setTallerModal(null)}
                  style={{ width: '34px', height: '34px', border: 'none', background: 'rgba(124,58,237,0.15)', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', color: '#7c3aed', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>×</button>
              </div>
            </div>
            <div style={{ background: '#fafbfc', borderRadius: '14px', padding: '14px', marginBottom: '20px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#555' }}>Sesión de hoy — {new Date().toISOString().split('T')[0]}</p>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700',
                  background: sesionHoy?.estado === 'dada' ? '#dcfce7' : sesionHoy?.estado === 'cancelada' ? '#fee2e2' : '#eff6ff',
                  color: sesionHoy?.estado === 'dada' ? '#166534' : sesionHoy?.estado === 'cancelada' ? '#991b1b' : '#1d4ed8' }}>
                  {sesionHoy?.estado || 'programada'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button className="ba" onClick={() => marcarSesionTaller('dada')} disabled={guardandoSesion || sesionHoy?.estado === 'dada'}
                  style={{ padding: '14px', background: sesionHoy?.estado === 'dada' ? '#dcfce7' : '#7c3aed', color: sesionHoy?.estado === 'dada' ? '#166534' : 'white', border: sesionHoy?.estado === 'dada' ? '2px solid #86efac' : 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '800', cursor: guardandoSesion ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {sesionHoy?.estado === 'dada' ? '✓ Dada' : 'Marcar dada'}
                </button>
                <button className="ba" onClick={() => marcarSesionTaller('cancelada')} disabled={guardandoSesion}
                  style={{ padding: '14px', background: '#fff7ed', color: '#c2410c', border: '2px solid #fed7aa', borderRadius: '14px', fontSize: '15px', fontWeight: '800', cursor: guardandoSesion ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
              </div>
            </div>
            <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: '700', color: '#374151' }}>
              Inscritos activos <span style={{ color: '#7c3aed' }}>({inscritosTaller.length})</span>
            </p>
            {inscritosTaller.map((ins: any, i) => {
              const cl = ins.clientes
              const nombre = cl?.nombre || `${cl?.nombres || ''} ${cl?.apellidos || ''}`.trim() || '—'
              return (
                <div key={ins.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: i % 2 === 0 ? '#fafbfc' : 'white', borderRadius: '10px', marginBottom: '4px' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700', color: '#7c3aed', flexShrink: 0 }}>
                    {nombre.charAt(0).toUpperCase()}
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>{nombre}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ MODAL CLASE ══ */}
      {claseActiva && (
        <div onClick={e => e.target === e.currentTarget && cerrarModal()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200, animation: 'fadeIn 0.2s ease' }}>
          <div style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '28px 28px 0 0', padding: '20px 20px 36px', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '92vh', overflow: 'auto' }}>
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 22px' }} />

            {/* Info clase */}
            <div style={{ background: TEAL_LIGHT, borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-0.5px', lineHeight: 1 }}>
                    {claseActiva.hora?.substring(0, 5)} <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>· {claseActiva.duracion_min} min</span>
                  </p>
                  <p style={{ margin: '3px 0 2px', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>{nombreCliente(claseActiva)}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>🎵 {claseActiva.contratos?.instrumentos?.nombre || '—'}</p>
                </div>
                <button onClick={cerrarModal}
                  style={{ width: '34px', height: '34px', border: 'none', background: 'rgba(0,0,0,0.08)', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#374151', fontFamily: 'inherit' }}>×</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ background: TEAL, color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                  📍 {claseActiva.salones?.sedes?.nombre || '—'}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.08)', color: '#374151', padding: '5px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                  🏠 {claseActiva.salones?.nombre || '—'}
                </div>
               
              </div>
            </div>

            {claseActiva.revision_pendiente && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '11px 14px', marginBottom: '18px', fontSize: '13px', color: '#c2410c', fontWeight: '600' }}>
                ⚠️ Inasistencia registrada — pendiente de revisión por la asistente
              </div>
            )}

            {/* Resumen */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '0.8px' }}>
                RESUMEN DE LA CLASE <span style={{ fontWeight: '500', color: '#9ca3af' }}>— puedes completarlo después</span>
              </label>
              <textarea value={resumen} onChange={e => setResumen(e.target.value)}
                placeholder="Escribe aquí lo que se trabajó en la clase. Puedes usar punto y aparte para separar ideas."
                rows={5}
                style={{ width: '100%', padding: '13px 14px', border: `2px solid ${TEAL_MID}`, borderRadius: '14px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'system-ui,-apple-system,sans-serif', lineHeight: '1.6', background: 'white', color: '#1f2937', textAlign: 'left', whiteSpace: 'pre-wrap', transition: 'border-color 0.2s' }} />
            </div>

            {claseActiva.estado === 'confirmada' && !claseActiva.revision_pendiente && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <button className="ba" onClick={marcarDada} disabled={guardando}
                  style={{ padding: '18px 12px', background: TEAL, color: 'white', border: 'none', borderRadius: '16px', fontSize: '17px', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, fontFamily: 'inherit' }}>
                  ✓ Clase dada
                </button>
                <button className="ba" onClick={marcarInasistencia} disabled={guardando}
                  style={{ padding: '18px 12px', background: '#fff7ed', color: '#c2410c', border: '2px solid #fed7aa', borderRadius: '16px', fontSize: '17px', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, fontFamily: 'inherit' }}>
                  ✗ No asistió
                </button>
              </div>
            )}

            {(claseActiva.estado === 'dada' || claseActiva.revision_pendiente) && (
              <button className="ba" onClick={guardarResumen} disabled={guardando}
                style={{ width: '100%', padding: '16px', background: TEAL, color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, fontFamily: 'inherit' }}>
                {guardando ? 'Guardando...' : '💾 Guardar resumen'}
              </button>
            )}

            {claseActiva.estado !== 'confirmada' && !claseActiva.revision_pendiente && claseActiva.estado !== 'dada' && (
              <div>
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: '0 0 12px', fontStyle: 'italic' }}>
                  Clase en estado "{claseActiva.estado}" — solo puedes guardar el resumen
                </p>
                <button className="ba" onClick={guardarResumen} disabled={guardando}
                  style={{ width: '100%', padding: '14px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '700', cursor: guardando ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {guardando ? 'Guardando...' : '💾 Guardar resumen'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de clase ────────────────────────────────────
function TarjetaClase({ c, i, onTap, resumenExpandido, setResumenExpandido, honorario, mostrarHonorario }: {
  c: any, i: number, onTap: () => void,
  resumenExpandido: string | null,
  setResumenExpandido: (id: string | null) => void,
  honorario: number | 'pendiente',
  mostrarHonorario: boolean
}) {
  const badge      = badgeEstado(c.estado, c.revision_pendiente)
  const confirmada = c.estado === 'confirmada' && !c.revision_pendiente
  const expandido  = resumenExpandido === c.id

  return (
    <div style={{ background: 'white', borderRadius: '18px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${confirmada ? '#1a8a8a' : '#e5e7eb'}`, animation: `fadeUp ${0.15 + i * 0.06}s ease` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-1px', lineHeight: 1 }}>
              {mostrarHonorario
                ? `${c.fecha?.substring(8,10)}/${c.fecha?.substring(5,7)}`
                : c.hora?.substring(0, 5)}
            </span>
            {!mostrarHonorario && (
              <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>
                {c.fecha === new Date().toISOString().split('T')[0] ? 'Hoy' : `${c.fecha?.substring(8,10)}/${c.fecha?.substring(5,7)}`}
              </span>
            )}
            {mostrarHonorario && (
              <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: '600' }}>{c.hora?.substring(0, 5)}</span>
            )}
            <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>{c.duracion_min} min</span>
          </div>
          <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: '#1f2937', textAlign: 'left' }}>
            {c.contratos?.clientes?.nombre || `${c.contratos?.clientes?.nombres || ''} ${c.contratos?.clientes?.apellidos || ''}`.trim() || '—'}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span style={{ background: '#1a8a8a', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
              📍 {c.salones?.sedes?.nombre || '—'}
            </span>
            <span style={{ background: '#f1f5f9', color: '#374151', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
              🏠 {c.salones?.nombre || '—'}
            </span>
        
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: badge.bg, color: badge.color, whiteSpace: 'nowrap' }}>
            {badge.label}
          </span>
          {/* Honorario punto 15 */}
          {mostrarHonorario && (
            honorario === 'pendiente'
              ? <span style={{ fontSize: '11px', fontWeight: '700', color: '#c2410c', background: '#fff7ed', padding: '3px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>⏳ Pendiente revisión</span>
              : honorario > 0
                ? <span style={{ fontSize: '14px', fontWeight: '800', color: '#1a8a8a' }}>${Number(honorario).toLocaleString('es-CO')}</span>
                : <span style={{ fontSize: '12px', color: '#d1d5db' }}>Sin tarifa</span>
          )}
          {confirmada && !mostrarHonorario && (
            <button onClick={onTap}
              style={{ padding: '8px 14px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
              Marcar →
            </button>
          )}
        </div>
      </div>

      {/* Resumen colapsable */}
      {c.observaciones && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
          <button onClick={e => { e.stopPropagation(); setResumenExpandido(expandido ? null : c.id) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#1a8a8a', fontWeight: '700', padding: '2px 0', fontFamily: 'inherit' }}>
            {expandido ? '▲ Ocultar resumen' : '▼ Ver resumen de la clase'}
          </button>
          {expandido && (
            <div style={{ marginTop: '8px', background: '#e8f5f5', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
              {c.observaciones}
            </div>
          )}
        </div>
      )}

      {/* Acción en historial para clases ya marcadas */}
      {mostrarHonorario && (c.estado === 'dada' || c.revision_pendiente) && (
        <div style={{ borderTop: c.observaciones ? 'none' : '1px solid #f1f5f9', paddingTop: c.observaciones ? '0' : '8px', marginTop: c.observaciones ? '0' : '4px' }}>
          {!c.observaciones && (
            <button onClick={onTap}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#9ca3af', fontWeight: '600', padding: '2px 0', fontFamily: 'inherit' }}>
              + Agregar resumen
            </button>
          )}
        </div>
      )}
    </div>
  )
}
