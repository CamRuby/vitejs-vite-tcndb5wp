import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

// ─── Colores de la academia ───────────────────────────────
const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'

// ─── Helpers ──────────────────────────────────────────────
function badgeEstado(estado: string, revisionPendiente?: boolean) {
  if (revisionPendiente) return { label: 'Inasistencia', bg: '#fff7ed', color: '#c2410c' }
  switch (estado) {
    case 'dada':       return { label: 'Dada ✓',     bg: '#dcfce7', color: '#166534' }
    case 'confirmada': return { label: 'Confirmada',  bg: '#dbeafe', color: '#1e40af' }
    case 'programada': return { label: 'Programada',  bg: '#f1f5f9', color: '#475569' }
    case 'cancelada':  return { label: 'Cancelada',   bg: '#fee2e2', color: '#991b1b' }
    default:           return { label: estado,        bg: '#f1f5f9', color: '#475569' }
  }
}

function nombreCliente(c: any) {
  const cl = c.contratos?.clientes
  if (!cl) return '—'
  return cl.nombre || `${cl.nombres || ''} ${cl.apellidos || ''}`.trim() || '—'
}

// ─── Componente principal ─────────────────────────────────
export default function ProfesorApp() {

  // Auth
  const [sesion, setSesion]           = useState<any>(null)
  const [profesor, setProfesor]       = useState<any>(null)
  const [cargandoAuth, setCargandoAuth] = useState(true)

  // Login
  const [loginEmail, setLoginEmail]   = useState('')
  const [loginPass, setLoginPass]     = useState('')
  const [loginError, setLoginError]   = useState('')
  const [loginCargando, setLoginCargando] = useState(false)

  // Vista principal
  const [vista, setVista]             = useState<'hoy' | 'historial'>('hoy')
  const [clases, setClases]           = useState<any[]>([])
  const [cargandoClases, setCargandoClases] = useState(false)
  const [mes, setMes]                 = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
  })

  // Modal de acción
  const [claseActiva, setClaseActiva] = useState<any>(null)
  const [resumen, setResumen]         = useState('')
  const [guardando, setGuardando]     = useState(false)
  const [exito, setExito]             = useState('')

  // ─── Toast de éxito: desaparece solo ─────────────────────
  useEffect(() => {
    if (!exito) return
    const t = setTimeout(() => setExito(''), 3000)
    return () => clearTimeout(t)
  }, [exito])

  // ─── Auth: detectar sesión ────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session)
      if (session?.user?.email) buscarProfesor(session.user.email)
      else setCargandoAuth(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSesion(session)
      if (session?.user?.email) buscarProfesor(session.user.email)
      else { setProfesor(null); setCargandoAuth(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ─── Recargar clases al cambiar vista o mes ───────────────
  useEffect(() => {
    if (!profesor) return
    if (vista === 'hoy') cargarHoy()
    else cargarHistorial()
  }, [vista, mes, profesor])

  // ─── Busca el registro del profesor por email ─────────────
  async function buscarProfesor(email: string) {
    const { data } = await supabase
      .from('profesores')
      .select('id, nombre, ciudad, email')
      .ilike('email', email.trim())
      .single()
    setProfesor(data || null)
    setCargandoAuth(false)
  }

  // ─── Login con Supabase Auth ──────────────────────────────
  async function login() {
    if (!loginEmail || !loginPass) { setLoginError('Ingresa tu correo y contraseña'); return }
    setLoginCargando(true); setLoginError('')
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim().toLowerCase(),
      password: loginPass
    })
    if (error) setLoginError('Correo o contraseña incorrectos')
    setLoginCargando(false)
  }

  // ─── Campos que se piden a Supabase para cada clase ──────
  const SELECT_CLASES = [
    'id', 'fecha', 'hora', 'duracion_min', 'estado',
    'revision_pendiente', 'observaciones', 'contrato_id',
    'contratos(clientes(nombre, nombres, apellidos), instrumentos(nombre))',
    'salones(nombre, sedes(nombre))'
  ].join(', ')

  // ─── Clases de hoy ────────────────────────────────────────
  async function cargarHoy() {
    if (!profesor) return
    setCargandoClases(true)
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('clases')
      .select(SELECT_CLASES)
      .eq('profesor_id', profesor.id)
      .eq('fecha', hoy)
      .order('hora')
    setClases(data || [])
    setCargandoClases(false)
  }

  // ─── Historial del mes ────────────────────────────────────
  async function cargarHistorial() {
    if (!profesor) return
    setCargandoClases(true)
    const fi = `${mes}-01`
    const [a, m] = mes.split('-')
    const ul = new Date(parseInt(a), parseInt(m), 0).getDate()
    const ff = `${mes}-${String(ul).padStart(2, '0')}`
    const { data } = await supabase
      .from('clases')
      .select(SELECT_CLASES)
      .eq('profesor_id', profesor.id)
      .gte('fecha', fi)
      .lte('fecha', ff)
      .order('fecha', { ascending: false })
    setClases(data || [])
    setCargandoClases(false)
  }

  // ─── Marcar clase como DADA ───────────────────────────────
  async function marcarDada() {
    if (!claseActiva) return
    setGuardando(true)

    // Busca el contrato para calcular la fracción de clase
    // Ej: clase de 45 min en plan de 60 min = 0.75 clases
    const { data: contrato } = await supabase
      .from('contratos')
      .select('id, clases_tomadas, duracion_min')
      .eq('id', claseActiva.contrato_id)
      .single()

    const fraccion = contrato
      ? claseActiva.duracion_min / contrato.duracion_min
      : 1

    // Actualiza la clase
    await supabase.from('clases').update({
      estado: 'dada',
      observaciones: resumen.trim() || claseActiva.observaciones || null
    }).eq('id', claseActiva.id)

    // Suma la fracción al contador del plan del estudiante
    if (contrato) {
      await supabase.from('contratos').update({
        clases_tomadas: Number(contrato.clases_tomadas || 0) + fraccion
      }).eq('id', contrato.id)
    }

    setExito('¡Clase marcada como dada!')
    cerrarModal()
    setGuardando(false)
  }

  // ─── Marcar INASISTENCIA ──────────────────────────────────
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

  // ─── Guardar solo el resumen ──────────────────────────────
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

  function abrirModal(clase: any) {
    setClaseActiva(clase)
    setResumen(clase.observaciones || '')
  }

  function cerrarModal() {
    setClaseActiva(null)
    setResumen('')
    if (vista === 'hoy') cargarHoy()
    else cargarHistorial()
  }

  // ════════════════════════════════════════════════════════
  //  PANTALLAS
  // ════════════════════════════════════════════════════════

  // ─── Cargando auth ────────────────────────────────────────
  if (cargandoAuth) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: TEAL }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )

  // ─── Pantalla de login ────────────────────────────────────
  if (!sesion) return (
    <div style={{ minHeight: '100vh', background: `linear-gradient(150deg, ${TEAL} 0%, #0d5f5f 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        .login-input:focus { border-color: ${TEAL} !important; box-shadow: 0 0 0 3px ${TEAL}33 !important; outline: none !important; }
      `}</style>
      <div style={{ width: '100%', maxWidth: '360px', animation: 'fadeUp 0.4s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ width: '88px', height: '88px', background: 'rgba(255,255,255,0.15)', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', fontSize: '40px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            🎵
          </div>
          <h1 style={{ margin: 0, color: 'white', fontSize: '30px', fontWeight: '800', letterSpacing: '-0.5px' }}>Academia Ruby</h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: '14px', fontWeight: '500', letterSpacing: '0.5px' }}>PORTAL DEL PROFESOR</p>
        </div>

        {/* Formulario */}
        <div style={{ background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 24px 80px rgba(0,0,0,0.3)' }}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>CORREO ELECTRÓNICO</label>
            <input
              className="login-input"
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit' }}
              placeholder="nombre@email.com"
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>CONTRASEÑA</label>
            <input
              className="login-input"
              type="password"
              value={loginPass}
              onChange={e => setLoginPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={{ width: '100%', padding: '14px 16px', border: '2px solid #e5e7eb', borderRadius: '12px', fontSize: '15px', boxSizing: 'border-box', transition: 'border-color 0.2s, box-shadow 0.2s', fontFamily: 'inherit' }}
              placeholder="••••••••"
            />
          </div>
          {loginError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '11px 14px', marginBottom: '18px', color: '#dc2626', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>
              {loginError}
            </div>
          )}
          <button
            onClick={login}
            disabled={loginCargando}
            style={{ width: '100%', padding: '15px', background: loginCargando ? TEAL_MID : TEAL, color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: loginCargando ? 'not-allowed' : 'pointer', transition: 'background 0.2s', letterSpacing: '0.3px', fontFamily: 'inherit' }}
          >
            {loginCargando ? 'Entrando...' : 'Entrar →'}
          </button>
        </div>
      </div>
    </div>
  )

  // ─── Email no vinculado a ningún profesor ─────────────────
  if (!profesor) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', gap: '14px' }}>
      <div style={{ fontSize: '52px' }}>🔍</div>
      <p style={{ color: '#1f2937', fontSize: '17px', fontWeight: '700', margin: 0 }}>Cuenta no vinculada</p>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0, lineHeight: '1.6', maxWidth: '280px' }}>
        Tu correo no está registrado como profesor en el sistema. Contacta al administrador.
      </p>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{ marginTop: '10px', padding: '12px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}
      >
        Cerrar sesión
      </button>
    </div>
  )

  // ════════════════════════════════════════════════════════
  //  DASHBOARD PRINCIPAL
  // ════════════════════════════════════════════════════════

  const hoy         = new Date()
  const DIAS        = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
  const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const fechaHoy    = `${DIAS[hoy.getDay()]} ${hoy.getDate()} de ${MESES_CORTO[hoy.getMonth()]}`

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', maxWidth: '480px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{`
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        .tarjeta-clase { transition: transform 0.15s; cursor: pointer; }
        .tarjeta-clase:active { transform: scale(0.98); }
        .btn-accion:active { transform: scale(0.97); }
        textarea:focus { border-color: ${TEAL} !important; outline: none !important; box-shadow: 0 0 0 3px ${TEAL}22 !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ background: TEAL, padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <div>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>ACADEMIA RUBY</p>
            <h2 style={{ margin: '3px 0 0', color: 'white', fontSize: '23px', fontWeight: '800', letterSpacing: '-0.3px' }}>
              {profesor.nombre.split(' ')[0]}
            </h2>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'rgba(255,255,255,0.85)', padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', marginTop: '6px', fontFamily: 'inherit', letterSpacing: '0.3px' }}
          >
            Salir
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['hoy', 'historial'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '700', borderRadius: '14px 14px 0 0', background: vista === v ? 'white' : 'transparent', color: vista === v ? TEAL : 'rgba(255,255,255,0.65)', transition: 'all 0.2s', fontFamily: 'inherit', letterSpacing: '0.2px' }}>
              {v === 'hoy' ? '📅  Hoy' : '📋  Historial'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>

        {/* Toast de éxito */}
        {exito && (
          <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '14px', padding: '13px 16px', marginBottom: '14px', color: '#166534', fontSize: '14px', fontWeight: '700', textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
            ✓ {exito}
          </div>
        )}

        {/* ────── VISTA HOY ─────────────────────────────────── */}
        {vista === 'hoy' && (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>
            <p style={{ margin: '0 0 14px', color: '#6b7280', fontSize: '13px', fontWeight: '600', textTransform: 'capitalize' }}>{fechaHoy}</p>

            {cargandoClases && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '50px 0' }}>Cargando...</p>
            )}

            {!cargandoClases && clases.length === 0 && (
              <div style={{ textAlign: 'center', padding: '70px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>🎵</div>
                <p style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 6px', color: '#6b7280' }}>Sin clases hoy</p>
                <p style={{ fontSize: '13px', margin: 0 }}>Consulta el historial para ver clases anteriores</p>
              </div>
            )}

            {clases.map((c, i) => {
              const badge      = badgeEstado(c.estado, c.revision_pendiente)
              const confirmada = c.estado === 'confirmada' && !c.revision_pendiente
              return (
                <div key={c.id} className="tarjeta-clase" onClick={() => abrirModal(c)}
                  style={{ background: 'white', borderRadius: '18px', padding: '16px', marginBottom: '12px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderLeft: `4px solid ${confirmada ? TEAL : '#e5e7eb'}`, animation: `fadeUp ${0.15 + i * 0.06}s ease` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Hora + duración */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '7px' }}>
                        <span style={{ fontSize: '26px', fontWeight: '800', color: '#111', letterSpacing: '-1px', lineHeight: 1 }}>{c.hora?.substring(0, 5)}</span>
                        <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: '600' }}>{c.duracion_min} min</span>
                      </div>
                      {/* Nombre */}
                      <p style={{ margin: '0 0 3px', fontSize: '15px', fontWeight: '700', color: '#1f2937' }}>{nombreCliente(c)}</p>
                      {/* Instrumento + salón */}
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span>🎸 {c.contratos?.instrumentos?.nombre || '—'}</span>
                        <span>🏠 {c.salones?.nombre || '—'}</span>
                      </p>
                    </div>
                    {/* Badge + CTA */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: badge.bg, color: badge.color, display: 'block', marginBottom: '8px', whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                      {confirmada && (
                        <span style={{ fontSize: '11px', color: TEAL, fontWeight: '700' }}>Toca →</span>
                      )}
                    </div>
                  </div>
                  {/* Resumen si existe */}
                  {c.observaciones && (
                    <div style={{ marginTop: '10px', background: TEAL_LIGHT, borderRadius: '10px', padding: '8px 12px', fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
                      📝 {c.observaciones}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ────── VISTA HISTORIAL ───────────────────────────── */}
        {vista === 'historial' && (
          <div style={{ animation: 'fadeUp 0.3s ease' }}>

            {/* Selector de mes */}
            <input
              type="month"
              value={mes}
              onChange={e => setMes(e.target.value)}
              style={{ width: '100%', padding: '13px 16px', border: `2px solid ${TEAL_MID}`, borderRadius: '14px', fontSize: '15px', fontWeight: '700', color: TEAL, background: 'white', boxSizing: 'border-box', marginBottom: '14px', fontFamily: 'inherit' }}
            />

            {/* Stats del mes */}
            {!cargandoClases && clases.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {[
                  { label: 'Dadas',      count: clases.filter(c => c.estado === 'dada').length,              color: '#166534', bg: '#dcfce7' },
                  { label: 'Inasistencias', count: clases.filter(c => c.revision_pendiente).length,          color: '#c2410c', bg: '#fff7ed' },
                  { label: 'Total',      count: clases.length,                                               color: TEAL,      bg: TEAL_LIGHT },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: '14px', padding: '14px 8px', textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.count}</p>
                    <p style={{ margin: '5px 0 0', fontSize: '10px', fontWeight: '700', color: s.color, letterSpacing: '0.3px' }}>{s.label.toUpperCase()}</p>
                  </div>
                ))}
              </div>
            )}

            {cargandoClases && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '50px 0' }}>Cargando...</p>
            )}
            {!cargandoClases && clases.length === 0 && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '40px 0' }}>Sin clases este mes</p>
            )}

            {clases.map((c, i) => {
              const badge = badgeEstado(c.estado, c.revision_pendiente)
              return (
                <div key={c.id} className="tarjeta-clase" onClick={() => abrirModal(c)}
                  style={{ background: 'white', borderRadius: '14px', padding: '14px 16px', marginBottom: '8px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', animation: `fadeUp ${0.1 + i * 0.03}s ease` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Fecha + estado */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '700', flexShrink: 0 }}>
                          {c.fecha?.substring(8, 10)}/{c.fecha?.substring(5, 7)} — {c.hora?.substring(0, 5)}
                        </span>
                        <span style={{ padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: badge.bg, color: badge.color, flexShrink: 0 }}>
                          {badge.label}
                        </span>
                      </div>
                      {/* Cliente + instrumento */}
                      <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {nombreCliente(c)} · {c.contratos?.instrumentos?.nombre || '—'}
                      </p>
                      {/* Resumen breve */}
                      {c.observaciones && (
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          📝 {c.observaciones}
                        </p>
                      )}
                    </div>
                    <span style={{ color: '#d1d5db', fontSize: '22px', fontWeight: '300', flexShrink: 0 }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ════ MODAL DE ACCIÓN ════════════════════════════════ */}
      {claseActiva && (
        <div
          onClick={e => e.target === e.currentTarget && cerrarModal()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', zIndex: 200, animation: 'fadeIn 0.2s ease' }}
        >
          <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto', background: 'white', borderRadius: '28px 28px 0 0', padding: '20px 20px 36px', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '88vh', overflow: 'auto' }}>

            {/* Handle */}
            <div style={{ width: '44px', height: '5px', background: '#e5e7eb', borderRadius: '3px', margin: '0 auto 22px' }} />

            {/* Info de la clase */}
            <div style={{ background: TEAL_LIGHT, borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: '#111', letterSpacing: '-0.5px', lineHeight: 1 }}>
                    {claseActiva.hora?.substring(0, 5)} <span style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>· {claseActiva.duracion_min} min</span>
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: '16px', fontWeight: '700', color: '#1f2937' }}>{nombreCliente(claseActiva)}</p>
                </div>
                <button onClick={cerrarModal}
                  style={{ width: '34px', height: '34px', border: 'none', background: 'rgba(0,0,0,0.08)', borderRadius: '50%', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#374151', fontFamily: 'inherit' }}>
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: '#4b5563', flexWrap: 'wrap' }}>
                <span>🎵 {claseActiva.contratos?.instrumentos?.nombre || '—'}</span>
                <span>🏠 {claseActiva.salones?.nombre || '—'}, {claseActiva.salones?.sedes?.nombre || '—'}</span>
              </div>
            </div>

            {/* Alerta de inasistencia ya marcada */}
            {claseActiva.revision_pendiente && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '11px 14px', marginBottom: '18px', fontSize: '13px', color: '#c2410c', fontWeight: '600' }}>
                ⚠️ Inasistencia registrada — pendiente de revisión por la asistente
              </div>
            )}

            {/* Campo de resumen */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '0.8px' }}>
                RESUMEN DE LA CLASE <span style={{ fontWeight: '500', color: '#9ca3af' }}>— opcional, puedes completarlo después</span>
              </label>
              <textarea
                value={resumen}
                onChange={e => setResumen(e.target.value)}
                placeholder="Ej: Trabajamos escala de Do mayor, el alumno mejoró mucho el tempo..."
                rows={3}
                style={{ width: '100%', padding: '13px 14px', border: `2px solid ${TEAL_MID}`, borderRadius: '14px', fontSize: '14px', resize: 'none', boxSizing: 'border-box', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.6', transition: 'border-color 0.2s, box-shadow 0.2s', color: '#1f2937' }}
              />
            </div>

            {/* Botones: clase confirmada y sin inasistencia → mostrar Dada / No asistió */}
            {claseActiva.estado === 'confirmada' && !claseActiva.revision_pendiente && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <button className="btn-accion" onClick={marcarDada} disabled={guardando}
                  style={{ padding: '16px 12px', background: TEAL, color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, transition: 'transform 0.15s', fontFamily: 'inherit', letterSpacing: '0.2px' }}>
                  ✓ Clase dada
                </button>
                <button className="btn-accion" onClick={marcarInasistencia} disabled={guardando}
                  style={{ padding: '16px 12px', background: '#fff7ed', color: '#c2410c', border: '2px solid #fed7aa', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, transition: 'transform 0.15s', fontFamily: 'inherit' }}>
                  ✗ No asistió
                </button>
              </div>
            )}

            {/* Clase ya marcada → solo guardar resumen */}
            {(claseActiva.estado === 'dada' || claseActiva.revision_pendiente) && (
              <button className="btn-accion" onClick={guardarResumen} disabled={guardando}
                style={{ width: '100%', padding: '16px', background: TEAL, color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: '800', cursor: guardando ? 'not-allowed' : 'pointer', opacity: guardando ? 0.7 : 1, transition: 'transform 0.15s', fontFamily: 'inherit' }}>
                {guardando ? 'Guardando...' : '💾 Guardar resumen'}
              </button>
            )}

            {/* Clase en otro estado (programada, cancelada) */}
            {claseActiva.estado !== 'confirmada' && !claseActiva.revision_pendiente && claseActiva.estado !== 'dada' && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>
                Clase en estado "{claseActiva.estado}" — sin acciones disponibles
              </p>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
