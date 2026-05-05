import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'

export default function App() {

  if (window.location.pathname.startsWith('/profesor')) {
    return <ProfesorApp />
  }

  const [sesion, setSesion] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session)
      setCargando(false)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session)
    })
  }, [])

  if (cargando) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <p>Cargando...</p>
    </div>
  )

  if (!sesion) return <Login />
  return <Dashboard usuario={sesion.user} />
}
