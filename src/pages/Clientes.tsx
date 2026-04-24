import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'

const estiloInput = {
  width: '100%', padding: '10px 12px',
  border: `1px solid ${TEAL_MID}`,
  borderRadius: '8px', fontSize: '15px',
  boxSizing: 'border-box' as const, marginTop: '6px',
  outline: 'none'
}
const labelStyle = { fontWeight: '500' as const, fontSize: '13px', color: '#555' }
const CLASES_PRESET = [4, 8, 16, 20, 40, 80]

const VISTAS = [
  { value: 'clientes',     label: '👤 Últimos 30 clientes registrados' },
  { value: 'planes',       label: '📋 Últimos 30 planes creados' },
  { value: 'completados',  label: '📁 Últimos 30 planes archivados' },
  { value: 'aplazados',    label: '⏸ Planes aplazados' },
  { value: 'reactivacion', label: '🔄 Planes completados (por renovar)' },
]

function colorEstadoPlan(e: string) {
  if (e === 'completado') return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
  if (e === 'aplazado')   return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  if (e === 'archivado')  return { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
  return { bg: TEAL_LIGHT, color: TEAL, border: TEAL_MID }
}

// ── Formulario cliente ──
function FormCliente({ modo, form, setForm, cargando, onGuardar, onVolver }) {
  const inp = (label: string, key: string, type = 'text', span = false) => (
    <div key={key} style={span ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={estiloInput} />
    </div>
  )
  const sec = (title: string) => (
    <div style={{ gridColumn: '1 / -1', borderTop: `2px solid ${TEAL_MID}`, paddingTop: '14px', marginTop: '4px' }}>
      <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: TEAL, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{title}</p>
    </div>
  )
  return (
    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ background: TEAL, padding: '20px 28px' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: '14px', padding: 0, marginBottom: '8px' }}>← Volver</button>
        <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>{modo === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}</h3>
      </div>
      <div style={{ padding: '28px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>

        {/* Estado fuera del encabezado de datos personales */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ ...labelStyle, margin: 0 }}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
              style={{ padding: '8px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px',
                background: form.estado === 'activo' ? '#dcfce7' : '#fee2e2',
                color: form.estado === 'activo' ? '#166534' : '#991b1b', fontWeight: '600' }}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {sec('Datos personales')}

          {/* Fila 1: Nombres · Apellidos · Identificación */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr', gap: '12px' }}>
            {inp('Nombres *', 'nombres')}
            {inp('Apellidos *', 'apellidos')}
            {inp('N° Identificación', 'numero_identificacion')}
          </div>

          {/* Fila 2: Fecha · Ocupación · Dirección · Ciudad */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '140px 1fr 2fr 140px', gap: '12px' }}>
            {inp('Fecha de nacimiento', 'fecha_nacimiento', 'date')}
            {inp('Ocupación', 'ocupacion')}
            {inp('Dirección', 'direccion')}
            {inp('Ciudad', 'ciudad')}
          </div>

          {sec('Contacto')}

          {/* Fila 3: Teléfono · Correo · WhatsApp */}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {inp('Teléfono', 'telefono')}
            {inp('Correo electrónico', 'email', 'email')}
            {inp('Grupo WhatsApp', 'grupo_whatsapp')}
          </div>

          {sec('Contacto de emergencia')}
          {inp('Nombre del contacto', 'contacto_emergencia_nombre')}
          {inp('Teléfono del contacto', 'contacto_emergencia_telefono')}

          {sec('Condiciones')}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={!!form.menor_de_edad} onChange={e => setForm({ ...form, menor_de_edad: e.target.checked })} />
              ¿El estudiante es menor de edad?
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={!!form.discapacidad_fisica} onChange={e => setForm({ ...form, discapacidad_fisica: e.target.checked })} />
              ¿Presenta discapacidad física?
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Condición especial de aprendizaje</label>
            <input value={form.condicion_aprendizaje || ''} onChange={e => setForm({ ...form, condicion_aprendizaje: e.target.value })}
              placeholder="Describir si aplica" style={estiloInput} />
          </div>

          {form.menor_de_edad && (<>
            {sec('Datos del acudiente')}
            {inp('Nombres del acudiente', 'acudiente_nombres')}
            {inp('Apellidos del acudiente', 'acudiente_apellidos')}
            {inp('Teléfono del acudiente', 'acudiente_telefono')}
            {inp('Documento del acudiente', 'acudiente_documento')}
          </>)}

        </div>
        <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
          <button onClick={onGuardar} disabled={cargando} style={{ padding: '11px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onVolver} style={{ padding: '11px 28px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal plan ──
function ModalPlan({ plan, profesores, instrumentos, sedes, onGuardar, onCerrar, esRenovacion = false }) {
  const esNuevo = !plan?.id || esRenovacion
  const [fp, setFp] = useState({
    instrumento_id: plan?.instrumento_id || '',
    profesor_id:    plan?.profesor_id    || '',
    sede_id:        plan?.sede_id        || '',
    total_clases:   plan?.total_clases   || 4,
    valor_plan:     plan?.valor_plan     || '',
    duracion_min:   plan?.duracion_min   || 60,
    fecha_inicio:   esRenovacion ? new Date().toISOString().split('T')[0] : (plan?.fecha_inicio || new Date().toISOString().split('T')[0]),
    estado:         esRenovacion ? 'activo' : (plan?.estado || 'activo'),
    clases_tomadas: esNuevo ? 0 : (plan?.clases_tomadas || 0),
  })
  const [clasesManual, setClasesManual] = useState(!CLASES_PRESET.includes(plan?.total_clases || 4))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!fp.instrumento_id) { setError('Selecciona un instrumento'); return }
    if (!fp.profesor_id)    { setError('Selecciona un profesor'); return }
    if (!fp.sede_id)        { setError('Selecciona una sede'); return }
    if (!fp.total_clases || Number(fp.total_clases) < 1) { setError('Ingresa el número de clases'); return }
    setGuardando(true)
    setError('')
    await onGuardar({
      tipo_plan:      'regular',
      instrumento_id: fp.instrumento_id,
      profesor_id:    fp.profesor_id,
      sede_id:        fp.sede_id,
      total_clases:   Number(fp.total_clases),
      clases_tomadas: esNuevo ? 0 : Number(fp.clases_tomadas),
      valor_plan:     fp.valor_plan !== '' ? Number(fp.valor_plan) : null,
      duracion_min:   Number(fp.duracion_min),
      fecha_inicio:   fp.fecha_inicio,
      estado:         fp.estado,
    }, esRenovacion ? undefined : plan?.id)
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ background: esRenovacion ? '#0f766e' : TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>{esRenovacion ? '🔄 Renovar plan' : esNuevo ? 'Crear plan' : 'Editar plan'}</h3>
            {esRenovacion && <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Características heredadas del plan anterior</p>}
          </div>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '24px', maxHeight: '78vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instrumento *</label>
              <select value={fp.instrumento_id} onChange={e => setFp({ ...fp, instrumento_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {instrumentos.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Profesor *</label>
              <select value={fp.profesor_id} onChange={e => setFp({ ...fp, profesor_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Sede *</label>
              <select value={fp.sede_id} onChange={e => setFp({ ...fp, sede_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {sedes.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Número de clases *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {CLASES_PRESET.map(n => (
                  <button key={n} type="button"
                    onClick={() => { setFp({ ...fp, total_clases: n }); setClasesManual(false) }}
                    style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', border: `2px solid ${!clasesManual && fp.total_clases === n ? TEAL : TEAL_MID}`, background: !clasesManual && fp.total_clases === n ? TEAL : 'white', color: !clasesManual && fp.total_clases === n ? 'white' : '#333' }}>{n}</button>
                ))}
                <button type="button" onClick={() => setClasesManual(true)} style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', border: `2px solid ${clasesManual ? TEAL : TEAL_MID}`, background: clasesManual ? TEAL : 'white', color: clasesManual ? 'white' : '#666' }}>Otro</button>
              </div>
              {clasesManual && (
                <input type="number" min={1} placeholder="Ingresa el número" value={fp.total_clases}
                  onChange={e => setFp({ ...fp, total_clases: e.target.value })}
                  style={{ ...estiloInput, marginTop: '10px' }} autoFocus />
              )}
            </div>
            <div>
              <label style={labelStyle}>Duración por clase</label>
              <select value={fp.duracion_min} onChange={e => setFp({ ...fp, duracion_min: e.target.value })} style={estiloInput}>
                {[30, 45, 60, 90].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Valor del plan ($)</label>
              <input type="number" min={0} value={fp.valor_plan} onChange={e => setFp({ ...fp, valor_plan: e.target.value })} style={estiloInput} />
            </div>
            <div>
              <label style={labelStyle}>Fecha de inicio</label>
              <input type="date" value={fp.fecha_inicio} onChange={e => setFp({ ...fp, fecha_inicio: e.target.value })} style={estiloInput} />
            </div>
            {!esNuevo && (
              <div>
                <label style={labelStyle}>Clases tomadas</label>
                <input type="number" min={0} value={fp.clases_tomadas} onChange={e => setFp({ ...fp, clases_tomadas: e.target.value })} style={estiloInput} />
              </div>
            )}
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={guardar} disabled={guardando} style={{ flex: 1, padding: '11px', background: esRenovacion ? '#0f766e' : TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
              {guardando ? 'Guardando...' : esRenovacion ? 'Crear renovación' : esNuevo ? 'Crear plan' : 'Guardar cambios'}
            </button>
            <button onClick={onCerrar} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal historial de planes ──
function ModalHistorialPlanes({ planes, onCerrar }) {
  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '95%', maxWidth: '900px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>📋 Historial de planes ({planes.length})</h3>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
              <tr>
                {['#', 'Instrumento', 'Sede', 'Profesor', 'Clases', 'Duración', 'Valor', 'Fecha inicio', 'Estado'].map(h => (
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planes.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Sin planes</td></tr>
              )}
              {planes.map((p: any, i) => {
                const est = colorEstadoPlan(p.estado || 'activo')
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                    <td style={{ ...tdS, color: '#aaa' }}>{planes.length - i}</td>
                    <td style={{ ...tdS, fontWeight: '500' }}>{p.instrumentos?.nombre || '—'}</td>
                    <td style={tdS}>{p.sedes?.nombre || '—'}</td>
                    <td style={tdS}>{p.profesores?.nombre || '—'}</td>
                    <td style={{ ...tdS, textAlign: 'center' }}>{p.clases_tomadas}/{p.total_clases}</td>
                    <td style={{ ...tdS, textAlign: 'center' }}>{p.duracion_min} min</td>
                    <td style={tdS}>{p.valor_plan ? `$${Number(p.valor_plan).toLocaleString()}` : '—'}</td>
                    <td style={{ ...tdS, color: '#888' }}>{p.fecha_inicio || '—'}</td>
                    <td style={tdS}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: est.bg, color: est.color }}>
                        {p.estado || 'activo'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tabla de planes reutilizable para vistas ──
function TablaPlanesVista({ planes, onVerCliente }) {
  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
          <tr>
            {['Cliente', 'Instrumento', 'Sede', 'Clases', 'Duración', 'Valor', 'Inicio', 'Estado'].map(h => (
              <th key={h} style={thS}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {planes.filter((p: any) => p.clientes?.nombre).length === 0 && (
            <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Sin registros</td></tr>
          )}
          {planes.filter((p: any) => p.clientes?.nombre).map((p: any, i) => {
            const est = colorEstadoPlan(p.estado || 'activo')
            return (
              <tr key={p.id} onClick={() => onVerCliente(p.cliente_id)}
                style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}
              >
                <td style={{ ...tdS, fontWeight: '600', color: TEAL }}>{p.clientes?.nombre || '—'}</td>
                <td style={tdS}>{p.instrumentos?.nombre || '—'}</td>
                <td style={tdS}>{p.sedes?.nombre || '—'}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{p.clases_tomadas}/{p.total_clases}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{p.duracion_min} min</td>
                <td style={tdS}>{p.valor_plan ? `$${Number(p.valor_plan).toLocaleString()}` : '—'}</td>
                <td style={{ ...tdS, color: '#888' }}>{p.fecha_inicio || '—'}</td>
                <td style={tdS}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: est.bg, color: est.color }}>
                    {p.estado || 'activo'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente principal ──
export default function Clientes() {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [vistaActual, setVistaActual] = useState('reactivacion')
  const [datosVista, setDatosVista] = useState<any[]>([])
  const [cargandoVista, setCargandoVista] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [planes, setPlanes] = useState<any[]>([])
  const [clases, setClases] = useState<any[]>([])
  const [inscripcionesTalleres, setInscripcionesTalleres] = useState<any[]>([])
  const [sesionesPorInscripcion, setSesionesPorInscripcion] = useState<Record<string, any[]>>({})
  const [inscripcionExpandida, setInscripcionExpandida] = useState<string | null>(null)
  const [modalHistorialTalleres, setModalHistorialTalleres] = useState(false)
  const [modo, setModo] = useState('lista')
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState({
    nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo',
    nombres: '', apellidos: '',
    fecha_nacimiento: '', numero_identificacion: '', ocupacion: '',
    direccion: '', ciudad: '',
    contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
    menor_de_edad: false,
    acudiente_nombres: '', acudiente_apellidos: '',
    acudiente_telefono: '', acudiente_documento: '',
    discapacidad_fisica: false, condicion_aprendizaje: ''
  })
  const [profesores, setProfesores] = useState<any[]>([])
  const [instrumentos, setInstrumentos] = useState<any[]>([])
  const [sedes, setSedes] = useState<any[]>([])
  const [modalPlan, setModalPlan] = useState<any>(null)
  const [modalTaller, setModalTaller] = useState(false)
  const [talleres, setTalleres] = useState<any[]>([])
  const [tallerSeleccionado, setTallerSeleccionado] = useState('')
  const [tallerValorPagado, setTallerValorPagado] = useState('')
  const [tallerGuardando, setTallerGuardando] = useState(false)
  const [tallerError, setTallerError] = useState('')
  const [esRenovacion, setEsRenovacion] = useState(false)
  const [modalHistorial, setModalHistorial] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [expandirFicha, setExpandirFicha] = useState(false)

  useEffect(() => { cargarBase() }, [])
  useEffect(() => { if (modo === 'lista' && instrumentos.length > 0) cargarVista(vistaActual) }, [vistaActual, instrumentos])
  useEffect(() => {
    if (busqueda.length >= 2) buscarClientes()
    else setClientes([])
  }, [busqueda])

  async function cargarBase() {
    const [{ data: ins }, { data: sed }, { data: pro }] = await Promise.all([
      supabase.from('instrumentos').select('id, nombre').order('nombre'),
      supabase.from('sedes').select('id, nombre').order('nombre'),
      supabase.from('profesores').select('id, nombre').order('nombre'),
    ])
    setInstrumentos(ins || [])
    setSedes(sed || [])
    setProfesores(pro || [])
    cargarVista('clientes')
  }

  async function cargarVista(vista: string) {
    setCargandoVista(true)
    const planSelect = 'id, cliente_id, total_clases, clases_tomadas, duracion_min, valor_plan, fecha_inicio, estado, instrumento_id, profesor_id, sede_id, clientes(id, nombre), instrumentos(nombre), sedes(nombre)'

    if (vista === 'clientes') {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email, grupo_whatsapp, estado, created_at')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30)
      setDatosVista(data || [])
    } else if (vista === 'planes') {
      const { data } = await supabase.from('contratos').select(planSelect).order('fecha_inicio', { ascending: false }).limit(30)
      setDatosVista(data || [])
    } else if (vista === 'completados') {
      const { data } = await supabase.from('contratos').select(planSelect).eq('estado', 'archivado').order('fecha_inicio', { ascending: false }).limit(30)
      setDatosVista(data || [])
    } else if (vista === 'aplazados') {
      const { data } = await supabase.from('contratos').select(planSelect).eq('estado', 'aplazado').order('fecha_inicio', { ascending: false })
      setDatosVista(data || [])
    } else if (vista === 'reactivacion') {
      // Planes completados (no archivados) cuyo cliente NO tiene plan activo actualmente
      const { data: completados } = await supabase.from('contratos').select(planSelect).eq('estado', 'completado').order('fecha_inicio', { ascending: false })
      if (!completados?.length) { setDatosVista([]); setCargandoVista(false); return }
      const clienteIds = [...new Set(completados.map((p: any) => p.cliente_id))]
      const { data: activos } = await supabase.from('contratos').select('cliente_id').eq('estado', 'activo').in('cliente_id', clienteIds)
      const clientesConActivo = new Set((activos || []).map((p: any) => p.cliente_id))
      setDatosVista(completados.filter((p: any) => !clientesConActivo.has(p.cliente_id)))
    }
    setCargandoVista(false)
  }

  async function buscarClientes() {
    setCargando(true)
    const { data } = await supabase.from('clientes').select('id, nombre, nombres, apellidos, telefono, email, grupo_whatsapp, estado, created_at, fecha_nacimiento, numero_identificacion, ocupacion, direccion, ciudad, contacto_emergencia_nombre, contacto_emergencia_telefono, menor_de_edad, acudiente_nombres, acudiente_apellidos, acudiente_telefono, acudiente_documento, discapacidad_fisica, condicion_aprendizaje').ilike('nombre', `%${busqueda}%`).order('nombre').limit(20)
    setClientes(data || [])
    setCargando(false)
  }

  async function cargarDatosCliente(c: any) {
    // Inscripciones a talleres
    const { data: talleresData } = await supabase
      .from('taller_inscripciones')
      .select('id, mes, valor_pagado, estado, taller_id, talleres(nombre, dia_semana, hora, duracion_min, salones(nombre, sedes(nombre)))')
      .eq('cliente_id', c.id)
      .order('mes', { ascending: false })
    setInscripcionesTalleres(talleresData || [])

    const { data: planesData } = await supabase
      .from('contratos')
      .select('id, total_clases, clases_tomadas, valor_plan, tipo_plan, estado, fecha_inicio, duracion_min, instrumento_id, profesor_id, sede_id, instrumentos(nombre), profesores(nombre), sedes(nombre)')
      .eq('cliente_id', c.id)
      .order('fecha_inicio', { ascending: false })
    setPlanes(planesData || [])

    const { data: ctList } = await supabase.from('contratos').select('id').eq('cliente_id', c.id)
    const ids = (ctList || []).map((ct: any) => ct.id)
    if (ids.length > 0) {
      const { data: clasesData } = await supabase
        .from('clases')
        .select('id, fecha, duracion_min, numero_en_plan, estado, profesores(nombre), salones(nombre), contratos(instrumentos(nombre))')
        .in('contrato_id', ids).order('fecha', { ascending: false }).limit(50)
      setClases(clasesData || [])
    } else {
      setClases([])
    }
  }

  async function seleccionarClientePorId(clienteId: string) {
    const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
    if (data) seleccionarCliente(data)
  }

  async function seleccionarCliente(c: any) {
    // Siempre traer datos completos por ID para garantizar que todos los campos estén
    const { data: completo } = await supabase.from('clientes').select('*').eq('id', c.id).single()
    const cliente = completo || c
    setClienteSeleccionado(cliente)
    setForm({
      nombre: cliente.nombre || '',
      telefono: cliente.telefono || '',
      email: cliente.email || '',
      grupo_whatsapp: cliente.grupo_whatsapp || '',
      estado: cliente.estado || 'activo',
      nombres: cliente.nombres || '',
      apellidos: cliente.apellidos || '',
      fecha_nacimiento: cliente.fecha_nacimiento || '',
      numero_identificacion: cliente.numero_identificacion || '',
      ocupacion: cliente.ocupacion || '',
      direccion: cliente.direccion || '',
      ciudad: cliente.ciudad || '',
      contacto_emergencia_nombre: cliente.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: cliente.contacto_emergencia_telefono || '',
      menor_de_edad: cliente.menor_de_edad || false,
      acudiente_nombres: cliente.acudiente_nombres || '',
      acudiente_apellidos: cliente.acudiente_apellidos || '',
      acudiente_telefono: cliente.acudiente_telefono || '',
      acudiente_documento: cliente.acudiente_documento || '',
      discapacidad_fisica: cliente.discapacidad_fisica || false,
      condicion_aprendizaje: cliente.condicion_aprendizaje || ''
    })
    await cargarDatosCliente(cliente)
    setConfirmarBorrar(false)
    setErrorBorrar('')
    setExpandirFicha(false)
    setModo('ver')
  }

  function nuevoCliente() {
    setClienteSeleccionado(null)
    setForm({
      nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo',
      nombres: '', apellidos: '',
      fecha_nacimiento: '', numero_identificacion: '', ocupacion: '',
      direccion: '', ciudad: '',
      contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
      menor_de_edad: false,
      acudiente_nombres: '', acudiente_apellidos: '',
      acudiente_telefono: '', acudiente_documento: '',
      discapacidad_fisica: false, condicion_aprendizaje: ''
    })
    setConfirmarBorrar(false)
    setErrorBorrar('')
    setModo('nuevo')
  }

  async function guardar() {
    if (!form.nombres.trim()) return alert('El nombre es obligatorio')
    setCargando(true)
    const payload = {
      ...form,
      nombre: `${form.nombres.trim()} ${form.apellidos.trim()}`.trim()
    }
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('clientes').insert(payload).select().single()
      if (!error && data) {
        setClienteSeleccionado(data)
        await cargarDatosCliente(data)
        setModo('ver')
        cargarVista(vistaActual)
      } else if (error) alert('Error al crear cliente: ' + error.message)
    } else {
      const { error } = await supabase.from('clientes').update(payload).eq('id', clienteSeleccionado.id)
      if (!error) { setClienteSeleccionado({ ...clienteSeleccionado, ...form }); setModo('ver') }
      else alert('Error al actualizar: ' + error.message)
    }
    setCargando(false)
  }

  async function intentarBorrarCliente() {
    setBorrando(true)
    setErrorBorrar('')
    const { data: ctList } = await supabase.from('contratos').select('id').eq('cliente_id', clienteSeleccionado.id)
    const ids = (ctList || []).map((ct: any) => ct.id)
    if (ids.length > 0) {
      const hoy = new Date().toISOString().split('T')[0]
      const { data: pendientes } = await supabase.from('clases').select('id').in('contrato_id', ids).in('estado', ['programada', 'confirmada']).gte('fecha', hoy)
      if (pendientes && pendientes.length > 0) {
        setErrorBorrar(`Este cliente tiene ${pendientes.length} clase(s) programada(s). Bórralas primero desde Horarios.`)
        setBorrando(false)
        return
      }
    }
    // Borrar en cascada: inscripciones taller → clases → contratos → cliente
    const clienteId = clienteSeleccionado.id

    // 1. Borrar asistencias de talleres
    if (ids.length > 0) {
      const { data: inscrip } = await supabase.from('taller_inscripciones').select('id').eq('cliente_id', clienteId)
      const inscripIds = (inscrip || []).map((i: any) => i.id)
      if (inscripIds.length > 0) {
        await supabase.from('taller_asistencias').delete().in('inscripcion_id', inscripIds)
      }
      await supabase.from('taller_inscripciones').delete().eq('cliente_id', clienteId)
      // 2. Borrar clases
      await supabase.from('clases').delete().in('contrato_id', ids)
      // 3. Borrar contratos
      await supabase.from('contratos').delete().eq('cliente_id', clienteId)
    }

    // 4. Borrar cliente
    const { error } = await supabase.from('clientes').delete().eq('id', clienteId)
    if (error) {
      setErrorBorrar('Error al borrar: ' + error.message)
      setBorrando(false)
      return
    }
    cargarVista(vistaActual)
    setModo('lista')
    setBusqueda('')
    setClientes([])
    setBorrando(false)
  }

  // ── FIX: actualización optimista de estado ──
  // Actualiza primero el estado local (sin reordenar) y luego sincroniza con Supabase
  async function cambiarEstadoPlan(planId: string, nuevoEstado: string) {
    // 1. Actualizar localmente de inmediato para evitar confusión visual
    setPlanes(prev => prev.map(p => p.id === planId ? { ...p, estado: nuevoEstado } : p))
    // 2. Guardar en Supabase
    const { error } = await supabase.from('contratos').update({ estado: nuevoEstado }).eq('id', planId)
    if (error) {
      alert('Error: ' + error.message)
      // Revertir si falló
      await cargarDatosCliente(clienteSeleccionado)
    }
    cargarVista(vistaActual)
  }

  async function cargarSesionesInscripcion(inscripcionId: string, tallerId: string) {
    if (sesionesPorInscripcion[inscripcionId]) {
      // Toggle: si ya está expandida, colapsar
      setInscripcionExpandida(prev => prev === inscripcionId ? null : inscripcionId)
      return
    }
    // Buscar sesiones dadas del taller con la asistencia de esta inscripción
    const { data: sesiones } = await supabase
      .from('taller_sesiones')
      .select('id, fecha, estado')
      .eq('taller_id', tallerId)
      .eq('estado', 'dada')
      .order('fecha', { ascending: false })

    if (!sesiones || sesiones.length === 0) {
      setSesionesPorInscripcion(prev => ({ ...prev, [inscripcionId]: [] }))
      setInscripcionExpandida(inscripcionId)
      return
    }

    // Para cada sesión, buscar si tiene asistencia registrada
    const sesionIds = sesiones.map((s: any) => s.id)
    const { data: asistencias } = await supabase
      .from('taller_asistencias')
      .select('id, sesion_id, asistio')
      .eq('inscripcion_id', inscripcionId)
      .in('sesion_id', sesionIds)

    const asistenciaMap: Record<string, any> = {}
    ;(asistencias || []).forEach((a: any) => { asistenciaMap[a.sesion_id] = a })

    const resultado = sesiones.map((s: any) => ({
      ...s,
      asistencia: asistenciaMap[s.id] || null
    }))

    setSesionesPorInscripcion(prev => ({ ...prev, [inscripcionId]: resultado }))
    setInscripcionExpandida(inscripcionId)
  }

  async function toggleAsistencia(inscripcionId: string, sesion: any, asistio: boolean) {
    if (sesion.asistencia) {
      // Actualizar
      await supabase.from('taller_asistencias').update({ asistio }).eq('id', sesion.asistencia.id)
    } else {
      // Crear
      await supabase.from('taller_asistencias').insert({ sesion_id: sesion.id, inscripcion_id: inscripcionId, asistio })
    }
    // Refrescar sesiones
    setSesionesPorInscripcion(prev => ({
      ...prev,
      [inscripcionId]: (prev[inscripcionId] || []).map((s: any) =>
        s.id === sesion.id
          ? { ...s, asistencia: { ...(s.asistencia || {}), asistio } }
          : s
      )
    }))
  }

  async function cambiarEstadoInscripcion(inscripcionId: string, nuevoEstado: string) {
    setInscripcionesTalleres(prev => prev.map(i => i.id === inscripcionId ? { ...i, estado: nuevoEstado } : i))
    const { error } = await supabase.from('taller_inscripciones').update({ estado: nuevoEstado }).eq('id', inscripcionId)
    if (error) {
      alert('Error: ' + error.message)
      await cargarDatosCliente(clienteSeleccionado)
    }
  }

  async function renovarInscripcionTaller(inscripcion: any) {
    const hoy = new Date()
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const { error } = await supabase.from('taller_inscripciones').insert({
      taller_id: inscripcion.taller_id,
      cliente_id: clienteSeleccionado.id,
      mes: mes,
      valor_pagado: inscripcion.valor_pagado,
      estado: 'activo'
    })
    if (error) { alert('Error al renovar: ' + error.message); return }
    // Archivar la inscripción anterior automáticamente
    await supabase.from('taller_inscripciones').update({ estado: 'archivado' }).eq('id', inscripcion.id)
    await cargarDatosCliente(clienteSeleccionado)
  }

  async function abrirModalTaller() {
    const { data } = await supabase
      .from('talleres')
      .select('id, nombre, dia_semana, hora, duracion_min, valor_mensual, profesores(nombre), salones(nombre, sedes(nombre))')
      .order('nombre')
    setTalleres(data || [])
    setTallerSeleccionado('')
    setTallerValorPagado('')
    setTallerError('')
    setModalTaller(true)
  }

  async function inscribirEnTaller() {
    if (!tallerSeleccionado) { setTallerError('Selecciona un taller'); return }
    setTallerGuardando(true)
    setTallerError('')
    // Verificar si ya está inscrito este mes
    const hoy = new Date()
    const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const { data: yaInscrito } = await supabase
      .from('taller_inscripciones')
      .select('id')
      .eq('taller_id', tallerSeleccionado)
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('estado', 'activo')
      .gte('mes', mes)
    if (yaInscrito && yaInscrito.length > 0) {
      setTallerError('Este cliente ya está inscrito en ese taller este mes.')
      setTallerGuardando(false)
      return
    }
    const taller = talleres.find((t: any) => t.id === tallerSeleccionado)
    const { error } = await supabase.from('taller_inscripciones').insert({
      taller_id: tallerSeleccionado,
      cliente_id: clienteSeleccionado.id,
      mes: mes,
      valor_pagado: tallerValorPagado !== '' ? Number(tallerValorPagado) : (taller?.valor_mensual || null),
      estado: 'activo'
    })
    if (error) { setTallerError('Error: ' + error.message); setTallerGuardando(false); return }
    setModalTaller(false)
    setTallerGuardando(false)
  }

  async function guardarPlan(payload: any, planId?: string) {
    const registro = { ...payload, cliente_id: clienteSeleccionado.id }
    if (planId) {
      // Edición de plan existente
      const { error } = await supabase.from('contratos').update(registro).eq('id', planId)
      if (error) { alert('Error al actualizar plan: ' + error.message); return }
    } else {
      // Plan nuevo (incluyendo renovación)
      const { error } = await supabase.from('contratos').insert(registro)
      if (error) { alert('Error al crear plan: ' + error.message); return }
      // Si es renovación, archivar el plan anterior
      if (esRenovacion && modalPlan?.id) {
        await supabase.from('contratos').update({ estado: 'archivado' }).eq('id', modalPlan.id)
      }
    }
    setModalPlan(null)
    setEsRenovacion(false)
    await cargarDatosCliente(clienteSeleccionado)
    cargarVista(vistaActual)
  }

  function formatFechaCorta(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  }

  const porcentaje = (p: any) => Math.min((p.clases_tomadas / p.total_clases) * 100, 100)
  const colorBarra = (p: any) => {
    if (p.estado === 'completado') return '#166534'
    if (p.estado === 'aplazado')   return '#92400e'
    const pct = porcentaje(p)
    if (pct >= 100) return '#ef4444'
    if (pct >= 75)  return '#f59e0b'
    return TEAL
  }

  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }

  // Planes visibles: todo excepto 'archivado'. Historial: solo 'archivado'
  const planesActivos = planes.filter(p => (p.estado || 'activo') !== 'archivado')
  const planesArchivados = planes.filter(p => p.estado === 'archivado')

  return (
    <div style={{ padding: '24px 32px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a' }}>Clientes</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Busca, crea y gestiona clientes</p>
        </div>
        <button onClick={nuevoCliente} style={{ padding: '11px 22px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* LISTA */}
      {modo === 'lista' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input placeholder="Buscar cliente por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus
                style={{ ...estiloInput, marginTop: 0, paddingLeft: '44px', fontSize: '15px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} />
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '18px' }}>🔍</span>
            </div>
            {busqueda.length < 2 && (
              <select value={vistaActual} onChange={e => setVistaActual(e.target.value)}
                style={{ padding: '10px 14px', border: `2px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', fontWeight: '500', color: '#333', background: 'white', cursor: 'pointer', minWidth: '300px' }}>
                {VISTAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            )}
          </div>

          {busqueda.length >= 2 && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cargando && <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>Buscando...</div>}
              {clientes.map((c: any) => (
                <div key={c.id} onClick={() => seleccionarCliente(c)} style={{ background: 'white', borderRadius: '12px', padding: '14px 20px', marginBottom: '8px', cursor: 'pointer', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = TEAL_MID)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#eef2f7')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: TEAL_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '600', color: TEAL }}>
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#1a1a1a' }}>{c.nombre}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{c.telefono || '—'} · {c.grupo_whatsapp || '—'}</p>
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: c.estado === 'activo' ? TEAL_LIGHT : '#fee2e2', color: c.estado === 'activo' ? TEAL : '#991b1b' }}>
                    {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              ))}
              {clientes.length === 0 && !cargando && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                  <p style={{ fontSize: '28px', margin: '0 0 8px' }}>🔍</p>
                  <p style={{ margin: 0 }}>No se encontraron clientes</p>
                </div>
              )}
            </div>
          )}

          {busqueda.length < 2 && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cargandoVista && <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>Cargando...</div>}

              {!cargandoVista && vistaActual === 'clientes' && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
                      <tr>{['Nombre', 'Teléfono', 'Correo electrónico', 'Grupo WhatsApp', 'Fecha ingreso'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {datosVista.length === 0 && <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Los clientes nuevos aparecerán aquí</td></tr>}
                      {datosVista.map((c: any, i) => (
                        <tr key={c.id} onClick={() => seleccionarCliente(c)}
                          style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}
                        >
                          <td style={{ ...tdStyle, fontWeight: '600', color: TEAL }}>{c.nombre}</td>
                          <td style={tdStyle}>{c.telefono || '—'}</td>
                          <td style={tdStyle}>{c.email || '—'}</td>
                          <td style={tdStyle}>{c.grupo_whatsapp || '—'}</td>
                          <td style={{ ...tdStyle, color: '#888' }}>{formatFechaCorta(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!cargandoVista && vistaActual !== 'clientes' && (
                <TablaPlanesVista planes={datosVista} onVerCliente={seleccionarClientePorId} />
              )}
            </div>
          )}
        </div>
      )}

      {modo === 'nuevo' && <FormCliente modo={modo} form={form} setForm={setForm} cargando={cargando} onGuardar={guardar} onVolver={() => setModo('lista')} />}
      {modo === 'editar' && <FormCliente modo={modo} form={form} setForm={setForm} cargando={cargando} onGuardar={guardar} onVolver={() => setModo('ver')} />}

      {/* VER CLIENTE */}
      {modo === 'ver' && clienteSeleccionado && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <button onClick={() => { setModo('lista'); setBusqueda(''); setClientes([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '20px', padding: 0, fontWeight: '500' }}>
            ← Volver a la lista
          </button>

          {/* Tarjeta cliente */}
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <div style={{ background: TEAL, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: 'white' }}>
                  {form.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '22px' }}>{form.nombre}</h3>
                  <span style={{ display: 'inline-block', marginTop: '6px', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', background: form.estado === 'activo' ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.4)', color: 'white', fontWeight: '500' }}>
                    {form.estado === 'activo' ? '● Activo' : '● Inactivo'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setModo('editar')} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Editar</button>
                <button onClick={() => { setConfirmarBorrar(true); setErrorBorrar('') }} style={{ padding: '8px 18px', background: 'rgba(220,38,38,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Borrar</button>
              </div>
            </div>
            {/* Datos básicos */}
            <div style={{ padding: '14px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[{ icon: '📱', label: 'Teléfono', valor: form.telefono }, { icon: '✉️', label: 'Correo', valor: form.email }, { icon: '💬', label: 'Grupo WhatsApp', valor: form.grupo_whatsapp }].map(d => (
                <div key={d.label}>
                  <p style={{ margin: '0 0 3px', fontSize: '12px', color: '#999', fontWeight: '600' }}>{d.icon} {d.label}</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{d.valor || '—'}</p>
                </div>
              ))}
            </div>
            {/* Botón expandir */}
            <div style={{ borderTop: '1px solid #eef2f7' }}>
              <button onClick={() => setExpandirFicha(prev => !prev)}
                style={{ width: '100%', padding: '7px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: TEAL, fontWeight: '500' }}>
                {expandirFicha ? '▲ Ocultar datos completos' : '▼ Ver datos completos'}
              </button>
            </div>
            {/* Datos expandibles */}
            {expandirFicha && (
              <div style={{ padding: '14px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#fafbfc', borderTop: '1px solid #eef2f7' }}>
                {[
                  { icon: '🎂', label: 'Fecha de nacimiento', valor: form.fecha_nacimiento },
                  { icon: '🪪', label: 'Identificación', valor: form.numero_identificacion },
                  { icon: '💼', label: 'Ocupación', valor: form.ocupacion },
                  { icon: '📍', label: 'Dirección', valor: form.direccion },
                  { icon: '🏙️', label: 'Ciudad', valor: form.ciudad },
                  { icon: '🚨', label: 'Contacto emergencia', valor: form.contacto_emergencia_nombre ? `${form.contacto_emergencia_nombre} · ${form.contacto_emergencia_telefono}` : null },
                ].map(d => (
                  <div key={d.label}>
                    <p style={{ margin: '0 0 3px', fontSize: '12px', color: '#999', fontWeight: '600' }}>{d.icon} {d.label}</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{d.valor || '—'}</p>
                  </div>
                ))}
                {form.menor_de_edad && (
                  <div style={{ gridColumn: '1 / -1', background: TEAL_LIGHT, borderRadius: '8px', padding: '10px 14px' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '12px', color: TEAL, fontWeight: '600' }}>👨‍👩‍👦 Acudiente</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                      {form.acudiente_nombres} {form.acudiente_apellidos} · {form.acudiente_telefono}
                      {form.acudiente_documento ? ` · Doc: ${form.acudiente_documento}` : ''}
                    </p>
                  </div>
                )}
                {(form.discapacidad_fisica || form.condicion_aprendizaje) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    {form.discapacidad_fisica && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#dc2626' }}>⚠️ Presenta discapacidad física</p>}
                    {form.condicion_aprendizaje && <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>📚 {form.condicion_aprendizaje}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Confirmar borrar */}
          {confirmarBorrar && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '16px', color: '#991b1b', fontWeight: '700' }}>¿Borrar a {form.nombre}?</p>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666' }}>Esta acción no se puede deshacer.</p>
              {errorBorrar && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#dc2626', fontWeight: '500', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px' }}>⚠️ {errorBorrar}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={intentarBorrarCliente} disabled={borrando} style={{ padding: '9px 22px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                  {borrando ? 'Verificando...' : 'Sí, borrar cliente'}
                </button>
                <button onClick={() => { setConfirmarBorrar(false); setErrorBorrar('') }} style={{ padding: '9px 22px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Cabecera planes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>
                Planes activos <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({planesActivos.length})</span>
              </h3>
              {planesArchivados.length > 0 && (
                <button onClick={() => setModalHistorial(true)} style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                  📋 Ver historial ({planesArchivados.length} archivados)
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEsRenovacion(false); setModalPlan({}) }} style={{ padding: '8px 18px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Crear plan</button>
              <button onClick={abrirModalTaller} style={{ padding: '8px 18px', background: 'white', color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Asignar a taller</button>
            </div>
          </div>

          {planesActivos.length === 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#888', marginBottom: '24px' }}>
              Sin planes activos o aplazados
            </div>
          )}

          {planesActivos.map((p: any) => {
            const est = colorEstadoPlan(p.estado || 'activo')
            return (
              <div key={p.id} style={{ background: 'white', borderRadius: '18px', padding: '20px 24px', border: `1px solid ${est.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>{p.instrumentos?.nombre || '—'}</p>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', background: est.bg, color: est.color, fontWeight: '600' }}>{p.estado || 'activo'}</span>
                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>👤 {p.profesores?.nombre || '—'} · 🏫 {p.sedes?.nombre || '—'}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>📅 {p.fecha_inicio || '—'} · {p.duracion_min} min/clase</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: colorBarra(p) }}>
                      {p.clases_tomadas}<span style={{ fontSize: '14px', color: '#aaa', fontWeight: '400' }}>/{p.total_clases}</span>
                    </p>
                    <button onClick={() => { setEsRenovacion(false); setModalPlan(p) }} style={{ padding: '5px 14px', background: TEAL_LIGHT, color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Editar</button>
                  </div>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ height: '8px', borderRadius: '6px', width: `${porcentaje(p)}%`, background: colorBarra(p), transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>{p.total_clases - p.clases_tomadas} clases restantes</span>
                  <span style={{ fontSize: '14px', color: '#555', fontWeight: '500' }}>${p.valor_plan?.toLocaleString() || '—'}</span>
                </div>
                {/* Botones de estado */}
                <div style={{ paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>Estado:</span>
                  {['activo', 'aplazado', 'completado'].map(est2 => {
                    const c2 = colorEstadoPlan(est2)
                    const esActual = (p.estado || 'activo') === est2
                    return (
                      <button key={est2} onClick={() => !esActual && cambiarEstadoPlan(p.id, est2)} disabled={esActual}
                        style={{ padding: '5px 14px', borderRadius: '8px', cursor: esActual ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', border: `1px solid ${esActual ? c2.border : '#e2e8f0'}`, background: esActual ? c2.bg : 'white', color: esActual ? c2.color : '#666' }}>
                        {est2.charAt(0).toUpperCase() + est2.slice(1)}
                      </button>
                    )
                  })}
                  {/* Botones de acción para plan completado */}
                  {p.estado === 'completado' && (
                    <>
                      <button onClick={() => { setEsRenovacion(true); setModalPlan(p) }}
                        style={{ marginLeft: '8px', padding: '5px 16px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        🔄 Renovar plan
                      </button>
                      <button onClick={() => cambiarEstadoPlan(p.id, 'archivado')}
                        style={{ padding: '5px 16px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                        📁 Archivar
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {/* Histórico de clases */}
          {/* ── Talleres inscritos ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '32px 0 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>
                Talleres activos <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({inscripcionesTalleres.filter((i: any) => i.estado !== 'archivado').length})</span>
              </h3>
              {inscripcionesTalleres.filter((i: any) => i.estado === 'archivado').length > 0 && (
                <button onClick={() => setModalHistorialTalleres(true)} style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                  📁 Ver historial ({inscripcionesTalleres.filter((i: any) => i.estado === 'archivado').length} archivados)
                </button>
              )}
            </div>
          </div>

          {inscripcionesTalleres.length === 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#888', marginBottom: '24px' }}>
              Sin inscripciones a talleres
            </div>
          )}

          {/* Inscripciones activas y completadas (no archivadas) */}
          {inscripcionesTalleres.filter((i: any) => i.estado !== 'archivado').map((ins: any) => {
            const esActivo = ins.estado === 'activo'
            const esCompletado = ins.estado === 'completado'
            const fechaMes = ins.mes ? new Date(ins.mes + 'T12:00:00') : null
            const mesLabel = fechaMes ? `${fechaMes.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][fechaMes.getMonth()]} ${fechaMes.getFullYear()}` : '—'
            const colorEstado = esActivo
              ? { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' }
              : esCompletado
              ? { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
              : { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
            return (
              <div key={ins.id} style={{
                background: 'white', borderRadius: '14px', padding: '16px 20px',
                border: `1px solid ${colorEstado.border}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>
                        🎸 {ins.talleres?.nombre || '—'}
                      </p>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: colorEstado.bg, color: colorEstado.color }}>
                        {ins.estado}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>
                      🏫 {ins.talleres?.salones?.nombre} — {ins.talleres?.salones?.sedes?.nombre}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                      📅 Desde: {mesLabel} · {ins.talleres?.dia_semana} {ins.talleres?.hora?.substring(0,5)} · {ins.talleres?.duracion_min} min
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#7c3aed' }}>
                      ${ins.valor_pagado ? Number(ins.valor_pagado).toLocaleString() : '—'}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#aaa' }}>valor pagado</p>
                  </div>
                </div>

                {/* Botones de estado */}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>Estado:</span>
                  {['activo', 'completado'].map(est => {
                    const esActual = ins.estado === est
                    const c2 = est === 'activo'
                      ? { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' }
                      : { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
                    return (
                      <button key={est} onClick={() => !esActual && cambiarEstadoInscripcion(ins.id, est)}
                        disabled={esActual}
                        style={{
                          padding: '5px 14px', borderRadius: '8px', cursor: esActual ? 'default' : 'pointer',
                          fontSize: '12px', fontWeight: '600',
                          border: `1px solid ${esActual ? c2.border : '#e2e8f0'}`,
                          background: esActual ? c2.bg : 'white',
                          color: esActual ? c2.color : '#666'
                        }}>
                        {est.charAt(0).toUpperCase() + est.slice(1)}
                      </button>
                    )
                  })}
                  <button onClick={() => cargarSesionesInscripcion(ins.id, ins.taller_id)}
                    style={{ padding: '5px 14px', background: inscripcionExpandida === ins.id ? '#f3e8ff' : 'white', color: '#7c3aed', border: '1px solid #d8b4fe', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                    {inscripcionExpandida === ins.id ? '▲ Ocultar sesiones' : '▼ Ver sesiones'}
                  </button>
                  {esCompletado && (
                    <>
                      <button onClick={() => renovarInscripcionTaller(ins)}
                        style={{ marginLeft: 'auto', padding: '5px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                        🔄 Renovar
                      </button>
                      <button onClick={() => cambiarEstadoInscripcion(ins.id, 'archivado')}
                        style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                        📁 Archivar
                      </button>
                    </>
                  )}
                </div>

                {/* Panel de sesiones */}
                {inscripcionExpandida === ins.id && (
                  <div style={{ marginTop: '12px', background: '#fafbfc', borderRadius: '10px', padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: '#555' }}>
                      Sesiones registradas
                    </p>
                    {!sesionesPorInscripcion[ins.id] || sesionesPorInscripcion[ins.id].length === 0 ? (
                      <p style={{ margin: 0, fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>
                        Sin sesiones dadas aún
                      </p>
                    ) : (
                      sesionesPorInscripcion[ins.id].map((sesion: any) => {
                        const asistio = sesion.asistencia?.asistio !== false
                        return (
                          <div key={sesion.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', background: 'white', marginBottom: '6px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '13px', color: '#555', fontWeight: '500' }}>{sesion.fecha}</span>
                              <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: asistio ? '#dcfce7' : '#fee2e2', color: asistio ? '#166534' : '#991b1b' }}>
                                {asistio ? '✓ Asistió' : '✗ No asistió'}
                              </span>
                            </div>
                            <button onClick={() => toggleAsistencia(ins.id, sesion, !asistio)}
                              style={{ padding: '4px 12px', background: 'white', color: '#555', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                              {asistio ? 'Marcar no asistió' : 'Marcar asistió'}
                            </button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}



          <h3 style={{ margin: '32px 0 14px', fontSize: '18px', color: '#1a1a1a' }}>
            Histórico de clases <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({clases.length})</span>
          </h3>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: TEAL_LIGHT }}>
                  {['#', 'Fecha', 'Profesor', 'Instrumento', 'Duración', 'Estado'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: TEAL, fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clases.length === 0 && <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Sin clases registradas</td></tr>}
                {clases.map((c: any, i) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: TEAL, fontWeight: '600' }}>{c.numero_en_plan || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.fecha}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.profesores?.nombre || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.contratos?.instrumentos?.nombre || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.duracion_min} min</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', background: c.estado === 'dada' ? '#fefce8' : c.estado === 'cancelada' ? '#fee2e2' : TEAL_LIGHT, color: c.estado === 'dada' ? '#854d0e' : c.estado === 'cancelada' ? '#991b1b' : TEAL }}>
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL PLAN */}
      {/* MODAL HISTORIAL TALLERES ARCHIVADOS */}
      {modalHistorialTalleres && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '95%', maxWidth: '700px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ background: '#7c3aed', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>📁 Historial de talleres archivados</h3>
              <button onClick={() => setModalHistorialTalleres(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3e8ff', zIndex: 1 }}>
                  <tr>
                    {['Taller', 'Sede / Salón', 'Día / Hora', 'Desde', 'Valor pagado'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inscripcionesTalleres.filter((i: any) => i.estado === 'archivado').map((ins: any, idx) => {
                    const fechaMes = ins.mes ? new Date(ins.mes + 'T12:00:00') : null
                    const mesLabel = fechaMes ? `${fechaMes.getDate()}/${fechaMes.getMonth()+1}/${fechaMes.getFullYear()}` : '—'
                    return (
                      <tr key={ins.id} style={{ borderTop: '1px solid #f8fafc', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td style={{ padding: '11px 16px', fontSize: '14px', fontWeight: '500', color: '#333' }}>🎸 {ins.talleres?.nombre || '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555' }}>{ins.talleres?.salones?.nombre} — {ins.talleres?.salones?.sedes?.nombre}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555' }}>{ins.talleres?.dia_semana} {ins.talleres?.hora?.substring(0,5)}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#888' }}>{mesLabel}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555', fontWeight: '500' }}>${ins.valor_pagado ? Number(ins.valor_pagado).toLocaleString() : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR A TALLER */}
      {modalTaller && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#7c3aed', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>🎸 Asignar a taller</h3>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{clienteSeleccionado?.nombre}</p>
              </div>
              <button onClick={() => setModalTaller(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Taller *</label>
                <select value={tallerSeleccionado} onChange={e => {
                  setTallerSeleccionado(e.target.value)
                  const t = talleres.find((x: any) => x.id === e.target.value)
                  if (t?.valor_mensual) setTallerValorPagado(String(t.valor_mensual))
                  else setTallerValorPagado('')
                }} style={estiloInput}>
                  <option value="">— Seleccionar taller —</option>
                  {talleres.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} · {t.salones?.nombre} ({t.salones?.sedes?.nombre}) · {t.dia_semana} {t.hora?.substring(0,5)}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Valor pagado ($)</label>
                <input type="number" min={0} value={tallerValorPagado}
                  onChange={e => setTallerValorPagado(e.target.value)}
                  placeholder="Se toma del taller si se deja vacío"
                  style={estiloInput} />
              </div>
              {tallerError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{tallerError}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={inscribirEnTaller} disabled={tallerGuardando} style={{ flex: 1, padding: '11px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                  {tallerGuardando ? 'Inscribiendo...' : 'Inscribir al mes actual'}
                </button>
                <button onClick={() => setModalTaller(false)} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalPlan !== null && (
        <ModalPlan plan={modalPlan} profesores={profesores} instrumentos={instrumentos} sedes={sedes}
          esRenovacion={esRenovacion} onGuardar={guardarPlan} onCerrar={() => { setModalPlan(null); setEsRenovacion(false) }} />
      )}

      {/* MODAL HISTORIAL PLANES */}
      {modalHistorial && (
        <ModalHistorialPlanes planes={planesArchivados} onCerrar={() => setModalHistorial(false)} />
      )}
    </div>
  )
}
