import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'

const esProfesor = window.location.pathname.startsWith('/profesor')

export default function App() {
  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(!esProfesor)

  useEffect(() => {
    if (esProfesor) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session)
      setCargando(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session)
      // Registrar inicio de sesión en auditoría
      if (_event === 'SIGNED_IN' && session?.user?.email) {
        supabase.from('auditoria').insert({
          usuario_email: session.user.email,
          accion: 'inicio_sesion',
          entidad: 'auth',
          detalle: { portal: 'administrativo' }
        })
      }
    })
  }, [])

  if (esProfesor) return <ProfesorApp />
  if (cargando) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Cargando...</p>
    </div>
  )
  if (!sesion) return <Login />
  return <Dashboard usuario={sesion.user} />
}
