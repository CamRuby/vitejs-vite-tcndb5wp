import { useState } from 'react'
import { supabase } from './supabase'
import Clientes from './pages/Clientes'
import Profesores from './pages/Profesores'
import Horarios from './pages/Horarios'
import Reportes from './pages/Reportes'
const MENU = [
  { id: 'clientes', label: 'Clientes' },
  { id: 'profesores', label: 'Profesores' },
  { id: 'horarios', label: 'Horarios' },
  { id: 'reportes', label: 'Reportes' },
]
export default function Dashboard({ usuario }: { usuario: any }) {
  const [seccion, setSeccion] = useState('clientes')
  const [clientesKey, setClientesKey] = useState(0)
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', overflow: 'hidden' }}>
      
      {/* Menú lateral */}
      <div style={{
        width: '220px',
        flexShrink: 0,
        background: '#1e293b',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0'
      }}>
        <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #334155' }}>
          <img src="/Logo_RubySalamanca.png" alt="Ruby Salamanca" style={{ width: '100%', maxWidth: '172px', display: 'block', marginBottom: '8px' }} />
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#94a3b8' }}>
            {usuario.email}
          </p>
        </div>
        <nav style={{ flex: 1, padding: '16px 0' }}>
          {MENU.map(item => (
            <button
              key={item.id}
              onClick={() => { setSeccion(item.id); if (item.id === 'clientes') setClientesKey(k => k + 1) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '12px 24px',
                textAlign: 'left',
                background: seccion === item.id ? '#2563eb' : 'transparent',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px',
                borderLeft: seccion === item.id ? '3px solid #60a5fa' : '3px solid transparent'
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #334155' }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              width: '100%',
              padding: '8px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div style={{ flex: 1, minWidth: 0, background: '#f8fafc', overflow: 'auto' }}>
        {seccion === 'clientes' && <Clientes key={clientesKey} />}
        {seccion === 'profesores' && <Profesores />}
        {seccion === 'horarios' && <Horarios />}
        {seccion === 'reportes' && <Reportes />}
      </div>
    </div>
  )
}
