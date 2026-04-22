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

// ── Formulario cliente ──
function FormCliente({ modo, form, setForm, cargando, onGuardar, onVolver }) {
  return (
    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ background: TEAL, padding: '20px 28px' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: '14px', padding: 0, marginBottom: '8px' }}>
          ← Volver
        </button>
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
          <button onClick={onGuardar} disabled={cargando} style={{ padding: '11px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onVolver} style={{ padding: '11px 28px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal plan ──
function ModalPlan({ plan, profesores, instrumentos, sedes, onGuardar, onCerrar }) {
  const esNuevo = !plan?.id
  const [fp, setFp] = useState({
    instrumento_id: plan?.instrumento_id || '',
    profesor_id:    plan?.profesor_id    || '',
    sede_id:        plan?.sede_id        || '',
    total_clases:   plan?.total_clases   || 4,
    clases_tomadas: plan?.clases_tomadas || 0,
    valor_plan:     plan?.valor_plan     || '',
    duracion_min:   plan?.duracion_min   || 60,
    fecha_inicio:   plan?.fecha_inicio   || new Date().toISOString().split('T')[0],
    estado:         plan?.estado         || 'activo',
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
    }, plan?.id)
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>{esNuevo ? 'Crear plan' : 'Editar plan'}</h3>
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
                    style={{
                      padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                      border: `2px solid ${!clasesManual && fp.total_clases === n ? TEAL : TEAL_MID}`,
                      background: !clasesManual && fp.total_clases === n ? TEAL : 'white',
                      color: !clasesManual && fp.total_clases === n ? 'white' : '#333',
                    }}>{n}</button>
                ))}
                <button type="button"
                  onClick={() => setClasesManual(true)}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
                    border: `2px solid ${clasesManual ? TEAL : TEAL_MID}`,
                    background: clasesManual ? TEAL : 'white',
                    color: clasesManual ? 'white' : '#666',
                  }}>Otro</button>
              </div>
              {clasesManual && (
                <input type="number" min={1} placeholder="Ingresa el número"
                  value={fp.total_clases}
                  onChange={e => setFp({ ...fp, total_clases: e.target.value })}
                  style={{ ...estiloInput, marginTop: '10px' }}
                  autoFocus
                />
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
              <input type="number" min={0} value={fp.valor_plan}
                onChange={e => setFp({ ...fp, valor_plan: e.target.value })}
                style={estiloInput} />
            </div>

            <div>
              <label style={labelStyle}>Fecha de inicio</label>
              <input type="date" value={fp.fecha_inicio}
                onChange={e => setFp({ ...fp, fecha_inicio: e.target.value })}
                style={estiloInput} />
            </div>

            <div>
              <label style={labelStyle}>Estado</label>
              <select value={fp.estado} onChange={e => setFp({ ...fp, estado: e.target.value })} style={estiloInput}>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="completado">Completado</option>
              </select>
            </div>

            {!esNuevo && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Clases tomadas</label>
                <input type="number" min={0} value={fp.clases_tomadas}
                  onChange={e => setFp({ ...fp, clases_tomadas: e.target.value })}
                  style={estiloInput} />
              </div>
            )}

          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={guardar} disabled={guardando} style={{ flex: 1, padding: '11px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
              {guardando ? 'Guardando...' : esNuevo ? 'Crear plan' : 'Guardar cambios'}
            </button>
            <button onClick={onCerrar} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──
export default function Clientes() {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [ultimosClientes, setUltimosClientes] = useState<any[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [planes, setPlanes] = useState<any[]>([])
  const [clases, setClases] = useState<any[]>([])
  const [modo, setModo] = useState('lista')
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo' })
  const [profesores, setProfesores] = useState<any[]>([])
  const [instrumentos, setInstrumentos] = useState<any[]>([])
  const [sedes, setSedes] = useState<any[]>([])
  const [modalPlan, setModalPlan] = useState<any>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')
  const [borrando, setBorrando] = useState(false)

  useEffect(() => { cargarDatosBase() }, [])

  useEffect(() => {
    if (busqueda.length >= 2) buscarClientes()
    else setClientes([])
  }, [busqueda])

  async function cargarDatosBase() {
    const [{ data: ins }, { data: sed }, { data: pro }, { data: ult }] = await Promise.all([
      supabase.from('instrumentos').select('id, nombre').order('nombre'),
      supabase.from('sedes').select('id, nombre').order('nombre'),
      supabase.from('profesores').select('id, nombre').order('nombre'),
      supabase
        .from('clientes')
        .select('id, nombre, estado, created_at, contratos(id, fecha_inicio, tipo_plan, sedes(nombre))')
        .not('created_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setInstrumentos(ins || [])
    setSedes(sed || [])
    setProfesores(pro || [])
    setUltimosClientes(ult || [])
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

  async function cargarDatosCliente(c: any) {
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
        .in('contrato_id', ids)
        .order('fecha', { ascending: false })
        .limit(50)
      setClases(clasesData || [])
    } else {
      setClases([])
    }
  }

  async function seleccionarCliente(c: any) {
    setClienteSeleccionado(c)
    setForm({ nombre: c.nombre || '', telefono: c.telefono || '', email: c.email || '', grupo_whatsapp: c.grupo_whatsapp || '', estado: c.estado || 'activo' })
    await cargarDatosCliente(c)
    setConfirmarBorrar(false)
    setErrorBorrar('')
    setModo('ver')
  }

  function nuevoCliente() {
    setClienteSeleccionado(null)
    setForm({ nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo' })
    setConfirmarBorrar(false)
    setErrorBorrar('')
    setModo('nuevo')
  }

  async function guardar() {
    if (!form.nombre) return alert('El nombre es obligatorio')
    setCargando(true)
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('clientes').insert(form).select().single()
      if (!error && data) {
        await cargarDatosBase()
        setClienteSeleccionado(data)
        await cargarDatosCliente(data)
        setModo('ver')
      } else if (error) {
        alert('Error al crear cliente: ' + error.message)
      }
    } else {
      const { error } = await supabase.from('clientes').update(form).eq('id', clienteSeleccionado.id)
      if (!error) {
        setClienteSeleccionado({ ...clienteSeleccionado, ...form })
        setModo('ver')
      } else {
        alert('Error al actualizar: ' + error.message)
      }
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
      const { data: pendientes } = await supabase
        .from('clases').select('id')
        .in('contrato_id', ids)
        .in('estado', ['programada', 'confirmada'])
        .gte('fecha', hoy)
      if (pendientes && pendientes.length > 0) {
        setErrorBorrar(`Este cliente tiene ${pendientes.length} clase(s) programada(s). Bórralas primero desde Horarios.`)
        setBorrando(false)
        return
      }
    }
    await supabase.from('clientes').delete().eq('id', clienteSeleccionado.id)
    await cargarDatosBase()
    setModo('lista')
    setBusqueda('')
    setClientes([])
    setBorrando(false)
  }

  async function guardarPlan(payload: any, planId?: string) {
    const registro = { ...payload, cliente_id: clienteSeleccionado.id }
    if (planId) {
      const { error } = await supabase.from('contratos').update(registro).eq('id', planId)
      if (error) { alert('Error al actualizar plan: ' + error.message); return }
    } else {
      const { error } = await supabase.from('contratos').insert(registro)
      if (error) { alert('Error al crear plan: ' + error.message); return }
    }
    setModalPlan(null)
    await cargarDatosCliente(clienteSeleccionado)
    await cargarDatosBase()
  }

  const porcentaje = (p: any) => Math.min((p.clases_tomadas / p.total_clases) * 100, 100)
  const colorBarra = (p: any) => {
    const pct = porcentaje(p)
    if (pct >= 100) return '#ef4444'
    if (pct >= 75) return '#f59e0b'
    return TEAL
  }

  function formatFechaCorta(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  }

  function infoUltimoContrato(c: any) {
    const contratos = c.contratos || []
    if (!contratos.length) return { sede: '—', plan: '—', fecha: '—' }
    const ult = contratos[0]
    return { sede: ult.sedes?.nombre || '—', plan: ult.tipo_plan || '—', fecha: ult.fecha_inicio || '—' }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>

      {/* ENCABEZADO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a' }}>Clientes</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Busca, crea y gestiona clientes</p>
        </div>
        <button onClick={nuevoCliente} style={{ padding: '11px 22px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
          + Nuevo cliente
        </button>
      </div>

      {/* LISTA */}
      {modo === 'lista' && (
        <>
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <input
              placeholder="Buscar cliente por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoFocus
              style={{ ...estiloInput, marginTop: 0, paddingLeft: '44px', fontSize: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
            />
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '18px' }}>🔍</span>
          </div>

          {cargando && <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>Buscando...</div>}

          {busqueda.length >= 2 && clientes.map((c: any) => (
            <div key={c.id} onClick={() => seleccionarCliente(c)} style={{
              background: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '8px',
              cursor: 'pointer', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
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
                <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: c.estado === 'activo' ? TEAL_LIGHT : '#fee2e2', color: c.estado === 'activo' ? TEAL : '#991b1b' }}>
                  {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
                <span style={{ color: '#ccc', fontSize: '18px' }}>›</span>
              </div>
            </div>
          ))}

          {busqueda.length >= 2 && clientes.length === 0 && !cargando && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
              <p style={{ fontSize: '28px', margin: '0 0 8px' }}>🔍</p>
              <p style={{ margin: 0 }}>No se encontraron clientes con ese nombre</p>
            </div>
          )}

          {/* Tabla últimos 20 clientes */}
          {busqueda.length < 2 && (
            <>
              <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#555', fontWeight: '600' }}>
                Últimos 20 clientes registrados
              </h3>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: TEAL_LIGHT }}>
                      {['Fecha de ingreso', 'Nombre', 'Sede', 'Tipo de plan', 'Inicio del plan', 'Estado'].map(h => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '13px', color: TEAL, fontWeight: '600' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ultimosClientes.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>
                          Los clientes nuevos aparecerán aquí
                        </td>
                      </tr>
                    )}
                    {ultimosClientes.map((c: any, i) => {
                      const info = infoUltimoContrato(c)
                      return (
                        <tr key={c.id} onClick={() => seleccionarCliente(c)}
                          style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                          onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}
                        >
                          <td style={{ padding: '11px 16px', fontSize: '13px', color: '#888' }}>{formatFechaCorta(c.created_at)}</td>
                          <td style={{ padding: '11px 16px', fontSize: '14px', fontWeight: '500', color: '#1a1a1a' }}>{c.nombre}</td>
                          <td style={{ padding: '11px 16px', fontSize: '14px', color: '#555' }}>{info.sede}</td>
                          <td style={{ padding: '11px 16px', fontSize: '14px', color: '#555' }}>{info.plan}</td>
                          <td style={{ padding: '11px 16px', fontSize: '14px', color: '#555' }}>{info.fecha}</td>
                          <td style={{ padding: '11px 16px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: c.estado === 'activo' ? TEAL_LIGHT : '#fee2e2', color: c.estado === 'activo' ? TEAL : '#991b1b' }}>
                              {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {modo === 'nuevo' && (
        <FormCliente modo={modo} form={form} setForm={setForm} cargando={cargando} onGuardar={guardar} onVolver={() => setModo('lista')} />
      )}

      {modo === 'editar' && (
        <FormCliente modo={modo} form={form} setForm={setForm} cargando={cargando} onGuardar={guardar} onVolver={() => setModo('ver')} />
      )}

      {/* VER CLIENTE */}
      {modo === 'ver' && clienteSeleccionado && (
        <div>
          <button onClick={() => { setModo('lista'); setBusqueda(''); setClientes([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '20px', padding: 0, fontWeight: '500' }}>
            ← Volver a la lista
          </button>

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
                <button onClick={() => setModo('editar')} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  Editar
                </button>
                <button onClick={() => { setConfirmarBorrar(true); setErrorBorrar('') }} style={{ padding: '8px 18px', background: 'rgba(220,38,38,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  Borrar
                </button>
              </div>
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

          {confirmarBorrar && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '16px', color: '#991b1b', fontWeight: '700' }}>¿Borrar a {form.nombre}?</p>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666' }}>Esta acción no se puede deshacer.</p>
              {errorBorrar && (
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#dc2626', fontWeight: '500', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px' }}>
                  ⚠️ {errorBorrar}
                </p>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={intentarBorrarCliente} disabled={borrando} style={{ padding: '9px 22px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                  {borrando ? 'Verificando...' : 'Sí, borrar cliente'}
                </button>
                <button onClick={() => { setConfirmarBorrar(false); setErrorBorrar('') }} style={{ padding: '9px 22px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>
              Planes <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({planes.length})</span>
            </h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setModalPlan({})} style={{ padding: '8px 18px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                + Crear plan
              </button>
              <button style={{ padding: '8px 18px', background: 'white', color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                onClick={() => alert('Próximamente: inscripción a talleres')}>
                + Asignar a taller
              </button>
            </div>
          </div>

          {planes.length === 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#888', marginBottom: '24px' }}>
              Sin planes registrados
            </div>
          )}

          {planes.map((p: any) => (
            <div key={p.id} style={{ background: 'white', borderRadius: '18px', padding: '20px 24px', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>
                    {p.instrumentos?.nombre || '—'}
                    <span style={{ marginLeft: '8px', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', background: p.estado === 'activo' ? TEAL_LIGHT : '#f1f5f9', color: p.estado === 'activo' ? TEAL : '#999', fontWeight: '500' }}>
                      {p.estado}
                    </span>
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>👤 {p.profesores?.nombre || '—'} · 🏫 {p.sedes?.nombre || '—'}</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>📅 {p.fecha_inicio || '—'} · {p.duracion_min} min/clase</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: colorBarra(p) }}>
                    {p.clases_tomadas}<span style={{ fontSize: '14px', color: '#aaa', fontWeight: '400' }}>/{p.total_clases}</span>
                  </p>
                  <button onClick={() => setModalPlan(p)} style={{ padding: '5px 14px', background: TEAL_LIGHT, color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>
                    Editar plan
                  </button>
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

      {modalPlan !== null && (
        <ModalPlan
          plan={modalPlan}
          profesores={profesores}
          instrumentos={instrumentos}
          sedes={sedes}
          onGuardar={guardarPlan}
          onCerrar={() => setModalPlan(null)}
        />
      )}
    </div>
  )
}
