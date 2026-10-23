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

const checkStyle = { width: '22px', height: '22px', marginTop: '1px', accentColor: TEAL, flexShrink: 0, cursor: 'pointer' } as React.CSSProperties

const Obligatorio = () => <span style={{ color: '#ef4444' }}> *</span>

type Idioma = 'es' | 'en'

/* ─────────────────────────── Países para WhatsApp ─────────────────────────── */
// La bandera es un emoji: en celulares se ve la bandera; en computadores Windows se ven las letras (ej. "CO").
type Pais = { iso: string; codigo: string; es: string; en: string }
const PAISES: Pais[] = [
  { iso: 'CO', codigo: '57',  es: 'Colombia',        en: 'Colombia' },
  { iso: 'US', codigo: '1',   es: 'Estados Unidos',  en: 'United States' },
  { iso: 'CA', codigo: '1',   es: 'Canadá',          en: 'Canada' },
  { iso: 'MX', codigo: '52',  es: 'México',          en: 'Mexico' },
  { iso: 'VE', codigo: '58',  es: 'Venezuela',       en: 'Venezuela' },
  { iso: 'EC', codigo: '593', es: 'Ecuador',         en: 'Ecuador' },
  { iso: 'PE', codigo: '51',  es: 'Perú',            en: 'Peru' },
  { iso: 'PA', codigo: '507', es: 'Panamá',          en: 'Panama' },
  { iso: 'CR', codigo: '506', es: 'Costa Rica',      en: 'Costa Rica' },
  { iso: 'CL', codigo: '56',  es: 'Chile',           en: 'Chile' },
  { iso: 'AR', codigo: '54',  es: 'Argentina',       en: 'Argentina' },
  { iso: 'BR', codigo: '55',  es: 'Brasil',          en: 'Brazil' },
  { iso: 'DO', codigo: '1',   es: 'Rep. Dominicana', en: 'Dominican Rep.' },
  { iso: 'ES', codigo: '34',  es: 'España',          en: 'Spain' },
  { iso: 'FR', codigo: '33',  es: 'Francia',         en: 'France' },
  { iso: 'DE', codigo: '49',  es: 'Alemania',        en: 'Germany' },
  { iso: 'IT', codigo: '39',  es: 'Italia',          en: 'Italy' },
  { iso: 'GB', codigo: '44',  es: 'Reino Unido',     en: 'United Kingdom' },
]

function bandera(iso: string) {
  return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

/** Convierte país + número escrito a formato internacional (+573001234567). Devuelve '' si no es válido. */
function aInternacional(iso: string, numero: string): string {
  const pais = PAISES.find(p => p.iso === iso)
  if (!pais) return ''
  let d = numero.replace(/\D/g, '').replace(/^0+/, '')
  // Si la persona escribió también el indicativo, se quita
  if (iso === 'CO' && d.length === 12 && d.startsWith('57')) d = d.slice(2)
  if (pais.codigo === '1' && d.length === 11 && d.startsWith('1')) d = d.slice(1)
  if (iso === 'CO') return /^3\d{9}$/.test(d) ? `+57${d}` : ''      // celular colombiano: 10 dígitos que empiezan por 3
  if (pais.codigo === '1') return /^\d{10}$/.test(d) ? `+1${d}` : ''
  if (d.length < 6 || pais.codigo.length + d.length > 15) return ''
  return `+${pais.codigo}${d}`
}

/* ─────────────────────────── Textos ES / EN ─────────────────────────── */
const T = {
  es: {
    titulo: 'Formulario de registro',
    subtitulo: 'Completa tus datos para registrarte',
    obligatorios: 'indica un campo obligatorio.',
    secEstudiante: 'Datos del estudiante',
    ayudaEstudiante: 'Escribe aquí los datos de quien toma las clases. Si es menor de edad, los datos del acudiente van más abajo.',
    nombres: 'Nombres del estudiante', phNombres: 'Ej: María Camila',
    apellidos: 'Apellidos del estudiante', phApellidos: 'Ej: Rodríguez Pérez',
    fechaNac: 'Fecha de nacimiento',
    documento: 'N° de documento', phDocumento: 'Cédula o TI',
    ocupacion: 'Ocupación', phOcupacion: 'Ej: Estudiante, médico, ingeniero...',
    secContacto: 'Contacto',
    whatsapp: 'WhatsApp', ayudaWhatsapp: 'Por aquí confirmaremos tus clases. Si el estudiante es menor de edad, puede ser el del acudiente.',
    phCelular: 'Ej: 300 123 4567',
    correo: 'Correo electrónico', phCorreo: 'Ej: maria@correo.com',
    secUbicacion: 'Ubicación',
    direccion: 'Dirección', phDireccion: 'Ej: Cra 15 # 90-45, Apto 302',
    ciudad: 'Ciudad', phCiudad: 'Ej: Bogotá',
    secEmergencia: 'Contacto de emergencia',
    emNombre: 'Nombre del contacto', phEmNombre: 'Nombre completo',
    emTelefono: 'Teléfono del contacto', phEmTelefono: 'Ej: 3009876543',
    secAdicional: 'Información adicional',
    menor: 'El estudiante es menor de edad', ayudaMenor: 'Requerirá datos del acudiente',
    discapacidad: 'Presenta discapacidad física',
    condicion: 'Condición especial de aprendizaje', phCondicion: 'Describir si aplica (opcional)',
    secAcudiente: 'Datos del acudiente',
    acNombres: 'Nombres del acudiente', phAcNombres: 'Nombres',
    acApellidos: 'Apellidos del acudiente', phAcApellidos: 'Apellidos',
    acWhatsapp: 'WhatsApp del acudiente',
    acDocumento: 'Documento del acudiente', phAcDocumento: 'N° documento',
    secFactura: 'Factura electrónica',
    preguntaFactura: '¿Deseas recibir factura electrónica?',
    si: 'Sí', no: 'No',
    copiarEstudiante: 'Usar los datos del estudiante',
    copiarAcudiente: 'Usar los datos del acudiente',
    fNombre: 'Nombres y apellidos (o razón social)', phFNombre: 'A nombre de quién sale la factura',
    fTipo: 'Tipo de documento', fTipoElegir: 'Elige una opción',
    tipos: { CC: 'Cédula de ciudadanía', CE: 'Cédula de extranjería', NIT: 'NIT' } as Record<string, string>,
    fDocumento: 'Número de documento', phFDocumento: 'Sin puntos',
    fCorreo: 'Correo para la factura', phFCorreo: 'Ej: facturas@correo.com',
    secAutorizacion: 'Autorización',
    autoriza: 'Autorizo a Ruby Salamanca el tratamiento de mis datos personales y acepto recibir mensajes por WhatsApp y correo sobre mis clases.',
    autorizaMenor: 'Como acudiente, autorizo a Ruby Salamanca el tratamiento de mis datos personales y los del estudiante, y acepto recibir mensajes por WhatsApp y correo sobre sus clases.',
    verPolitica: 'Ver política de tratamiento de datos', ocultarPolitica: 'Ocultar política',
    politica: [
      'Responsable: IDEAL BUSINESS SAS (Centro Artístico Ruby Salamanca), NIT 901.257.419-4.',
      'Finalidad: gestionar tu registro y tus clases, programar y confirmar sesiones, facturar y comunicarnos contigo por WhatsApp, teléfono o correo electrónico.',
      'Los datos de menores de edad se tratan con la autorización de su acudiente y respetando sus derechos.',
      'Tus derechos: puedes conocer, actualizar, corregir y pedir que se borren tus datos, o retirar esta autorización, escribiendo a camrubysp@gmail.com.',
      'Ley 1581 de 2012 y Decreto 1377 de 2013.',
    ],
    enviar: '✓ Enviar registro', enviando: 'Enviando...',
    pie: 'Academia Ruby Salamanca · Tus datos están seguros 🔒',
    exitoTitulo: '¡Registro exitoso!',
    exitoGracias: (n: string) => `Gracias, ${n}. Tus datos quedaron registrados correctamente.`,
    exitoSigue: 'Pronto nos pondremos en contacto para completar tu registro en la Academia Ruby Salamanca. 🎵',
    err: {
      falta_nombre: 'Escribe los nombres y apellidos del estudiante.',
      falta_fecha_nacimiento: 'Escribe la fecha de nacimiento.',
      fecha_invalida: 'La fecha de nacimiento no es válida.',
      falta_documento: 'Escribe el número de documento del estudiante.',
      falta_ocupacion: 'Escribe la ocupación.',
      telefono_invalido: 'Revisa el número de WhatsApp. Para Colombia son 10 dígitos y empieza por 3.',
      email_invalido: 'Revisa el correo electrónico.',
      falta_ubicacion: 'Escribe la dirección y la ciudad.',
      falta_emergencia: 'Escribe el nombre y el teléfono del contacto de emergencia.',
      faltan_datos: 'Faltan datos obligatorios. Revisa los campos con *.',
      faltan_datos_acudiente: 'Completa los datos del acudiente.',
      telefono_acudiente_invalido: 'Revisa el WhatsApp del acudiente. Para Colombia son 10 dígitos y empieza por 3.',
      falta_respuesta_factura: 'Indica si deseas factura electrónica.',
      faltan_datos_factura: 'Completa los datos de la factura electrónica.',
      tipo_documento_invalido: 'Elige el tipo de documento de la factura.',
      email_factura_invalido: 'Revisa el correo para la factura.',
      falta_autorizacion: 'Debes aceptar la autorización de tratamiento de datos para continuar.',
      repetido: 'Ya recibimos un registro con este WhatsApp hace unos minutos. Si necesitas corregir algo, escríbenos.',
      general: 'Ocurrió un error al enviar. Por favor intenta de nuevo.',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Registration form',
    subtitulo: 'Fill in your details to register',
    obligatorios: 'indicates a required field.',
    secEstudiante: 'Student information',
    ayudaEstudiante: 'Enter the details of the person taking the lessons. If the student is a minor, the guardian’s details go further below.',
    nombres: 'Student’s first name(s)', phNombres: 'E.g. Mary Ann',
    apellidos: 'Student’s last name(s)', phApellidos: 'E.g. Smith Johnson',
    fechaNac: 'Date of birth',
    documento: 'ID number', phDocumento: 'ID or passport',
    ocupacion: 'Occupation', phOcupacion: 'E.g. Student, doctor, engineer...',
    secContacto: 'Contact',
    whatsapp: 'WhatsApp', ayudaWhatsapp: 'We will confirm your lessons here. If the student is a minor, it can be the guardian’s number.',
    phCelular: 'E.g. 300 123 4567',
    correo: 'Email', phCorreo: 'E.g. mary@email.com',
    secUbicacion: 'Address',
    direccion: 'Street address', phDireccion: 'E.g. Cra 15 # 90-45, Apt 302',
    ciudad: 'City', phCiudad: 'E.g. Bogotá',
    secEmergencia: 'Emergency contact',
    emNombre: 'Contact name', phEmNombre: 'Full name',
    emTelefono: 'Contact phone', phEmTelefono: 'E.g. 3009876543',
    secAdicional: 'Additional information',
    menor: 'The student is under 18', ayudaMenor: 'Guardian details will be required',
    discapacidad: 'Has a physical disability',
    condicion: 'Special learning needs', phCondicion: 'Describe if applicable (optional)',
    secAcudiente: 'Guardian information',
    acNombres: 'Guardian’s first name(s)', phAcNombres: 'First name(s)',
    acApellidos: 'Guardian’s last name(s)', phAcApellidos: 'Last name(s)',
    acWhatsapp: 'Guardian’s WhatsApp',
    acDocumento: 'Guardian’s ID number', phAcDocumento: 'ID number',
    secFactura: 'Electronic invoice',
    preguntaFactura: 'Would you like to receive an electronic invoice?',
    si: 'Yes', no: 'No',
    copiarEstudiante: 'Use the student’s details',
    copiarAcudiente: 'Use the guardian’s details',
    fNombre: 'Full name (or company name)', phFNombre: 'Who the invoice is issued to',
    fTipo: 'ID type', fTipoElegir: 'Choose an option',
    tipos: { CC: 'Colombian ID (CC)', CE: 'Foreigner ID (CE)', NIT: 'Tax ID (NIT)' } as Record<string, string>,
    fDocumento: 'ID number', phFDocumento: 'No dots',
    fCorreo: 'Invoice email', phFCorreo: 'E.g. invoices@email.com',
    secAutorizacion: 'Consent',
    autoriza: 'I authorize Ruby Salamanca to process my personal data and I agree to receive WhatsApp and email messages about my lessons.',
    autorizaMenor: 'As the guardian, I authorize Ruby Salamanca to process my personal data and the student’s, and I agree to receive WhatsApp and email messages about their lessons.',
    verPolitica: 'View data processing policy', ocultarPolitica: 'Hide policy',
    politica: [
      'Data controller: IDEAL BUSINESS SAS (Centro Artístico Ruby Salamanca), NIT 901.257.419-4.',
      'Purpose: to manage your registration and lessons, schedule and confirm sessions, issue invoices, and contact you by WhatsApp, phone or email.',
      'Data of minors is processed with their guardian’s consent and respecting their rights.',
      'Your rights: you may access, update, correct or request deletion of your data, or withdraw this consent, by writing to camrubysp@gmail.com.',
      'Colombian Law 1581 of 2012 and Decree 1377 of 2013.',
    ],
    enviar: '✓ Submit registration', enviando: 'Sending...',
    pie: 'Academia Ruby Salamanca · Your data is safe 🔒',
    exitoTitulo: 'Registration successful!',
    exitoGracias: (n: string) => `Thank you, ${n}. Your details have been registered.`,
    exitoSigue: 'We will contact you soon to complete your registration at Academia Ruby Salamanca. 🎵',
    err: {
      falta_nombre: 'Please enter the student’s first and last names.',
      falta_fecha_nacimiento: 'Please enter the date of birth.',
      fecha_invalida: 'The date of birth is not valid.',
      falta_documento: 'Please enter the student’s ID number.',
      falta_ocupacion: 'Please enter the occupation.',
      telefono_invalido: 'Please check the WhatsApp number. Colombian mobiles have 10 digits and start with 3.',
      email_invalido: 'Please check the email address.',
      falta_ubicacion: 'Please enter the street address and city.',
      falta_emergencia: 'Please enter the emergency contact’s name and phone.',
      faltan_datos: 'Some required fields are missing. Please check the fields marked with *.',
      faltan_datos_acudiente: 'Please complete the guardian’s details.',
      telefono_acudiente_invalido: 'Please check the guardian’s WhatsApp. Colombian mobiles have 10 digits and start with 3.',
      falta_respuesta_factura: 'Please tell us whether you want an electronic invoice.',
      faltan_datos_factura: 'Please complete the electronic invoice details.',
      tipo_documento_invalido: 'Please choose the invoice ID type.',
      email_factura_invalido: 'Please check the invoice email.',
      falta_autorizacion: 'You must accept the data processing consent to continue.',
      repetido: 'We already received a registration with this WhatsApp a few minutes ago. If you need to correct something, please write to us.',
      general: 'Something went wrong. Please try again.',
    } as Record<string, string>,
  },
}

/* ─────────────────────────── Piezas visuales ─────────────────────────── */
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

function Campo({ label, required, ayuda, children }: { label: string; required?: boolean; ayuda?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={lbl}>{label}{required && <Obligatorio />}</label>
      {ayuda && <p style={{ margin: '-2px 0 8px', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>{ayuda}</p>}
      {children}
    </div>
  )
}

function Telefono({ pais, numero, onPais, onNumero, idioma, placeholder }: {
  pais: string; numero: string; onPais: (v: string) => void; onNumero: (v: string) => void; idioma: Idioma; placeholder: string
}) {
  const actual = PAISES.find(p => p.iso === pais) || PAISES[0]
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {/* Lo que se ve: bandera + indicativo */}
        <div style={{ ...inp, width: 'auto', minWidth: '104px', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '28px' }}>
          <span style={{ fontSize: '20px', lineHeight: 1 }}>{bandera(actual.iso)}</span>
          <span>+{actual.codigo}</span>
          <span style={{ position: 'absolute', right: '12px', color: '#888', fontSize: '12px' }}>▼</span>
        </div>
        {/* Selector invisible encima: al tocar abre la lista de países */}
        <select value={pais} onChange={e => onPais(e.target.value)} aria-label={idioma === 'es' ? 'País' : 'Country'}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer', fontSize: '16px' }}>
          {PAISES.map(p => (
            <option key={p.iso} value={p.iso}>{bandera(p.iso)} {p[idioma]} (+{p.codigo})</option>
          ))}
        </select>
      </div>
      <input type="tel" value={numero} onChange={e => onNumero(e.target.value)}
        placeholder={placeholder} style={{ ...inp, flex: 1, minWidth: 0 }} inputMode="tel" autoComplete="tel-national" />
    </div>
  )
}

/* ─────────────────────────── Formulario ─────────────────────────── */
export default function RegistroCliente() {
  const [idioma, setIdioma] = useState<Idioma>('es')
  const t = T[idioma]

  const [form, setForm] = useState<Record<string, any>>({
    nombres: '', apellidos: '', fecha_nacimiento: '', numero_identificacion: '',
    ocupacion: '', direccion: '', ciudad: '', email: '',
    tel_pais: 'CO', tel_numero: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
    menor_de_edad: false, acudiente_nombres: '', acudiente_apellidos: '',
    ac_pais: 'CO', ac_numero: '', acudiente_documento: '',
    discapacidad_fisica: false, condicion_aprendizaje: '',
    requiere_factura: null,       // null = aún no responde; true / false
    copiar_datos: false,
    factura_nombre: '', factura_tipo_documento: '', factura_documento: '', factura_email: '',
    autoriza_datos: false,
  })
  const [verPolitica, setVerPolitica] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado]   = useState(false)
  const [error, setError]       = useState('')   // código del error; el texto sale en el idioma elegido

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  /** Copia a la factura los datos del estudiante (o del acudiente si es menor). Se pueden corregir después. */
  function copiarDatosFactura(marcar: boolean) {
    setForm(p => {
      if (!marcar) return { ...p, copiar_datos: false }
      const delAcudiente = !!p.menor_de_edad
      return {
        ...p,
        copiar_datos: true,
        factura_nombre: delAcudiente
          ? `${p.acudiente_nombres.trim()} ${p.acudiente_apellidos.trim()}`.trim()
          : `${p.nombres.trim()} ${p.apellidos.trim()}`.trim(),
        factura_tipo_documento: p.factura_tipo_documento || 'CC',
        factura_documento: String(delAcudiente ? p.acudiente_documento : p.numero_identificacion).replace(/[^\dA-Za-z]/g, ''),
        factura_email: p.email.trim(),
      }
    })
  }

  /** Revisa los obligatorios antes de enviar. Devuelve el código del primer problema, o '' si todo está bien. */
  function validar(telefono: string, telAcudiente: string): string {
    const vacio = (k: string) => !String(form[k] ?? '').trim()
    const correoOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s).trim())
    if (vacio('nombres') || vacio('apellidos')) return 'falta_nombre'
    if (vacio('fecha_nacimiento')) return 'falta_fecha_nacimiento'
    if (form.fecha_nacimiento > new Date().toISOString().split('T')[0]) return 'fecha_invalida'
    if (vacio('numero_identificacion')) return 'falta_documento'
    if (vacio('ocupacion')) return 'falta_ocupacion'
    if (!telefono) return 'telefono_invalido'
    if (!correoOk(form.email)) return 'email_invalido'
    if (vacio('direccion') || vacio('ciudad')) return 'falta_ubicacion'
    if (vacio('contacto_emergencia_nombre') || vacio('contacto_emergencia_telefono')) return 'falta_emergencia'
    if (form.menor_de_edad) {
      if (vacio('acudiente_nombres') || vacio('acudiente_apellidos') || vacio('acudiente_documento')) return 'faltan_datos_acudiente'
      if (!telAcudiente) return 'telefono_acudiente_invalido'
    }
    if (form.requiere_factura === null) return 'falta_respuesta_factura'
    if (form.requiere_factura) {
      if (vacio('factura_nombre') || vacio('factura_documento')) return 'faltan_datos_factura'
      if (!['CC', 'CE', 'NIT'].includes(form.factura_tipo_documento)) return 'tipo_documento_invalido'
      if (!correoOk(form.factura_email)) return 'email_factura_invalido'
    }
    if (!form.autoriza_datos) return 'falta_autorizacion'
    return ''
  }

  async function enviar() {
    const telefono = aInternacional(form.tel_pais, form.tel_numero)
    const telAcudiente = form.menor_de_edad ? aInternacional(form.ac_pais, form.ac_numero) : ''
    const problema = validar(telefono, telAcudiente)
    if (problema) { setError(problema); return }
    setError(''); setEnviando(true)

    // Se envía a la función "portero" de la base de datos, que vuelve a validar y guarda solo lo permitido.
    const { data, error: err } = await supabase.rpc('registrar_cliente_publico', {
      p: {
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        fecha_nacimiento: form.fecha_nacimiento,
        numero_identificacion: form.numero_identificacion.trim(),
        ocupacion: form.ocupacion.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim(),
        telefono,
        email: form.email.trim(),
        contacto_emergencia_nombre: form.contacto_emergencia_nombre.trim(),
        contacto_emergencia_telefono: form.contacto_emergencia_telefono.trim(),
        menor_de_edad: !!form.menor_de_edad,
        acudiente_nombres: form.acudiente_nombres.trim(),
        acudiente_apellidos: form.acudiente_apellidos.trim(),
        acudiente_telefono: telAcudiente,
        acudiente_documento: form.acudiente_documento.trim(),
        discapacidad_fisica: !!form.discapacidad_fisica,
        condicion_aprendizaje: form.condicion_aprendizaje.trim(),
        requiere_factura: !!form.requiere_factura,
        factura_nombre: form.factura_nombre.trim(),
        factura_tipo_documento: form.factura_tipo_documento,
        factura_documento: form.factura_documento.trim(),
        factura_email: form.factura_email.trim(),
        idioma,
        autoriza_datos: !!form.autoriza_datos,
      },
    })

    setEnviando(false)
    if (err) { setError('general'); return }
    const r = data as { ok: boolean; codigo: string } | null
    if (!r?.ok) { setError(r?.codigo || 'general'); return }
    setEnviado(true)
  }

  /* ── Botón ES / EN (encabezado) ── */
  const selectorIdioma = (
    <div style={{ position: 'absolute', top: '14px', right: '14px', display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: '20px', padding: '3px' }}>
      {(['es', 'en'] as Idioma[]).map(l => (
        <button key={l} type="button" onClick={() => setIdioma(l)} aria-pressed={idioma === l}
          style={{ border: 'none', cursor: 'pointer', borderRadius: '16px', padding: '5px 12px', fontSize: '13px', fontWeight: '700',
            background: idioma === l ? 'white' : 'transparent', color: idioma === l ? TEAL : 'white' }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )

  /* ── Pantalla de éxito ── */
  if (enviado) return (
    <div lang={idioma} style={{ minHeight: '100vh', background: TEAL_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '24px', padding: '40px 32px', maxWidth: '440px', width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.10)' }}>
        <div style={{ width: '80px', height: '80px', background: TEAL_LIGHT, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '40px', color: TEAL }}>✓</div>
        <h2 style={{ margin: '0 0 12px', fontSize: '22px', color: '#1a1a1a', fontWeight: '700' }}>{t.exitoTitulo}</h2>
        <p style={{ margin: '0 0 10px', fontSize: '15px', color: '#555', lineHeight: '1.7' }}>{t.exitoGracias(form.nombres.trim())}</p>
        <p style={{ margin: 0, fontSize: '14px', color: '#888', lineHeight: '1.7' }}>{t.exitoSigue}</p>
      </div>
    </div>
  )

  const opcionSiNo = (valor: boolean, texto: string) => (
    <button type="button" onClick={() => set('requiere_factura', valor)} aria-pressed={form.requiere_factura === valor}
      style={{ flex: 1, padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer',
        border: `2px solid ${form.requiere_factura === valor ? TEAL : '#d1d5db'}`,
        background: form.requiere_factura === valor ? TEAL_LIGHT : 'white',
        color: form.requiere_factura === valor ? TEAL : '#374151' }}>
      {texto}
    </button>
  )

  /* ── Formulario ── */
  return (
    <div lang={idioma} style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '520px', height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Encabezado */}
        <div style={{ position: 'relative', background: TEAL, padding: '52px 24px 36px', textAlign: 'center', flexShrink: 0 }}>
          {selectorIdioma}
          <img src="/Logo_RubySalamanca.png" alt="Academia Ruby Salamanca"
            style={{ height: '50px', objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.95, display: 'block', margin: '0 auto 14px' }} />
          <h1 style={{ margin: '0 0 6px', color: 'white', fontSize: '21px', fontWeight: '700' }}>{t.titulo}</h1>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>{t.subtitulo}</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px 60px' }}>

        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
          <span style={{ color: '#ef4444' }}>*</span> {t.obligatorios}
        </p>

        {/* ── Datos del estudiante ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo={t.secEstudiante} />
          <p style={{ margin: '-6px 0 14px', fontSize: '13px', color: '#64748b', lineHeight: 1.4 }}>{t.ayudaEstudiante}</p>
          <Campo label={t.nombres} required>
            <input value={form.nombres} onChange={e => set('nombres', e.target.value)}
              placeholder={t.phNombres} style={inp} autoComplete="given-name" />
          </Campo>
          <Campo label={t.apellidos} required>
            <input value={form.apellidos} onChange={e => set('apellidos', e.target.value)}
              placeholder={t.phApellidos} style={inp} autoComplete="family-name" />
          </Campo>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={lbl}>{t.fechaNac}<Obligatorio /></label>
              <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)}
                max={new Date().toISOString().split('T')[0]} style={inp} />
            </div>
            <div>
              <label style={lbl}>{t.documento}<Obligatorio /></label>
              <input value={form.numero_identificacion} onChange={e => set('numero_identificacion', e.target.value)}
                placeholder={t.phDocumento} style={inp} />
            </div>
          </div>
          <Campo label={t.ocupacion} required>
            <input value={form.ocupacion} onChange={e => set('ocupacion', e.target.value)}
              placeholder={t.phOcupacion} style={inp} />
          </Campo>
        </div>

        {/* ── Contacto ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo={t.secContacto} />
          <Campo label={t.whatsapp} required ayuda={t.ayudaWhatsapp}>
            <Telefono pais={form.tel_pais} numero={form.tel_numero} idioma={idioma} placeholder={t.phCelular}
              onPais={v => set('tel_pais', v)} onNumero={v => set('tel_numero', v)} />
          </Campo>
          <Campo label={t.correo} required>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder={t.phCorreo} style={inp} inputMode="email" autoComplete="email" />
          </Campo>
        </div>

        {/* ── Ubicación ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo={t.secUbicacion} />
          <Campo label={t.direccion} required>
            <input value={form.direccion} onChange={e => set('direccion', e.target.value)}
              placeholder={t.phDireccion} style={inp} autoComplete="street-address" />
          </Campo>
          <Campo label={t.ciudad} required>
            <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
              placeholder={t.phCiudad} style={inp} autoComplete="address-level2" />
          </Campo>
        </div>

        {/* ── Contacto de emergencia ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo={t.secEmergencia} />
          <Campo label={t.emNombre} required>
            <input value={form.contacto_emergencia_nombre} onChange={e => set('contacto_emergencia_nombre', e.target.value)}
              placeholder={t.phEmNombre} style={inp} />
          </Campo>
          <Campo label={t.emTelefono} required>
            <input type="tel" value={form.contacto_emergencia_telefono} onChange={e => set('contacto_emergencia_telefono', e.target.value)}
              placeholder={t.phEmTelefono} style={inp} inputMode="tel" />
          </Campo>
        </div>

        {/* ── Información adicional ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo={t.secAdicional} />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'white', borderRadius: '12px', border: '1.5px solid #e5e7eb', cursor: 'pointer', marginBottom: '12px' }}>
            <input type="checkbox" checked={form.menor_de_edad} onChange={e => set('menor_de_edad', e.target.checked)} style={checkStyle} />
            <div>
              <span style={{ display: 'block', fontSize: '15px', fontWeight: '600', color: '#1a1a1a' }}>{t.menor}</span>
              <span style={{ display: 'block', fontSize: '13px', color: '#888', marginTop: '2px' }}>{t.ayudaMenor}</span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'white', borderRadius: '12px', border: '1.5px solid #e5e7eb', cursor: 'pointer', marginBottom: '16px' }}>
            <input type="checkbox" checked={form.discapacidad_fisica} onChange={e => set('discapacidad_fisica', e.target.checked)} style={checkStyle} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#1a1a1a', marginTop: '1px' }}>{t.discapacidad}</span>
          </label>

          <Campo label={t.condicion}>
            <input value={form.condicion_aprendizaje} onChange={e => set('condicion_aprendizaje', e.target.value)}
              placeholder={t.phCondicion} style={inp} />
          </Campo>
        </div>

        {/* ── Datos del acudiente (solo si es menor) ── */}
        {form.menor_de_edad && (
          <div style={{ marginBottom: '32px', background: '#fffbeb', borderRadius: '16px', padding: '20px', border: '1.5px solid #fde68a' }}>
            <Seccion titulo={t.secAcudiente} color="#92400e" borde="#fde68a" />
            <Campo label={t.acNombres} required>
              <input value={form.acudiente_nombres} onChange={e => set('acudiente_nombres', e.target.value)}
                placeholder={t.phAcNombres} style={inp} />
            </Campo>
            <Campo label={t.acApellidos} required>
              <input value={form.acudiente_apellidos} onChange={e => set('acudiente_apellidos', e.target.value)}
                placeholder={t.phAcApellidos} style={inp} />
            </Campo>
            <Campo label={t.acWhatsapp} required>
              <Telefono pais={form.ac_pais} numero={form.ac_numero} idioma={idioma} placeholder={t.phCelular}
                onPais={v => set('ac_pais', v)} onNumero={v => set('ac_numero', v)} />
            </Campo>
            <Campo label={t.acDocumento} required>
              <input value={form.acudiente_documento} onChange={e => set('acudiente_documento', e.target.value)}
                placeholder={t.phAcDocumento} style={inp} />
            </Campo>
          </div>
        )}

        {/* ── Factura electrónica ── */}
        <div style={{ marginBottom: '32px' }}>
          <Seccion titulo={t.secFactura} />
          <Campo label={t.preguntaFactura} required>
            <div style={{ display: 'flex', gap: '10px' }}>
              {opcionSiNo(true, t.si)}
              {opcionSiNo(false, t.no)}
            </div>
          </Campo>

          {form.requiere_factura === true && (<>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: TEAL_LIGHT, borderRadius: '12px', cursor: 'pointer', marginBottom: '16px' }}>
              <input type="checkbox" checked={form.copiar_datos} onChange={e => copiarDatosFactura(e.target.checked)} style={checkStyle} />
              <span style={{ fontSize: '15px', fontWeight: '600', color: TEAL }}>{form.menor_de_edad ? t.copiarAcudiente : t.copiarEstudiante}</span>
            </label>
            <Campo label={t.fNombre} required>
              <input value={form.factura_nombre} onChange={e => set('factura_nombre', e.target.value)}
                placeholder={t.phFNombre} style={inp} />
            </Campo>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={lbl}>{t.fTipo}<Obligatorio /></label>
                <select value={form.factura_tipo_documento} onChange={e => set('factura_tipo_documento', e.target.value)} style={{ ...inp, paddingRight: '8px' }}>
                  <option value="">{t.fTipoElegir}</option>
                  {['CC', 'CE', 'NIT'].map(k => <option key={k} value={k}>{t.tipos[k]}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t.fDocumento}<Obligatorio /></label>
                <input value={form.factura_documento} onChange={e => set('factura_documento', e.target.value)}
                  placeholder={t.phFDocumento} style={inp} />
              </div>
            </div>
            <Campo label={t.fCorreo} required>
              <input type="email" value={form.factura_email} onChange={e => set('factura_email', e.target.value)}
                placeholder={t.phFCorreo} style={inp} inputMode="email" />
            </Campo>
          </>)}
        </div>

        {/* ── Autorización de datos ── */}
        <div style={{ marginBottom: '28px' }}>
          <Seccion titulo={t.secAutorizacion} />
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'white', borderRadius: '12px', border: `1.5px solid ${form.autoriza_datos ? TEAL : '#e5e7eb'}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.autoriza_datos} onChange={e => set('autoriza_datos', e.target.checked)} style={checkStyle} />
            <span style={{ fontSize: '14px', color: '#1a1a1a', lineHeight: 1.5 }}>
              {form.menor_de_edad ? t.autorizaMenor : t.autoriza}<Obligatorio />
            </span>
          </label>
          <button type="button" onClick={() => setVerPolitica(v => !v)}
            style={{ background: 'none', border: 'none', color: TEAL, fontSize: '13px', fontWeight: '600', cursor: 'pointer', padding: '10px 2px', textDecoration: 'underline' }}>
            {verPolitica ? t.ocultarPolitica : t.verPolitica}
          </button>
          {verPolitica && (
            <div style={{ background: '#f1f5f9', borderRadius: '12px', padding: '14px 16px' }}>
              {t.politica.map((linea, i) => (
                <p key={i} style={{ margin: i === t.politica.length - 1 ? 0 : '0 0 8px', fontSize: '12.5px', color: '#475569', lineHeight: 1.5 }}>{linea}</p>
              ))}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px' }}>
            <p style={{ margin: 0, color: '#dc2626', fontSize: '14px', fontWeight: '500' }}>⚠️ {t.err[error] || t.err.general}</p>
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
          {enviando ? t.enviando : t.enviar}
        </button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#bbb', marginTop: '16px', lineHeight: '1.5' }}>{t.pie}</p>
        </div>
      </div>
    </div>
  )
}
