import { useState } from 'react'
import { supabase } from './supabase'

const TEAL = '#1a8a8a'
const TEAL_DARK = '#0d5f5f'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [cargando, setCargando] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setCargando(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Correo o contraseña incorrectos')
    setCargando(false)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(150deg, ${TEAL} 0%, ${TEAL_DARK} 100%)`,
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        .login-input:focus { border-color: ${TEAL} !important; box-shadow: 0 0 0 3px ${TEAL}33 !important; outline: none !important; }
        .login-btn:hover { opacity: 0.92; }
        .login-btn:active { transform: scale(0.99); }
      `}</style>

      <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeUp 0.4s ease' }}>

        <div style={{
          background: 'white', borderRadius: '28px', padding: '40px 36px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.25)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <img
              src="/Logo_RubySalamanca.png"
              alt="Academia Ruby Salamanca"
              style={{ height: '80px', objectFit: 'contain', display: 'block', margin: '0 auto 14px' }}
            />
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '11px', fontWeight: '700', letterSpacing: '1.5px' }}>
              PORTAL ADMINISTRATIVO
            </p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>
                CORREO ELECTRÓNICO
              </label>
              <input
                className="login-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="nombre@email.com"
                style={{
                  width: '100%', padding: '13px 16px',
                  border: '2px solid #e5e7eb', borderRadius: '12px',
                  fontSize: '15px', boxSizing: 'border-box',
                  fontFamily: 'inherit', color: '#1f2937',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#6b7280', marginBottom: '8px', letterSpacing: '1px' }}>
                CONTRASEÑA
              </label>
              <input
                className="login-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '13px 16px',
                  border: '2px solid #e5e7eb', borderRadius: '12px',
                  fontSize: '15px', boxSizing: 'border-box',
                  fontFamily: 'inherit', color: '#1f2937',
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px',
                padding: '11px 14px', marginBottom: '18px',
                color: '#dc2626', fontSize: '13px', fontWeight: '600', textAlign: 'center'
              }}>
                {error}
              </div>
            )}

            <button
              className="login-btn"
              type="submit"
              disabled={cargando}
              style={{
                width: '100%', padding: '15px',
                background: cargando ? '#b2d8d8' : TEAL,
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: '700', cursor: cargando ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'opacity 0.2s, transform 0.1s'
              }}
            >
              {cargando ? 'Ingresando...' : 'Entrar →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
