import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'

const esProfesor = window.location.pathname.startsWith('/profesor')

export default function App() {
  const [listo, setListo] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setListo(true)
    })
  }, [])

  if (!listo) return <div>Cargando...</div>
  return <div>Listo</div>
}
