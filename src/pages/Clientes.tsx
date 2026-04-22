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

const labelStyle = {
  fontWeight: '500' as const, fontSize: '13px', color: '#555'
}

// ── Formulario cliente (fuera del componente principal para evitar bug de input) ──
function FormCliente({ modo, form, setForm, cargando, onGuardar, onVolver }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ background: TEAL, padding: '20px 28px' }}>
        <button onClick={onVolver} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.8)', fontSize: '14px', padding: 0, marginBottom: '8px'
        }}>← Volver</button>
        <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>
          {modo === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}
        </h3>
      </div>
      <div style={{ padding: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {[
            { label: 'Nombre completo *', key: 'nombre', type: 'text' },
            { label: 'Teléfono', key: 'telefono', type: 'text' },
            { label: 'Correo electrónico', key: 'email', type: 'email' },
            { label: 'Grupo WhatsApp', key: 'grupo_whatsapp', type: 'text' },
          ].map(f => (
            <div key={f.key}>
              <label style={labelStyle}>{f.label}</label>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={estiloInput}
              />
            </div>
          ))}
          <div>
            <label style={labelStyle}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={estiloInput}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
          <button onClick={onGuardar} disabled={cargando} style={{
            padding: '11px 28px', background: TEAL, color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500'
          }}>
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onVolver} style={{
            padding: '11px 28px', background: '#f1f5f9', color: '#334155',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
          }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

// ── Modal plan ──
function ModalPlan({ plan, profesores, instrumentos, onGuardar, onCerrar }) {
  const esNuevo = !plan?.id
  const [formPlan, setFormPlan] = useState({
    instrumento_id: plan?.instrumento_id || '',
    profesor_id: plan?.profesor_id || '',
    total_clases: plan?.total_clases || 4,
    clases_tomadas: plan?.clases_tomadas || 0,
    valor_plan: plan?.valor_plan || '',
    tipo_plan: plan?.tipo_plan || 'paquete',
    duracion_min: plan?.duracion_min || 60,
    fecha_inicio: plan?.fecha_inicio || new Date().toISOString().split('T')[0],
    estado: plan?.estado || 'activo',
  })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!formPlan.instrumento_id) { setError('Selecciona un instrumento'); return }
    if (!formPlan.profesor_id) { setError('Selecciona un profesor'); return }
    if (!formPlan.total_clases) { setError('Ingresa el número de clases'); return }
    setGuardando(true)
    setError('')
    await onGuardar(formPlan, plan?.id)
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>
            {esNuevo ? 'Nuevo plan' : 'Editar plan'}
          </h3>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instrumento *</label>
              <select value={formPlan.instrumento_id} onChange={e => setFormPlan({ ...formPlan, instrumento_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {instrumentos.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Profesor *</label>
              <select value={formPlan.profesor_id} onChange={e => setFormPlan({ ...formPlan, profesor_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Número de clases *</label>
              <input type="number" min={1} value={formPlan.total_clases}
                onChange={e => setFormPlan({ ...formPlan, total_clases: parseInt(e.target.value) || 0 })}
                style={estiloInput} />
            </div>

            <div>
              <label style={labelStyle}>Clases tomadas</label>
              <input type="number" min={0} value={formPlan.clases_tomadas}
                onChange={e => setFormPlan({ ...formPlan, clases_tomadas: parseInt(e.target.value) || 0 })}
                style={estiloInput} />
            </div>

            <div>
              <label style={labelStyle}>Duración por clase (min)</label>
              <select value={formPlan.duracion_min} onChange={e => setFormPlan({ ...formPlan, duracion_min: parseInt(e.target.value) })} style={estiloInput}>
                {[30, 45, 60, 90].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Tipo de plan</label>
              <select value={formPlan.tipo_plan} onChange={e => setFormPlan({ ...formPlan, tipo_plan: e.target.value })} style={estiloInput}>
                <option value="paquete">Paquete</option>
                <option value="mensual">Mensual</option>
                <option value="semestral">Semestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Valor del plan ($)</label>
              <input type="number" min={0} value={formPlan.valor_plan}
                onChange={e => setFormPlan({ ...formPlan, valor_plan: parseInt(e.target.value) || 0 })}
                style={estiloInput} />
            </div>

            <div>
              <label style={labelStyle}>Fecha de inicio</label>
              <input type="date" value={formPlan.fecha_inicio}
                onChange={e => setFormPlan({ ...formPlan, fecha_inicio: e.target.value })}
                style={estiloInput} />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Estado del plan</label>
              <select value={formPlan.estado} onChange={e => setFormPlan({ ...formPlan, estado: e.target.value })} style={estiloInput}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="completado">Completado</option>
              </select>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={guardar} disabled={guardando} style={{
              flex: 1, padding: '11px', background: TEAL, color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500'
            }}>
              {guardando ? 'Guardando...' : esNuevo ? 'Crear plan' : 'Guardar cambios'}
            </button>
            <button onClick={onCerrar} style={{
              padding: '11px 18px', background: '#f1f5f9', color: '#334155',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
            }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function Clientes() {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [planes, setPlanes] = useState([])
  const [clases, setClases] = useState([])
  const [modo, setModo] = useState('lista')
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo' })
  const [profesores, setProfesores] = useState([])
  const [instrumentos, setInstrumentos] = useState([])
  const [modalPlan, setModalPlan] = useState<any>(null) // null = cerrado, {} = nuevo, {id,...} = editar

  useEffect(() => {
    cargarProfesoresInstrumentos()
  }, [])

  useEffect(() => {
    if (busqueda.length >= 2) buscarClientes()
    else setClientes([])
  }, [busqueda])

  async function cargarProfesoresInstrumentos() {
    const [{ data: p }, { data: i }] = await Promise.all([
      supabase.from('profesores').select('id, nombre').order('nombre'),
      supabase.from('instrumentos').select('id, nombre').order('nombre'),
    ])
    setProfesores(p || [])
    setInstrumentos(i || [])
  }

  async function buscarClientes() {
    setCargando(true)
    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, telefono, email, grupo_whatsapp, estado')
      .ilike('nombre', `%${busqueda}%`)
      .order('nombre')
      .limit(20)
    setClientes(data || [])
    setCargando(false)
  }

  async function cargarDatosCliente(c) {
    const { data: planesData } = await supabase
      .from('contratos')
      .select(`
        id, total_clases, clases_tomadas, valor_plan, tipo_plan, estado,
        fecha_inicio, duracion_min, instrumento_id, profesor_id,
        profesores (nombre),
        instrumentos (nombre)
      `)
      .eq('cliente_id', c.id)
      .order('fecha_inicio', { ascending: false })
    setPlanes(planesData || [])

    const { data: contratosCliente } = await supabase.from('contratos').select('id').eq('cliente_id', c.id)
    const ids = (contratosCliente || []).map(ct => ct.id)
    if (ids.length > 0) {
      const { data: clasesData } = await supabase
        .from('clases')
        .select(`id, fecha, duracion_min, numero_en_plan, modalidad, estado, contrato_id,
          profesores (nombre), salones (nombre), contratos (instrumentos (nombre))`)
        .in('contrato_id', ids)
        .order('fecha', { ascending: false })
        .limit(50)
      setClases(clasesData || [])
    } else {
      setClases([])
    }
  }

  async function seleccionarCliente(c) {
    setClienteSeleccionado(c)
    setForm({ nombre: c.nombre || '', telefono: c.telefono || '', email: c.email || '', grupo_whatsapp: c.grupo_whatsapp || '', estado: c.estado || 'activo' })
    await cargarDatosCliente(c)
    setModo('ver')
  }

  function nuevoCliente() {
    setClienteSeleccionado(null)
    setForm({ nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo' })
    setModo('nuevo')
  }

  async function guardar() {
    if (!form.nombre) return alert('El nombre es obligatorio')
    setCargando(true)
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('clientes').insert(form).select().single()
      if (!error && data) {
        setClienteSeleccionado(data)
        await cargarDatosCliente(data)
        setModo('ver')
      }
    } else {
      await supabase.from('clientes').update(form).eq('id', clienteSeleccionado.id)
      setClienteSeleccionado({ ...clienteSeleccionado, ...form })
      setModo('ver')
    }
    setCargando(false)
  }

  async function guardarPlan(formPlan, planId) {
    const payload = {
      ...formPlan,
      cliente_id: clienteSeleccionado.id,
    }
    if (planId) {
      await supabase.from('contratos').update(payload).eq('id', planId)
    } else {
      await supabase.from('contratos').insert(payload)
    }
    setModalPlan(null)
    await cargarDatosCliente(clienteSeleccionado)
  }

  const porcentaje = (p) => Math.min((p.clases_tomadas / p.total_clases) * 100, 100)
  const colorBarra = (p) => {
    const pct = porcentaje(p)
    if (pct >= 100) return '#ef4444'
    if (pct >= 75) return '#f59e0b'
    return TEAL
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>

      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a' }}>Clientes</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Busca, crea y gestiona clientes</p>
        </div>
        <button onClick={nuevoCliente} style={{
          padding: '11px 22px', background: TEAL, color: 'white',
          border: 'none', borderRadius: '10px', cursor: 'pointer',
          fontSize: '15px', fontWeight: '500'
        }}>+ Nuevo cliente</button>
      </div>

      {/* LISTA */}
      {modo === 'lista' && (
        <>
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <input
              placeholder="Buscar cliente por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoFocus
              style={{ ...estiloInput, marginTop: 0, paddingLeft: '44px', fontSize: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
            />
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '18px' }}>🔍</span>
          </div>

          {cargando && <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>Buscando...</div>}

          {clientes.map(c => (
            <div key={c.id} onClick={() => seleccionarCliente(c)} style={{
              background: 'white', borderRadius: '12px', padding: '16px 20px',
              marginBottom: '8px', cursor: 'pointer', border: '1px solid #eef2f7',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = TEAL_MID)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#eef2f7')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: TEAL_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: TEAL }}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#1a1a1a' }}>{c.nombre}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#888' }}>💬 {c.grupo_whatsapp || '—'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: c.estado === 'activo' ? '#e8f5f5' : '#fee2e2', color: c.estado === 'activo' ? TEAL : '#991b1b' }}>
                  {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
                <span style={{ color: '#ccc', fontSize: '18px' }}>›</span>
              </div>
            </div>
          ))}

          {busqueda.length >= 2 && clientes.length === 0 && !cargando && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#888' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🔍</p>
              <p style={{ margin: 0 }}>No se encontraron clientes con ese nombre</p>
            </div>
          )}
          {busqueda.length < 2 && (
            <div style={{ textAlign: 'center', padding: '48px', color: '#aaa' }}>
              <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🎵</p>
              <p style={{ margin: 0, fontSize: '15px' }}>Escribe al menos 2 letras para buscar</p>
            </div>
          )}
        </>
      )}

      {/* NUEVO CLIENTE */}
      {modo === 'nuevo' && (
        <FormCliente
          modo={modo} form={form} setForm={setForm} cargando={cargando}
          onGuardar={guardar} onVolver={() => setModo('lista')}
        />
      )}

      {/* EDITAR CLIENTE */}
      {modo === 'editar' && (
        <FormCliente
          modo={modo} form={form} setForm={setForm} cargando={cargando}
          onGuardar={guardar} onVolver={() => setModo('ver')}
        />
      )}

      {/* VER CLIENTE */}
      {modo === 'ver' && clienteSeleccionado && (
        <div>
          <button onClick={() => { setModo('lista'); setBusqueda(''); setClientes([]) }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: TEAL, fontSize: '14px', marginBottom: '20px', padding: 0, fontWeight: '500'
          }}>← Volver a la lista</button>

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
              <button onClick={() => setModo('editar')} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                Editar
              </button>
            </div>
            <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {[
                { icon: '📱', label: 'Teléfono', valor: form.telefono },
                { icon: '✉️', label: 'Correo', valor: form.email },
                { icon: '💬', label: 'Grupo WhatsApp', valor: form.grupo_whatsapp },
              ].map(d => (
                <div key={d.label}>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#999', fontWeight: '600' }}>{d.icon} {d.label}</p>
                  <p style={{ margin: 0, fontSize: '15px', color: '#333' }}>{d.valor || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Planes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>
              Planes <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({planes.length})</span>
            </h3>
            <button onClick={() => setModalPlan({})} style={{
              padding: '8px 18px', background: TEAL, color: 'white',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500'
            }}>+ Nuevo plan</button>
          </div>

          {planes.length === 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#888', marginBottom: '24px' }}>
              Sin planes registrados
            </div>
          )}

          {planes.map(p => (
            <div key={p.id} style={{ background: 'white', borderRadius: '18px', padding: '20px 24px', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>
                    {p.instrumentos?.nombre || '—'}
                    <span style={{ marginLeft: '8px', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', background: p.estado === 'activo' ? TEAL_LIGHT : '#f1f5f9', color: p.estado === 'activo' ? TEAL : '#999', fontWeight: '500' }}>
                      {p.estado}
                    </span>
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>👤 {p.profesores?.nombre || '—'}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>📅 {p.fecha_inicio || '—'} · {p.tipo_plan} · {p.duracion_min || '—'} min/clase</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: colorBarra(p) }}>
                    {p.clases_tomadas}<span style={{ fontSize: '14px', color: '#aaa', fontWeight: '400' }}>/{p.total_clases}</span>
                  </p>
                  <button onClick={() => setModalPlan(p)} style={{
                    padding: '5px 14px', background: TEAL_LIGHT, color: TEAL,
                    border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500'
                  }}>Editar plan</button>
                </div>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{ height: '8px', borderRadius: '6px', width: `${porcentaje(p)}%`, background: colorBarra(p), transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>{p.total_clases - p.clases_tomadas} clases restantes</span>
                <span style={{ fontSize: '14px', color: '#555', fontWeight: '500' }}>${p.valor_plan?.toLocaleString() || '—'}</span>
              </div>
            </div>
          ))}

          {/* Histórico clases */}
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
                {clases.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#888' }}>Sin clases registradas</td></tr>
                )}
                {clases.map((c, i) => (
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
      {modalPlan !== null && (
        <ModalPlan
          plan={modalPlan}
          profesores={profesores}
          instrumentos={instrumentos}
          onGuardar={guardarPlan}
          onCerrar={() => setModalPlan(null)}
        />
      )}
    </div>
  )
}
