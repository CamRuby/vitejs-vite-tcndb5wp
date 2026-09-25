import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'
const esProfesor = window.location.pathname.startsWith('/profesor')
import AdminApp from './pages/AdminApp'
const esAdmin = window.location.pathname.startsWith('/admin')
import RegistroCliente from './pages/RegistroCliente'
const esRegistro = window.location.pathname.startsWith('/registro')

export default function App() {
  const [sesion, setSesion] = useState<any>(null)
  const [rol, setRol] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  const [cambiandoPassword, setCambiandoPassword] = useState(false)
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [passwordGuardado, setPasswordGuardado] = useState(false)
  const [errorPassword, setErrorPassword] = useState('')
  const [guardandoPassword, setGuardandoPassword] = useState(false)

  useEffect(() => {
    // Ajustar theme-color según la ruta
    const color = esProfesor ? '#1a8a8a' : '#1e293b'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    document.body.style.background = color
  }, [])

  useEffect(() => {
    if (esRegistro) return // Ruta pública — sin autenticación requerida
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSesion(session)
      if (session?.user?.email) {
        const { data } = await supabase
          .from('roles')
          .select('rol')
          .eq('email', session.user.email)
          .single()
        setRol(data?.rol || 'sin_rol')
      }
      setListo(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setSesion(null)
        setRol(null)
      }
      if (_event === 'SIGNED_IN') {
        setSesion(session)
        // ── FIX: cargar el rol al iniciar sesión con magic link ──
        if (session?.user?.email) {
          const { data } = await supabase
            .from('roles')
            .select('rol')
            .eq('email', session.user.email)
            .single()
          setRol(data?.rol || 'sin_rol')
        }
      }
      if (_event === 'PASSWORD_RECOVERY') {
        setSesion(session)
        setCambiandoPassword(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Ruta pública: formulario de registro para nuevos clientes ──
  if (esRegistro) return <RegistroCliente />

  // ── Cambio de contraseña (enlace del correo de Supabase) ──
  if (cambiandoPassword) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '360px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '20px', color: '#1a8a8a', fontWeight: '700' }}>🔑 Nueva contraseña</h2>
        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#6b7280' }}>Academia Ruby Salamanca</p>
        {passwordGuardado ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: '#166534', fontWeight: '600' }}>✅ Contraseña actualizada</p>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '8px 0 20px' }}>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <button onClick={() => { setCambiandoPassword(false); setPasswordGuardado(false); supabase.auth.signOut() }}
              style={{ width: '100%', padding: '11px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
              Ir al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Nueva contraseña</label>
            <input
              type="password"
              value={nuevaPassword}
              onChange={e => setNuevaPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px' }}
            />
            {errorPassword && <p style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 10px' }}>{errorPassword}</p>}
            <button
              onClick={async () => {
                if (nuevaPassword.length < 6) { setErrorPassword('La contraseña debe tener al menos 6 caracteres'); return }
                setGuardandoPassword(true); setErrorPassword('')
                const { error } = await supabase.auth.updateUser({ password: nuevaPassword })
                setGuardandoPassword(false)
                if (error) { setErrorPassword('Error: ' + error.message) }
                else { setPasswordGuardado(true) }
              }}
              disabled={guardandoPassword}
              style={{ width: '100%', padding: '11px', background: guardandoPassword ? '#9ca3af' : '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: guardandoPassword ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600' }}>
              {guardandoPassword ? 'Guardando...' : 'Guardar contraseña'}
            </button>
          </>
        )}
      </div>
    </div>
  )

  if (!listo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Cargando...</p>
    </div>
  )
  if (!sesion) return <Login />
  // /profesor: solo accesible con rol 'profesor'
  if (esProfesor) {
    // Sin sesión: ProfesorApp maneja su propio login internamente
    if (!sesion || !rol) return <ProfesorApp />
    if (rol === 'profesor' || rol === 'admin') return <ProfesorApp rol={rol} />
    if (rol === 'sin_rol' || rol === null) return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
        <p style={{ fontSize: '18px', color: '#374151', fontWeight: '600' }}>Sin acceso.</p>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>Tu usuario no tiene el rol de profesor.</p>
        <button onClick={() => supabase.auth.signOut()}
          style={{ padding: '10px 24px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          Cerrar sesión
        </button>
      </div>
    )
    // rol de admin intentando acceder a /profesor
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
        <p style={{ fontSize: '18px', color: '#374151', fontWeight: '600' }}>Esta sección es para profesores.</p>
        <button onClick={() => supabase.auth.signOut()}
          style={{ padding: '10px 24px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          Cerrar sesión
        </button>
      </div>
    )
  }
  // ── FIX SEGURIDAD: /admin requiere verificar rol antes de renderizar ──
  if (esAdmin) {
    // Esperar a que el rol cargue (puede ser null si entró por magic link)
    if (!rol) return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Cargando...</p>
      </div>
    )
    if (rol === 'admin') return <AdminApp />
    // Cualquier otro rol: acceso denegado
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
        <p style={{ fontSize: '18px', color: '#374151', fontWeight: '600' }}>Sin acceso.</p>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>Solo los administradores pueden acceder aquí.</p>
        <button onClick={() => supabase.auth.signOut()}
          style={{ padding: '10px 24px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
          Cerrar sesión
        </button>
      </div>
    )
  }
  if (rol === 'profesor') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
      <p style={{ fontSize: '18px', color: '#374151', fontWeight: '600' }}>No tienes acceso a esta sección.</p>
      <p style={{ fontSize: '14px', color: '#9ca3af' }}>Usa la app de profesores en tu celular.</p>
      <button onClick={() => supabase.auth.signOut()}
        style={{ padding: '10px 24px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
        Cerrar sesión
      </button>
    </div>
  )
  if (rol === 'sin_rol') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>
      <p style={{ fontSize: '18px', color: '#374151', fontWeight: '600' }}>Usuario sin rol asignado.</p>
      <p style={{ fontSize: '14px', color: '#9ca3af' }}>Contacta al administrador.</p>
      <button onClick={() => supabase.auth.signOut()}
        style={{ padding: '10px 24px', background: '#1a8a8a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
        Cerrar sesión
      </button>
    </div>
  )
  return <Dashboard usuario={sesion.user} rol={rol} />
}
