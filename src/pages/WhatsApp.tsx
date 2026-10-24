// src/pages/WhatsApp.tsx
// Confirmación de clases por WhatsApp: enviar las confirmaciones y ver los mensajes.
// Solo admin y superadmin. La seguridad real está en el servidor:
// el programa "whatsapp-enviar" revisa el rol y la tabla de mensajes solo la pueden leer administradores.
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { hoyLocal } from '../utils/accionesPago'

const TEAL = '#1a8a8a'

function manana(): string {
  const [a, m, d] = hoyLocal().split('-').map(Number)
  const f = new Date(a, m - 1, d + 1)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

const ESTADOS: Record<string, { texto: string; color: string }> = {
  queued: { texto: 'En cola', color: '#64748b' },
  accepted: { texto: 'En cola', color: '#64748b' },
  sending: { texto: 'Enviando', color: '#64748b' },
  sent: { texto: 'Enviado', color: '#2563eb' },
  delivered: { texto: 'Entregado', color: '#166534' },
  read: { texto: 'Leído', color: '#166534' },
  failed: { texto: 'Falló', color: '#dc2626' },
  undelivered: { texto: 'No entregado', color: '#dc2626' },
  error: { texto: 'Error', color: '#dc2626' },
  sin_telefono: { texto: 'Sin teléfono', color: '#dc2626' },
  received: { texto: 'Recibido', color: '#7c3aed' },
  enviado_twiml: { texto: 'Respondido', color: '#166534' },
}

const BOTONES: Record<string, string> = { confirmar: '✅ Confirmar', no_puedo: '❌ No puedo', cambiar: '🔄 Cambiar día u hora' }

export default function WhatsApp() {
  const [fecha, setFecha] = useState(manana())
  const [limite, setLimite] = useState('1')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [errorEnvio, setErrorEnvio] = useState('')
  const [mensajes, setMensajes] = useState<any[]>([])
  const [cargando, setCargando] = useState(true)

  async function cargarMensajes() {
    setCargando(true)
    const { data } = await supabase.from('whatsapp_mensajes')
      .select('id, creado_en, direccion, tipo, telefono, telefono_real, estado, error, boton, cuerpo, prueba, variables, resultado, clientes(nombre)')
      .order('creado_en', { ascending: false })
      .limit(100)
    setMensajes(data || [])
    setCargando(false)
  }

  useEffect(() => { cargarMensajes() }, [])

  async function enviar() {
    const n = parseInt(limite)
    if (!fecha || !n || n < 1) { setErrorEnvio('Revisa la fecha y el número de clases.'); return }
    if (!window.confirm(`Se enviarán las confirmaciones de hasta ${n} clase(s) del ${fecha}.\n\n¿Continuar?`)) return
    setEnviando(true); setErrorEnvio(''); setResultado(null)
    const { data, error } = await supabase.functions.invoke('whatsapp-enviar', { body: { fecha, limite: n } })
    if (error) {
      let detalle = error.message
      try { const j = await (error as any).context?.json(); if (j?.error) detalle = j.error } catch { /* sin detalle */ }
      setErrorEnvio(detalle)
    } else {
      setResultado(data)
    }
    setEnviando(false)
    cargarMensajes()
  }

  const tarjeta = { background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '20px' }
  const campo = { padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '22px', color: '#1a1a1a' }}>WhatsApp</h1>
      <p style={{ margin: '0 0 20px', color: '#666', fontSize: '14px' }}>Confirmación de clases del día siguiente.</p>

      <div style={tarjeta}>
        <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: '15px' }}>Enviar confirmaciones</p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: '13px', color: '#555' }}>Clases del día<br />
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={campo} />
          </label>
          <label style={{ fontSize: '13px', color: '#555' }}>Máximo de clases<br />
            <input type="number" min={1} value={limite} onChange={e => setLimite(e.target.value)} style={{ ...campo, width: '90px' }} />
          </label>
          <button onClick={enviar} disabled={enviando}
            style={{ padding: '10px 20px', background: enviando ? '#94a3b8' : TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: enviando ? 'default' : 'pointer', fontSize: '14px', fontWeight: 600 }}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: '12px', color: '#888' }}>
          Mientras esté en modo prueba, los mensajes llegan solo a los números de prueba y los botones no cambian las clases.
        </p>

        {errorEnvio && <p style={{ margin: '12px 0 0', color: '#dc2626', fontSize: '14px' }}>⚠️ {errorEnvio}</p>}

        {resultado && (
          <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '14px' }}>
              <b style={{ color: resultado.modo === 'PRUEBA' ? '#b45309' : '#166534' }}>Modo {resultado.modo}</b>
              {' · '}{resultado.clases_del_dia} clase(s) pendientes ese día · {resultado.enviados} enviado(s) · {resultado.errores} error(es) · {resultado.omitidos} omitido(s)
            </p>
            {(resultado.detalle || []).map((d: any, i: number) => (
              <p key={i} style={{ margin: '2px 0', fontSize: '13px', color: /error/.test(d.resultado) ? '#dc2626' : '#444' }}>
                {d.hora} · {d.cliente}{d.para ? ` → ${d.para}` : ''} · {d.resultado}
              </p>
            ))}
          </div>
        )}
      </div>

      <div style={tarjeta}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '15px' }}>Últimos mensajes</p>
          <button onClick={cargarMensajes} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}>↻ Actualizar</button>
        </div>
        {cargando && <p style={{ color: '#aaa', fontSize: '14px' }}>Cargando…</p>}
        {!cargando && mensajes.length === 0 && <p style={{ color: '#aaa', fontSize: '14px' }}>Todavía no hay mensajes.</p>}
        {!cargando && mensajes.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#666', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '6px' }}>Fecha</th><th style={{ padding: '6px' }}>Tipo</th>
                  <th style={{ padding: '6px' }}>Cliente</th><th style={{ padding: '6px' }}>Teléfono</th>
                  <th style={{ padding: '6px' }}>Contenido</th><th style={{ padding: '6px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {mensajes.map(m => {
                  const est = ESTADOS[m.estado] || { texto: m.estado || '—', color: '#666' }
                  const tipo = m.direccion === 'entrante'
                    ? (m.boton ? '⬅️ Botón' : '⬅️ Mensaje')
                    : (m.tipo === 'confirmacion' ? '➡️ Confirmación' : '➡️ Respuesta')
                  const contenido = m.boton ? (BOTONES[m.boton] || m.boton)
                    : m.tipo === 'confirmacion' && m.variables ? `${m.variables['2']} · ${m.variables['3']}`
                    : (m.cuerpo || '')
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f8fafc', verticalAlign: 'top' }}>
                      <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{new Date(m.creado_en).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{tipo}{m.prueba && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#fef3c7', color: '#b45309', padding: '1px 6px', borderRadius: '6px' }}>prueba</span>}</td>
                      <td style={{ padding: '6px' }}>{m.clientes?.nombre || '—'}</td>
                      <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>{m.telefono || '—'}{m.prueba && m.telefono_real && m.telefono_real !== m.telefono && <div style={{ fontSize: '11px', color: '#999' }}>real: {m.telefono_real}</div>}</td>
                      <td style={{ padding: '6px', maxWidth: '360px' }}>{contenido}</td>
                      <td style={{ padding: '6px', color: est.color, whiteSpace: 'nowrap' }}>{est.texto}{m.error && <div style={{ fontSize: '11px', color: '#dc2626' }}>{m.error}</div>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
