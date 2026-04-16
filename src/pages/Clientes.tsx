import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'

export default function Clientes() {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [planes, setPlanes] = useState([])
  const [clases, setClases] = useState([])
  const [modo, setModo] = useState('lista')
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState({
    nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo'
  })

  useEffect(() => {
    if (busqueda.length >= 2) buscarClientes()
    else setClientes([])
  }, [busqueda])

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

  async function seleccionarCliente(c) {
    setClienteSeleccionado(c)
    setForm({
      nombre: c.nombre || '',
      telefono: c.telefono || '',
      email: c.email || '',
      grupo_whatsapp: c.grupo_whatsapp || '',
      estado: c.estado || 'activo'
    })

    const { data: planesData } = await supabase
      .from('contratos')
      .select(`
        id, total_clases, clases_tomadas, valor_plan,
        tipo_plan, estado, fecha_inicio,
        profesores (nombre),
        instrumentos (nombre)
      `)
      .eq('cliente_id', c.id)
      .order('fecha_inicio', { ascending: false })
    setPlanes(planesData || [])

    const { data: contratosCliente } = await supabase
      .from('contratos')
      .select('id')
      .eq('cliente_id', c.id)
    const contratosIds = (contratosCliente || []).map(ct => ct.id)

    if (contratosIds.length > 0) {
      const { data: clasesData } = await supabase
        .from('clases')
        .select(`
          id, fecha, duracion_min, numero_en_plan,
          modalidad, estado, contrato_id,
          profesores (nombre),
          salones (nombre),
          contratos (instrumentos (nombre))
        `)
        .in('contrato_id', contratosIds)
        .order('fecha', { ascending: false })
        .limit(50)
      setClases(clasesData || [])
    } else {
      setClases([])
    }

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
      await supabase.from('clientes').insert(form)
      alert('Cliente creado')
    } else {
      await supabase.from('clientes').update(form).eq('id', clienteSeleccionado.id)
      alert('Cliente actualizado')
    }
    setCargando(false)
    setModo('lista')
    setBusqueda('')
    setClientes([])
  }

  const estiloInput = {
    width: '100%', padding: '10px 12px',
    border: `1px solid ${TEAL_MID}`,
    borderRadius: '8px', fontSize: '15px',
    boxSizing: 'border-box' as const, marginTop: '6px',
    outline: 'none'
  }

  const porcentaje = (p) => Math.min((p.clases_tomadas / p.total_clases) * 100, 100)
  const colorBarra = (p) => {
    const pct = porcentaje(p)
    if (pct >= 100) return '#ef4444'
    if (pct >= 75) return '#f59e0b'
    return TEAL
  }

  const FormCliente = ({ onVolver }) => (
    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ background: TEAL, padding: '20px 28px' }}>
        <button onClick={onVolver} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.8)', fontSize: '14px', padding: 0, marginBottom: '8px'
        }}>
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
              <label style={{ fontWeight: '500', fontSize: '13px', color: '#555' }}>{f.label}</label>
              <input
                type={f.type}
                value={form[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={estiloInput}
              />
            </div>
          ))}
          <div>
            <label style={{ fontWeight: '500', fontSize: '13px', color: '#555' }}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} style={estiloInput}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
          <button onClick={guardar} disabled={cargando} style={{
            padding: '11px 28px', background: TEAL, color: 'white',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            fontSize: '15px', fontWeight: '500'
          }}>
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onVolver} style={{
            padding: '11px 28px', background: '#f1f5f9', color: '#334155',
            border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px'
          }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )

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
          fontSize: '15px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          + Nuevo cliente
        </button>
      </div>

      {/* LISTA */}
      {modo === 'lista' && (
        <>
          <div style={{ position: 'relative' as const, marginBottom: '20px' }}>
            <input
              placeholder="Buscar cliente por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoFocus
              style={{
                ...estiloInput, marginTop: 0,
                paddingLeft: '44px', fontSize: '16px',
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)'
              }}
            />
            <span style={{
              position: 'absolute' as const, left: '14px', top: '50%',
              transform: 'translateY(-50%)', color: '#aaa', fontSize: '18px'
            }}>🔍</span>
          </div>

          {cargando && (
            <div style={{ textAlign: 'center' as const, padding: '32px', color: '#666' }}>Buscando...</div>
          )}

          {clientes.map(c => (
            <div key={c.id} onClick={() => seleccionarCliente(c)} style={{
              background: 'white', borderRadius: '12px', padding: '16px 20px',
              marginBottom: '8px', cursor: 'pointer',
              border: '1px solid #eef2f7',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              transition: 'all 0.15s'
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = TEAL_MID)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#eef2f7')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: TEAL_LIGHT, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: TEAL
                }}>
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#1a1a1a' }}>{c.nombre}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#888' }}>💬 {c.grupo_whatsapp || '—'}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                  background: c.estado === 'activo' ? '#e8f5f5' : '#fee2e2',
                  color: c.estado === 'activo' ? TEAL : '#991b1b'
                }}>
                  {c.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
                <span style={{ color: '#ccc', fontSize: '18px' }}>›</span>
              </div>
            </div>
          ))}

          {busqueda.length >= 2 && clientes.length === 0 && !cargando && (
            <div style={{ textAlign: 'center' as const, padding: '48px', color: '#888' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🔍</p>
              <p style={{ margin: 0 }}>No se encontraron clientes con ese nombre</p>
            </div>
          )}
          {busqueda.length < 2 && (
            <div style={{ textAlign: 'center' as const, padding: '48px', color: '#aaa' }}>
              <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🎵</p>
              <p style={{ margin: 0, fontSize: '15px' }}>Escribe al menos 2 letras para buscar</p>
            </div>
          )}
        </>
      )}

      {/* NUEVO */}
      {modo === 'nuevo' && <FormCliente onVolver={() => setModo('lista')} />}

      {/* EDITAR */}
      {modo === 'editar' && <FormCliente onVolver={() => setModo('ver')} />}

      {/* VER CLIENTE */}
      {modo === 'ver' && clienteSeleccionado && (
        <div>
          <button onClick={() => { setModo('lista'); setBusqueda(''); setClientes([]) }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: TEAL, fontSize: '14px', marginBottom: '20px', padding: 0, fontWeight: '500'
          }}>
            ← Volver a la lista
          </button>

          {/* Tarjeta cliente */}
          <div style={{
            background: 'white', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '24px'
          }}>
            <div style={{ background: TEAL, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: '700', color: 'white'
                }}>
                  {form.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '22px' }}>{form.nombre}</h3>
                  <span style={{
                    display: 'inline-block', marginTop: '6px',
                    padding: '3px 12px', borderRadius: '20px', fontSize: '12px',
                    background: form.estado === 'activo' ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.4)',
                    color: 'white', fontWeight: '500'
                  }}>
                    {form.estado === 'activo' ? '● Activo' : '● Inactivo'}
                  </span>
                </div>
              </div>
              <button onClick={() => setModo('editar')} style={{
                padding: '8px 18px', background: 'rgba(255,255,255,0.2)',
                color: 'white', border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '8px', cursor: 'pointer', fontSize: '14px'
              }}>
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
    <p style={{ margin: '0 0 4px', fontSize: '18px', color: '#999', fontWeight: '600' }}>{d.icon} {d.label}</p>
    <p style={{ margin: 0, fontSize: '15px', color: '#333' }}>{d.valor || '—'}</p>
  </div>
))}
            </div>
          </div>

          {/* Planes */}
          <h3 style={{ margin: '0 0 14px', fontSize: '24px', color: '#1a1a1a' }}>
            Planes activos <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({planes.length})</span>
          </h3>
          {planes.length === 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center' as const, color: '#888', marginBottom: '24px' }}>
              Sin planes registrados
            </div>
          )}
          {planes.map(p => (
            <div key={p.id} style={{
              background: 'white', borderRadius: '18px', padding: '20px 24px',
              border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              marginBottom: '10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>
                    {p.instrumentos?.nombre || '—'}
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>
                    👤 {p.profesores?.nombre || '—'}
                  </p>
                  <p style={{ margin: 0, fontSize: '20px', color: '#666' }}>
                    📅 Inicio: {p.fecha_inicio || '—'} · {p.tipo_plan}
                  </p>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <p style={{ margin: '0 0 2px', fontSize: '28px', fontWeight: '700', color: colorBarra(p) }}>
                    {p.clases_tomadas}<span style={{ fontSize: '16px', color: '#aaa', fontWeight: '400' }}>/{p.total_clases}</span>
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>clases tomadas</p>
                </div>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  height: '8px', borderRadius: '6px',
                  width: `${porcentaje(p)}%`,
                  background: colorBarra(p),
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ fontSize: '12px', color: '#999' }}>
                  {p.total_clases - p.clases_tomadas} clases restantes
                </span>
                <span style={{ fontSize: '20px', color: '#555', fontWeight: '500' }}>
                  {'$'}{p.valor_plan?.toLocaleString() || '—'}
                 </span>
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
                  {['#', 'Fecha', 'Profesor', 'Instrumento', 'Duración', 'Modalidad'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: '13px', color: TEAL, fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clases.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center' as const, color: '#888' }}>Sin clases registradas</td></tr>
                )}
                {clases.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: TEAL, fontWeight: '600' }}>{c.numero_en_plan || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.fecha}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.profesores?.nombre || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.contratos?.instrumentos?.nombre || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.duracion_min} min</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                        background: c.modalidad === 'domicilio' ? '#fef3c7' : c.modalidad === 'virtual' ? '#eff6ff' : TEAL_LIGHT,
                        color: c.modalidad === 'domicilio' ? '#92400e' : c.modalidad === 'virtual' ? '#1d4ed8' : TEAL
                      }}>
                        {c.modalidad}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
