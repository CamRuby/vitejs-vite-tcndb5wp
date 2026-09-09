import { useState } from 'react'
import { supabase } from '../supabase'

const TEAL      = '#1a8a8a'
const TEAL_MID  = '#b2d8d8'
const TEAL_LIGHT = '#e8f5f5'

const inp: React.CSSProperties = {
  width: '100%', padding: '14px 16px',
  border: '1.5px solid #d1d5db', borderRadius: '12px',
  fontSize: '16px', // Evita el zoom automático en iOS
  boxSizing: 'border-box', outline: 'none',
  background: 'white', color: '#1a1a1a',
  WebkitAppearance: 'none',
}

const lbl: React.CSSProperties = {
  display: 'block', fontWeight: '600',
  fontSize: '14px', color: '#374151', marginBottom: '6px',
}

function Seccion({ titulo, color = TEAL, borde = TEAL_MID }: { titulo: string; color?: string; borde?: string }) {
  return (
    <p style={{
      fontSize: '13px', fontWeight: '700', color,
      textTransform: 'uppercase', letterSpacing: '0.8px',
      marginBottom: '16px', paddingBottom: '8px',
      borderBottom: `2px solid ${borde}`, marginTop: 0,
    }}>{titulo}</p>
  )
}

function Campo({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={lbl}>{label}{required && <span style={{ color: '#ef4444' }}> *</span>}</label>
      {children}
    </div>
  )
}

export default function RegistroCliente() {
  const [form, setForm] = useState<Record<string, any>>({
    nombres: '', apellidos: '', fecha_nacimiento: '', numero_identificacion: '',
    ocupacion: '', direccion: '', ciudad: '', telefono: '', email: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
    menor_de_edad: false, acudiente_nombres: '', acudiente_apellidos: '',
    acudiente_telefono: '', acudiente_documento: '',
    discapacidad_fisica: false, condicion_aprendizaje: '',
  })
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado]   = useState(false)
  const [error, setError]       = useState('')

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  async function enviar() {
    if (!form.nombres.trim())  { setError('El nombre es obligatorio.'); return }
    if (!form.apellidos.trim()) { setError('El apellido es obligatorio.'); return }
    if (!form.telefono.trim()) { setError('El teléfono es obligatorio.'); return }
    setError(''); setEnviando(true)

    const { error: err } = await supabase.from('clientes').insert({
      nombre:   `${form.nombres.trim()} ${form.apellidos.trim()}`.trim(),
      nombres:  form.nombres.trim(),
      apellidos: form.apellidos.trim(),
      fecha_nacimiento:               form.fecha_nacimiento || null,
      numero_identificacion:          form.numero_identificacion || null,
      ocupacion:                      form.ocupacion || null,
      direccion:                      form.direccion || null,
      ciudad:                         form.ciudad || null,
      telefono:                       form.telefono.trim(),
      email:                          form.email || null,
      contacto_emergencia_nombre:     form.contacto_emergencia_nombre || null,
      contacto_emergencia_telefono:   form.contacto_emergencia_telefono || null,
      menor_de_edad:                  form.menor_de_edad,
      acudiente_nombres:              form.menor_de_edad ? (form.acudiente_nombres || null) : null,
      acudiente_apellidos:            form.menor_de_edad ? (form.acudiente_apellidos || null) : null,
      acudiente_telefono:             form.menor_de_edad ? (form.acudiente_telefono || null) : null,
      acudiente_documento:            form.menor_de_edad ? (form.acudiente_documento || null) : null,
      discapacidad_fisica:            form.discapacidad_fisica,
      condicion_aprendizaje:          form.condicion_aprendizaje || null,
      estado: 'activo',
    })

    setEnviando(false)
    if (err) { setError('Ocurrió un error al enviar. Por favor intenta de nuevo.'); return }
    setEnviado(true)
  }

  /* ── Pantalla de éxito ── */
  if (enviado) return (
    <div style={{ minHeight: '100vh', background: TEAL_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '40px 32px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ width: '80px', height: '80px', background: TEAL_LIGHT, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '40px', color: TEAL }}>✓</div>
        <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#1a1a1a', fontWeight: '700' }}>¡Registro exitoso!</h2>
        <p style={{ margin: '0 0 10px', fontSize: '15px', color: '#555', lineHeight: '1.7' }}>
          Gracias, <strong>{form.nombres}</strong>. Tus datos han sido registrados correctamente.
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: '#888', lineHeight: '1.7' }}>
          Pronto nos pondremos en contacto para confirmar tu matrícula en la Academia Ruby Salamanca. 🎵
        </p>
      </div>
    </div>
  )

  /* ── Formulario ── */
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Encabezado */}
      <div style={{ background: TEAL, padding: '28px 24px 36px', textAlign: 'center' }}>
        <img src="/Logo_RubySalamanca.png" alt="Academia Ruby Salamanca"
          style={{ height: '50px', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.95, display: 'block', margin: '0 auto 14px' }} />
        <h1 style={{ margin: '0 0 6px', color: 'white', fontSize: '21px', fontWeight: '700' }}>Formulario de matrícula</h1>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>Completa tus datos para registrarte</p>
      </div>

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '28px 20px 60px' }}>

        {/* ── Datos personales ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo="Datos personales" />
          <Campo label="Nombres" required>
            <input value={form.nombres} onChange={e => set('nombres', e.target.value)}
              placeholder="Ej: María Camila" style={inp} autoComplete="given-name" />
          </Campo>
          <Campo label="Apellidos" required>
            <input value={form.apellidos} onChange={e => set('apellidos', e.target.value)}
              placeholder="Ej: Rodríguez Pérez" style={inp} autoComplete="family-name" />
          </Campo>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={lbl}>Fecha de nacimiento</label>
              <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>N° de documento</label>
              <input value={form.numero_identificacion} onChange={e => set('numero_identificacion', e.target.value)}
                placeholder="Cédula o TI" style={inp} inputMode="numeric" />
            </div>
          </div>
          <Campo label="Ocupación">
            <input value={form.ocupacion} onChange={e => set('ocupacion', e.target.value)}
              placeholder="Ej: Estudiante, médico, ingeniero..." style={inp} />
          </Campo>
        </div>

        {/* ── Contacto ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo="Contacto" />
          <Campo label="Teléfono / WhatsApp" required>
            <input type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)}
              placeholder="Ej: 3001234567" style={inp} inputMode="tel" autoComplete="tel" />
          </Campo>
          <Campo label="Correo electrónico">
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="Ej: maria@correo.com" style={inp} inputMode="email" autoComplete="email" />
          </Campo>
        </div>

        {/* ── Ubicación ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo="Ubicación" />
          <Campo label="Dirección">
            <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
              placeholder="Ej: Cra 15 # 90-45, Apto 302" style={inp} autoComplete="street-address" />
          </Campo>
          <Campo label="Ciudad">
            <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
              placeholder="Ej: Bogotá" style={inp} autoComplete="address-level2" />
          </Campo>
        </div>

        {/* ── Contacto de emergencia ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo="Contacto de emergencia" />
          <Campo label="Nombre del contacto">
            <input value={form.contacto_emergencia_nombre} onChange={e => set('contacto_emergencia_nombre', e.target.value)}
              placeholder="Nombre completo" style={inp} />
          </Campo>
          <Campo label="Teléfono del contacto">
            <input type="tel" value={form.contacto_emergencia_telefono} onChange={e => set('contacto_emergencia_telefono', e.target.value)}
              placeholder="Ej: 3009876543" style={inp} inputMode="tel" />
          </Campo>
        </div>

        {/* ── Información adicional ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo="Información adicional" />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'white', borderRadius: '12px', border: '1.5px solid #e5e7eb', cursor: 'pointer', marginBottom: '12px' }}>
            <input type="checkbox" checked={form.menor_de_edad} onChange={e => set('menor_de_edad', e.target.checked)}
              style={{ width: '22px', height: '22px', marginTop: '1px', accentColor: TEAL, flexShrink: 0, cursor: 'pointer' } as React.CSSProperties} />
            <div>
              <span style={{ display: 'block', fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>El estudiante es menor de edad</span>
              <span style={{ display: 'block', fontSize: '13px', color: '#888', marginTop: '2px' }}>Requerirá datos del acudiente</span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'white', borderRadius: '12px', border: '1.5px solid #e5e7eb', cursor: 'pointer', marginBottom: '16px' }}>
            <input type="checkbox" checked={form.discapacidad_fisica} onChange={e => set('discapacidad_fisica', e.target.checked)}
              style={{ width: '22px', height: '22px', marginTop: '1px', accentColor: TEAL, flexShrink: 0, cursor: 'pointer' } as React.CSSProperties} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a', marginTop: '1px' }}>Presenta discapacidad física</span>
          </label>

          <Campo label="Condición especial de aprendizaje">
            <input value={form.condicion_aprendizaje} onChange={e => set('condicion_aprendizaje', e.target.value)}
              placeholder="Describir si aplica (opcional)" style={inp} />
          </Campo>
        </div>

        {/* ── Datos del acudiente (solo si es menor) ── */}
        {form.menor_de_edad && (
          <div style={{ marginBottom: '32px', background: '#fffbeb', borderRadius: '16px', padding: '20px', border: '1.5px solid #fde68a' }}>
            <Seccion titulo="Datos del acudiente" color="#92400e" borde="#fde68a" />
            <Campo label="Nombres del acudiente">
              <input value={form.acudiente_nombres} onChange={e => set('acudiente_nombres', e.target.value)}
                placeholder="Nombres" style={inp} />
            </Campo>
            <Campo label="Apellidos del acudiente">
              <input value={form.acudiente_apellidos} onChange={e => set('acudiente_apellidos', e.target.value)}
                placeholder="Apellidos" style={inp} />
            </Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={lbl}>Teléfono</label>
                <input type="tel" value={form.acudiente_telefono} onChange={e => set('acudiente_telefono', e.target.value)}
                  placeholder="Celular" style={inp} inputMode="tel" />
              </div>
              <div>
                <label style={lbl}>Documento</label>
                <input value={form.acudiente_documento} onChange={e => set('acudiente_documento', e.target.value)}
                  placeholder="N° documento" style={inp} inputMode="numeric" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <p style={{ margin: 0, color: '#dc2626', fontSize: '14px', fontWeight: '500' }}>⚠️ {error}</p>
          </div>
        )}

        {/* Botón enviar */}
        <button onClick={enviar} disabled={enviando} style={{
          width: '100%', padding: '18px',
          background: enviando ? TEAL_MID : TEAL,
          color: 'white', border: 'none', borderRadius: '14px',
          fontSize: '17px', fontWeight: '700',
          cursor: enviando ? 'default' : 'pointer',
          boxShadow: enviando ? 'none' : `0 4px 14px ${TEAL}55`,
          transition: 'all 0.2s', letterSpacing: '0.3px',
        }}>
          {enviando ? 'Enviando...' : '✓ Enviar registro'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#bbb', marginTop: '16px', lineHeight: '1.5' }}>
          Academia Ruby Salamanca · Tus datos están seguros 🔒
        </p>
      </div>
    </div>
  )
}
