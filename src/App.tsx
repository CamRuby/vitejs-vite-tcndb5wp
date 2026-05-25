import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'

const esProfesor = window.location.pathname.startsWith('/profesor')

export default function App() {
  const [sesion, setSesion] = useState<any>(null)
  const [rol, setRol] = useState<string | null>(null)
  const [listo, setListo] = useState(false)

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    setSesion(session)
    if (session?.user?.email) {
      const { data } = await supabase
        .from('roles')
        .select('rol')
        .eq('email', session.user.email)
        .single()
      setRol(data?.rol || 'sin_rol')
    } else {
      setRol(null)
    }
    setListo(true)
  }

  useEffect(() => {
    if (esProfesor) { setListo(true); return }
    verificarSesion()

    // Escuchar login/logout y re-verificar
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      verificarSesion()
    })
    return () => subscription.unsubscribe()
  }, [])

  if (esProfesor) return <ProfesorApp />

  if (!listo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Cargando...</p>
    </div>
  )

  if (!sesion) return <Login />

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

  return <Dashboard usuario={sesion.user} />
}
