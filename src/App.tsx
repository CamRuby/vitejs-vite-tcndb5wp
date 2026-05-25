import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Login from './Login'
import Dashboard from './Dashboard'
import ProfesorApp from './pages/ProfesorApp'

const esProfesor = window.location.pathname.startsWith('/profesor')

export default function App() {
  const [listo, setListo] = useState(false)
  const [rol, setRol] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
  }, [])

  if (!listo) return <div>Cargando...</div>
  return <div>Rol: {rol}</div>
}
