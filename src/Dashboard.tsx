import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Inicio from './pages/Inicio'
import Clientes from './pages/Clientes'
import Profesores from './pages/Profesores'
import Horarios from './pages/Horarios'
import Reportes from './pages/Reportes'
import Importar from './pages/Importar'

const MENU = [
  { id: 'inicio',     label: 'Inicio',     icon: '⊞' },
  { id: 'clientes',   label: 'Clientes',   icon: '👥' },
  { id: 'profesores', label: 'Profesores', icon: '🎓' },
  { id: 'horarios',   label: 'Horarios',   icon: '📅' },
  { id: 'reportes',   label: 'Reportes',   icon: '📊' },
  { id: 'importar',   label: 'Importar',   icon: '📥' },
]

export default function Dashboard({ usuario }: { usuario: any }) {
  const [seccion, setSeccion]           = useState(() => sessionStorage.getItem('seccion') || 'inicio')
  const [inicioKey, setInicioKey]       = useState(0)
  const [clientesKey, setClientesKey]   = useState(0)
  const [profesoresKey, setProfesoresKey] = useState(0)
  const [noLeidas, setNoLeidas]         = useState(0)
  const [verNotif, setVerNotif]         = useState(false)
  const [notificaciones, setNotificaciones] = useState<any[]>([])
  const [verMenu, setVerMenu]           = useState(false)

  useEffect(() => { cargarNoLeidas() }, [seccion])

  async function cargarNoLeidas() {
    const { count } = await supabase
      .from('notificaciones').select('*', { count: 'exact', head: true })
      .eq('leida', false)
    setNoLeidas(count || 0)
  }

  async function abrirNotificaciones() {
    setVerNotif(true)
    const { data } = await supabase
      .from('notificaciones').select('*')
      .order('created_at', { ascending: false }).limit(30)
    setNotificaciones(data || [])
  }

  async function marcarTodasLeidas() {
    await supabase.from('notificaciones').update({ leida: true }).eq('leida', false)
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    setNoLeidas(0)
  }

  async function marcarLeida(id: string) {
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setNoLeidas(prev => Math.max(0, prev - 1))
  }

  function navegar(id: string) {
    setSeccion(id)
    sessionStorage.setItem('seccion', id)
    if (id === 'inicio')     setInicioKey(k => k + 1)
    if (id === 'clientes')   setClientesKey(k => k + 1)
    if (id === 'profesores') setProfesoresKey(k => k + 1)
    setVerNotif(false)
  }

  function tiempoRelativo(fecha: string) {
    const diff = Math.floor((Date.now() - new Date(fecha).getTime()) / 1000)
    if (diff < 60)   return 'ahora'
    if (diff < 3600) return `${Math.floor(diff/60)} min`
    if (diff < 86400) return `${Math.floor(diff/3600)} h`
    return `${Math.floor(diff/86400)} d`
  }

  function iconoTipo(tipo: string) {
    if (tipo === 'cancelacion_tardia')   return { emoji: '⏰', color: '#dc2626', bg: '#fef2f2' }
    if (tipo === 'cancelacion_a_tiempo') return { emoji: '✓',  color: '#166534', bg: '#f0fdf4' }
    if (tipo === 'inasistencia')         return { emoji: '⚠️', color: '#c2410c', bg: '#fff7ed' }
    return { emoji: '📌', color: '#1d4ed8', bg: '#eff6ff' }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', overflow: 'hidden' }}>

      {/* Menú lateral */}
      <div style={{ width: '200px', flexShrink: 0, background: '#1e293b', color: 'white', display: 'flex', flexDirection: 'column', padding: '24px 0' }}>
        <div style={{ padding: '0 24px 24px', borderBottom: '1px solid #334155' }}>
          <img src="/Logo_RubySalamanca.png" alt="Ruby Salamanca" style={{ width: '100%', maxWidth: '152px', display: 'block', marginBottom: '8px' }} />
        </div>
        <nav style={{ flex: 1, padding: '16px 0' }}>
          {MENU.map(item => (
            <button key={item.id} onClick={() => navegar(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 24px', textAlign: 'left', background: seccion === item.id ? '#2563eb' : 'transparent', color: 'white', border: 'none', cursor: 'pointer', fontSize: '15px', borderLeft: seccion === item.id ? '3px solid #60a5fa' : '3px solid transparent' }}>
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer: avatar + campana */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setVerMenu(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}>
                {(usuario.email || 'A').charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {usuario.email?.split('@')[0]}
              </span>
            </button>
            {verMenu && (
              <div style={{ position: 'absolute', bottom: '40px', left: 0, background: 'white', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', overflow: 'hidden', minWidth: '160px', zIndex: 100 }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>{usuario.email}</p>
                </div>
                <button onClick={() => supabase.auth.signOut()}
                  style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#dc2626' }}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* Campana */}
          <button onClick={abrirNotificaciones}
            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <span style={{ fontSize: '20px' }}>🔔</span>
            {noLeidas > 0 && (
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: 'white', fontSize: '10px', fontWeight: '700', width: '17px', height: '17px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1e293b' }}>
                {noLeidas > 9 ? '9+' : noLeidas}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Contenido principal — overflow-y auto, overflow-x hidden evita scroll horizontal de página */}
      <div style={{ flex: 1, minWidth: 0, background: '#f8fafc', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
        {seccion === 'inicio'     && <Inicio key={inicioKey} onNavegar={navegar} onNuevaNotificacion={cargarNoLeidas} />}
        {seccion === 'clientes'   && <Clientes key={clientesKey} />}
        {seccion === 'profesores' && <Profesores key={profesoresKey} />}
        {seccion === 'horarios'   && <Horarios />}
        {seccion === 'reportes'   && <Reportes />}
        {seccion === 'importar'   && <Importar />}
      </div>

      {/* Panel de notificaciones */}
      {verNotif && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 500 }} onClick={() => setVerNotif(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: '72px', left: '24px', width: '380px', background: 'white', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#1a1a1a' }}>Novedades</p>
                {noLeidas > 0 && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#666' }}>{noLeidas} sin leer</p>}
              </div>
              {noLeidas > 0 && (
                <button onClick={marcarTodasLeidas}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#1a8a8a', fontWeight: '500' }}>
                  Marcar todas como leídas
                </button>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notificaciones.length === 0 && (
                <p style={{ textAlign: 'center', color: '#aaa', padding: '32px 20px', fontSize: '14px' }}>Sin novedades</p>
              )}
              {notificaciones.map(n => {
                const { emoji, color, bg } = iconoTipo(n.tipo)
                return (
                  <div key={n.id} onClick={() => !n.leida && marcarLeida(n.id)}
                    style={{ padding: '14px 20px', borderBottom: '1px solid #f8fafc', background: n.leida ? 'white' : '#eff6ff', display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: n.leida ? 'default' : 'pointer' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                      {emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: n.leida ? '400' : '600', color: '#1a1a1a' }}>{n.mensaje}</p>
                      {n.detalle && <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>{n.detalle}</p>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#aaa', whiteSpace: 'nowrap', marginTop: '2px' }}>{tiempoRelativo(n.created_at)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {verMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setVerMenu(false)} />}
    </div>
  )
}
