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
  const [sesionExpirada, setSesionExpirada] = useState(false)

  useEffect(() => {
    if (esProfesor) { setListo(true); return }

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
        setSesionExpirada(false)
      }
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        setSesion(session)
        setSesionExpirada(false)
        if (session?.user?.email) {
          const { data } = await supabase
            .from('roles')
            .select('rol')
            .eq('email', session.user.email)
            .single()
          setRol(data?.rol || 'sin_rol')
        }
      }
      if (_event === 'USER_UPDATED') {
        setSesion(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (esProfesor) return <ProfesorApp />

  if (!listo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#666', fontSize: '15px' }}>Cargando...</p>
    </div>
  )

  if (!sesion) return (
    <div>
      {sesionExpirada && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fff7ed', borderBottom: '2px solid #f97316',
          padding: '12px 24px', textAlign: 'center',
          fontSize: '14px', color: '#c2410c', fontWeight: '600'
        }}>
          ⚠️ Tu sesión expiró. Vuelve a iniciar sesión.
        </div>
      )}
      <Login />
    </div>
  )

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
