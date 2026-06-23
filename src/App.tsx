import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'
const esProfesor = window.location.pathname.startsWith('/profesor')
import AdminApp from './pages/AdminApp'
const esAdmin = window.location.pathname.startsWith('/admin')
export default function App() {
  const [sesion, setSesion] = useState<any>(null)
  const [rol, setRol] = useState<string | null>(null)
  const [listo, setListo] = useState(false)
  useEffect(() => {
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setSesion(null)
        setRol(null)
      }
      if (_event === 'SIGNED_IN') {
        setSesion(session)
      }
    })
    return () => subscription.unsubscribe()
  }, [])
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
    if (rol === 'profesor' || rol === 'admin') return <ProfesorApp />
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
  if (esAdmin) return <AdminApp />
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
