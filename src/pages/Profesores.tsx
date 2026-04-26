import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DURACIONES = [30, 45, 60, 90]
const CIUDADES = ['Bogotá', 'Tunja']
const HORAS = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`,
  borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555'
}
const thS: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600'
}
const tdS: React.CSSProperties = {
  padding: '10px 14px', fontSize: '13px', color: '#333'
}

export default function Profesores() {
  const [modo, setModo] = useState<'lista' | 'ver' | 'nuevo' | 'editar'>('lista')
  const [profesores, setProfesores] = useState<any[]>([])
  const [profesorSel, setProfesorSel] = useState<any>(null)
  const [cargando, setCargando] = useState(false)

  // Form
  const formVacio = { nombre: '', telefono: '', email: '', ciudad: 'Bogotá', activo: true }
  const [form, setForm] = useState<any>(formVacio)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState('')

  // Disponibilidad
  const [disponibilidad, setDisponibilidad] = useState<any[]>([])
  const [nuevoDia, setNuevoDia] = useState('lunes')
  const [nuevaHoraInicio, setNuevaHoraInicio] = useState('08:00')
  const [nuevaHoraFin, setNuevaHoraFin] = useState('12:00')
  const [guardandoDisp, setGuardandoDisp] = useState(false)

  // Tarifas
  const [tarifas, setTarifas] = useState<any[]>([])
  const [nuevaTarifa, setNuevaTarifa] = useState({ ciudad: 'Bogotá', duracion_min: 60, taller_grupal: false, valor: '' })
  const [guardandoTarifa, setGuardandoTarifa] = useState(false)

  // Clases y honorarios
  const [clases, setClases] = useState<any[]>([])
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  const [verDesglose, setVerDesglose] = useState(false)

  useEffect(() => { cargarProfesores() }, [])
  useEffect(() => { if (profesorSel) cargarClases(profesorSel) }, [mesSeleccionado])

  async function cargarProfesores() {
    setCargando(true)
    const { data } = await supabase.from('profesores').select('id, nombre, telefono, email, ciudad, activo').order('nombre')
    setProfesores(data || [])
    setCargando(false)
  }

  async function seleccionarProfesor(p: any) {
    setCargando(true)
    const { data: completo } = await supabase.from('profesores').select('*').eq('id', p.id).single()
    setProfesorSel(completo || p)
    setForm(completo || p)

    const { data: disp } = await supabase.from('profesor_disponibilidad').select('*').eq('profesor_id', p.id).order('dia_semana')
    setDisponibilidad(disp || [])

    const { data: tar } = await supabase.from('profesor_tarifas').select('*').eq('profesor_id', p.id).order('ciudad').order('duracion_min')
    setTarifas(tar || [])

    await cargarClases(completo || p)
    setCargando(false)
    setModo(modo === 'nuevo' ? 'ver' : 'ver')
  }

  async function cargarClases(p: any) {
    const fechaInicio = `${mesSeleccionado}-01`
    const [anio, mes] = mesSeleccionado.split('-')
    const ultimoDia = new Date(parseInt(anio), parseInt(mes), 0).getDate()
    const fechaFin = `${mesSeleccionado}-${ultimoDia}`
    const { data } = await supabase
      .from('clases')
      .select(`id, fecha, hora, duracion_min, estado, contratos(clientes(nombre), instrumentos(nombre)), salones(nombre, sedes(nombre))`)
      .eq('profesor_id', p.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false })
    setClases(data || [])
  }

  async function guardarProfesor() {
    if (!form.nombre.trim()) { setErrorForm('El nombre es obligatorio'); return }
    setGuardando(true)
    setErrorForm('')
    const payload = { nombre: form.nombre.trim(), telefono: form.telefono || null, email: form.email || null, ciudad: form.ciudad, activo: form.activo }
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('profesores').insert(payload).select().single()
      if (error) { setErrorForm('Error: ' + error.message); setGuardando(false); return }
      setProfesorSel(data)
      setDisponibilidad([])
      setTarifas([])
      setClases([])
      setModo(modo === 'nuevo' ? 'ver' : 'ver')
    } else {
      const { error } = await supabase.from('profesores').update(payload).eq('id', profesorSel.id)
      if (error) { setErrorForm('Error: ' + error.message); setGuardando(false); return }
      setProfesorSel({ ...profesorSel, ...payload })
      setModo(modo === 'nuevo' ? 'ver' : 'ver')
    }
    await cargarProfesores()
    setGuardando(false)
  }

  async function agregarDisponibilidad() {
    if (!profesorSel) return
    setGuardandoDisp(true)
    const { data } = await supabase.from('profesor_disponibilidad').insert({
      profesor_id: profesorSel.id, dia_semana: nuevoDia,
      hora_inicio: nuevaHoraInicio, hora_fin: nuevaHoraFin
    }).select().single()
    if (data) setDisponibilidad(prev => [...prev, data])
    setGuardandoDisp(false)
  }

  async function borrarDisponibilidad(id: string) {
    await supabase.from('profesor_disponibilidad').delete().eq('id', id)
    setDisponibilidad(prev => prev.filter(d => d.id !== id))
  }

  async function agregarTarifa() {
    if (!profesorSel || !nuevaTarifa.valor) return
    setGuardandoTarifa(true)
    const { data } = await supabase.from('profesor_tarifas').insert({
      profesor_id: profesorSel.id,
      ciudad: nuevaTarifa.ciudad,
      duracion_min: nuevaTarifa.taller_grupal ? null : nuevaTarifa.duracion_min,
      taller_grupal: nuevaTarifa.taller_grupal,
      valor: Number(nuevaTarifa.valor)
    }).select().single()
    if (data) setTarifas(prev => [...prev, data])
    setNuevaTarifa({ ciudad: 'Bogotá', duracion_min: 60, taller_grupal: false, valor: '' })
    setGuardandoTarifa(false)
  }

  async function borrarTarifa(id: string) {
    await supabase.from('profesor_tarifas').delete().eq('id', id)
    setTarifas(prev => prev.filter(t => t.id !== id))
  }

  // Calcular honorarios usando tarifas del profesor
  const calcularHonorarios = () => {
    let total = 0
    const desglose: any[] = []
    clases.forEach(c => {
      const sede = c.salones?.sedes?.nombre || ''
      const ciudad = sede.toLowerCase().includes('tunja') ? 'Tunja' : 'Bogotá'
      const tarifa = tarifas.find(t => t.ciudad === ciudad && t.duracion_min === c.duracion_min && !t.taller_grupal)
      const valor = tarifa?.valor || 0
      total += valor
      desglose.push({ fecha: c.fecha, cliente: c.contratos?.clientes?.nombre || '—', instrumento: c.contratos?.instrumentos?.nombre || '—', duracion: c.duracion_min, sede, ciudad, estado: c.estado, valor })
    })
    return { total, desglose }
  }

  const { total: honorariosTotal, desglose: honorariosDesglose } = calcularHonorarios()

  const colorEstado = (e: string) => {
    if (e === 'dada') return { bg: '#fefce8', color: '#854d0e' }
    if (e === 'cancelada') return { bg: '#fee2e2', color: '#991b1b' }
    if (e === 'confirmada') return { bg: '#dcfce7', color: '#166534' }
    return { bg: '#eff6ff', color: '#1d4ed8' }
  }

  // ── RENDER ──
  return (
    <div style={{ padding: '24px 32px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a', textAlign: 'left' }}>Profesores</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Gestiona profesores, disponibilidad, tarifas y honorarios</p>
        </div>
        {modo === 'lista' && (
          <button onClick={() => { setForm(formVacio); setErrorForm(''); setModo('nuevo') }}
            style={{ padding: '10px 20px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
            + Nuevo profesor
          </button>
        )}
      </div>

      {/* ── LISTA ── */}
      {modo === 'lista' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando...</p>}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: TEAL_LIGHT }}>
                <tr>
                  {['#', 'Nombre', 'Ciudad', 'Teléfono', 'Correo', 'Estado'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profesores.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Sin profesores registrados</td></tr>
                )}
                {profesores.map((p, i) => (
                  <tr key={p.id} onClick={() => seleccionarProfesor(p)}
                    style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}
                  >
                    <td style={{ ...tdS, color: '#aaa', width: '40px' }}>{i + 1}</td>
                    <td style={{ ...tdS, fontWeight: '600', color: TEAL }}>{p.nombre}</td>
                    <td style={tdS}>{p.ciudad || '—'}</td>
                    <td style={tdS}>{p.telefono || '—'}</td>
                    <td style={tdS}>{p.email || '—'}</td>
                    <td style={tdS}>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: p.activo !== false ? '#dcfce7' : '#fee2e2', color: p.activo !== false ? '#166534' : '#991b1b' }}>
                        {p.activo !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FORMULARIO NUEVO ── */}
      {modo === 'nuevo' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <button onClick={() => setModo(modo === 'nuevo' ? 'lista' : 'ver')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '16px', padding: 0, fontWeight: '500' }}>
            ← Volver
          </button>
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', maxWidth: '700px' }}>
            <div style={{ background: TEAL, padding: '20px 28px' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>{modo === 'nuevo' ? 'Nuevo profesor' : 'Editar profesor'}</h3>
            </div>
            <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Nombre completo *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Teléfono</label>
                <input value={form.telefono || ''} onChange={e => setForm({ ...form, telefono: e.target.value })} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Correo electrónico</label>
                <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Ciudad principal</label>
                <select value={form.ciudad || 'Bogotá'} onChange={e => setForm({ ...form, ciudad: e.target.value })} style={fieldStyle}>
                  {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <select value={form.activo !== false ? 'activo' : 'inactivo'} onChange={e => setForm({ ...form, activo: e.target.value === 'activo' })}
                  style={{ ...fieldStyle, background: form.activo !== false ? '#dcfce7' : '#fee2e2', color: form.activo !== false ? '#166534' : '#991b1b', fontWeight: '600' }}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              {errorForm && <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: '13px', margin: 0 }}>{errorForm}</p>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={guardarProfesor} disabled={guardando}
                  style={{ padding: '11px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setModo('lista')}
                  style={{ padding: '11px 28px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VER / EDITAR PROFESOR ── */}
      {(modo === 'ver' || modo === 'editar') && profesorSel && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <button onClick={() => { setProfesorSel(null); setModo('lista') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '16px', padding: 0, fontWeight: '500' }}>
            ← Volver a la lista
          </button>

          {/* Tarjeta profesor */}
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <div style={{ background: TEAL, padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '700', color: 'white' }}>
                  {profesorSel.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>{profesorSel.nombre}</h3>
                  <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                    {profesorSel.ciudad || '—'} · 📱 {profesorSel.telefono || '—'} · ✉️ {profesorSel.email || '—'}
                  </p>
                </div>
              </div>
              <button onClick={() => { setForm(profesorSel); setErrorForm(''); setModo('editar') }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '14px' }}>
                ✏️ Editar
              </button>
            </div>
          </div>

          {/* Disponibilidad y Tarifas solo en modo editar */}
          {modo === 'editar' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

            {/* Disponibilidad */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
              <div style={{ background: TEAL_LIGHT, padding: '14px 20px', borderBottom: '1px solid #eef2f7' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: TEAL }}>📅 Disponibilidad semanal</p>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {disponibilidad.length === 0 && <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 12px' }}>Sin franjas registradas</p>}
                {disponibilidad.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: TEAL_LIGHT, borderRadius: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>
                      {d.dia_semana.charAt(0).toUpperCase() + d.dia_semana.slice(1)} · {d.hora_inicio?.substring(0,5)} - {d.hora_fin?.substring(0,5)}
                    </span>
                    <button onClick={() => borrarDisponibilidad(d.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '0 4px' }}>×</button>
                  </div>
                ))}
                {/* Agregar franja */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', marginTop: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px' }}>Día</label>
                    <select value={nuevoDia} onChange={e => setNuevoDia(e.target.value)} style={{ ...fieldStyle, fontSize: '12px', padding: '7px 8px' }}>
                      {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px' }}>Desde</label>
                    <select value={nuevaHoraInicio} onChange={e => setNuevaHoraInicio(e.target.value)} style={{ ...fieldStyle, fontSize: '12px', padding: '7px 8px' }}>
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px' }}>Hasta</label>
                    <select value={nuevaHoraFin} onChange={e => setNuevaHoraFin(e.target.value)} style={{ ...fieldStyle, fontSize: '12px', padding: '7px 8px' }}>
                      {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <button onClick={agregarDisponibilidad} disabled={guardandoDisp}
                    style={{ padding: '7px 12px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    + Agregar
                  </button>
                </div>
              </div>
            </div>

            {/* Tarifas */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
              <div style={{ background: TEAL_LIGHT, padding: '14px 20px', borderBottom: '1px solid #eef2f7' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: TEAL }}>💰 Tarifas de honorarios</p>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {tarifas.length === 0 && <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 12px' }}>Sin tarifas registradas</p>}
                {tarifas.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: '#fafbfc', borderRadius: '8px', marginBottom: '6px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', color: '#333' }}>
                      {t.ciudad} · {t.taller_grupal ? 'Taller grupal' : `${t.duracion_min} min`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: TEAL }}>${Number(t.valor).toLocaleString()}</span>
                      <button onClick={() => borrarTarifa(t.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px', padding: '0 4px' }}>×</button>
                    </div>
                  </div>
                ))}
                {/* Agregar tarifa */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', marginTop: '12px', alignItems: 'end' }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px' }}>Ciudad</label>
                    <select value={nuevaTarifa.ciudad} onChange={e => setNuevaTarifa({ ...nuevaTarifa, ciudad: e.target.value })} style={{ ...fieldStyle, fontSize: '12px', padding: '7px 8px' }}>
                      {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px' }}>Tipo</label>
                    <select value={nuevaTarifa.taller_grupal ? 'taller' : String(nuevaTarifa.duracion_min)}
                      onChange={e => setNuevaTarifa({ ...nuevaTarifa, taller_grupal: e.target.value === 'taller', duracion_min: e.target.value === 'taller' ? 60 : Number(e.target.value) })}
                      style={{ ...fieldStyle, fontSize: '12px', padding: '7px 8px' }}>
                      {DURACIONES.map(d => <option key={d} value={d}>{d} min</option>)}
                      <option value="taller">Taller grupal</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: '11px' }}>Valor ($)</label>
                    <input type="number" value={nuevaTarifa.valor} onChange={e => setNuevaTarifa({ ...nuevaTarifa, valor: e.target.value })} style={{ ...fieldStyle, fontSize: '12px', padding: '7px 8px' }} />
                  </div>
                  <button onClick={agregarTarifa} disabled={guardandoTarifa}
                    style={{ padding: '7px 12px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    + Agregar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Vista solo lectura de disponibilidad y tarifas */}
          {modo === 'ver' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
                <div style={{ background: TEAL_LIGHT, padding: '14px 20px', borderBottom: '1px solid #eef2f7' }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: TEAL }}>📅 Disponibilidad semanal</p>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {disponibilidad.length === 0
                    ? <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>Sin franjas registradas</p>
                    : disponibilidad.map(d => (
                        <div key={d.id} style={{ padding: '7px 10px', background: TEAL_LIGHT, borderRadius: '8px', marginBottom: '6px', fontSize: '13px', color: '#333', fontWeight: '500' }}>
                          {d.dia_semana.charAt(0).toUpperCase() + d.dia_semana.slice(1)} · {d.hora_inicio?.substring(0,5)} - {d.hora_fin?.substring(0,5)}
                        </div>
                      ))
                  }
                </div>
              </div>
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
                <div style={{ background: TEAL_LIGHT, padding: '14px 20px', borderBottom: '1px solid #eef2f7' }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: TEAL }}>💰 Tarifas de honorarios</p>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {tarifas.length === 0
                    ? <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>Sin tarifas registradas</p>
                    : tarifas.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: '#fafbfc', borderRadius: '8px', marginBottom: '6px', border: '1px solid #f1f5f9' }}>
                          <span style={{ fontSize: '13px', color: '#333' }}>{t.ciudad} · {t.taller_grupal ? 'Taller grupal' : `${t.duracion_min} min`}</span>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: TEAL }}>${Number(t.valor).toLocaleString()}</span>
                        </div>
                      ))
                  }
                </div>
              </div>
            </div>
          )}

          {/* Honorarios del mes */}
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ background: TEAL_LIGHT, padding: '14px 20px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '14px', color: TEAL }}>💵 Honorarios del mes</p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input type="month" value={mesSeleccionado} onChange={e => setMesSeleccionado(e.target.value)}
                  style={{ padding: '6px 10px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
                <button onClick={() => setVerDesglose(true)}
                  style={{ padding: '6px 14px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                  Ver desglose
                </button>
              </div>
            </div>
            <div style={{ padding: '20px 28px', display: 'flex', gap: '24px', alignItems: 'center' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#999' }}>Clases del mes</p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#333' }}>{clases.length}</p>
              </div>
              <div style={{ width: '1px', height: '40px', background: '#eef2f7' }} />
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#999' }}>Clases dadas</p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#166534' }}>{clases.filter(c => c.estado === 'dada').length}</p>
              </div>
              <div style={{ width: '1px', height: '40px', background: '#eef2f7' }} />
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#999' }}>Total honorarios</p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: TEAL }}>${honorariosTotal.toLocaleString()}</p>
              </div>
              {tarifas.length === 0 && (
                <p style={{ margin: 0, fontSize: '13px', color: '#f59e0b', background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fcd34d' }}>
                  ⚠️ Registra las tarifas del profesor para ver los honorarios
                </p>
              )}
            </div>
          </div>

          {/* Clases del mes */}
          <h3 style={{ margin: '0 0 12px', fontSize: '17px', color: '#1a1a1a' }}>
            Clases del mes <span style={{ color: '#aaa', fontWeight: '400', fontSize: '14px' }}>({clases.length})</span>
          </h3>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: TEAL_LIGHT }}>
                <tr>
                  {['Fecha', 'Cliente', 'Instrumento', 'Duración', 'Salón', 'Sede', 'Estado'].map(h => (
                    <th key={h} style={thS}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clases.length === 0 && <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#aaa' }}>Sin clases este mes</td></tr>}
                {clases.map((c, i) => {
                  const col = colorEstado(c.estado)
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={tdS}>{c.fecha}</td>
                      <td style={{ ...tdS, fontWeight: '500' }}>{c.contratos?.clientes?.nombre || '—'}</td>
                      <td style={tdS}>{c.contratos?.instrumentos?.nombre || '—'}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>{c.duracion_min} min</td>
                      <td style={tdS}>{c.salones?.nombre || '—'}</td>
                      <td style={tdS}>{c.salones?.sedes?.nombre || '—'}</td>
                      <td style={tdS}>
                        <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: col.bg, color: col.color }}>
                          {c.estado}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ MODAL DESGLOSE ══ */}
      {verDesglose && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '750px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>💵 Desglose de honorarios</h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{profesorSel?.nombre} · {mesSeleccionado}</p>
              </div>
              <button onClick={() => setVerDesglose(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
                  <tr>
                    {['Fecha', 'Cliente', 'Instrumento', 'Duración', 'Ciudad', 'Estado', 'Valor'].map(h => (
                      <th key={h} style={thS}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {honorariosDesglose.length === 0 && <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#aaa' }}>Sin clases</td></tr>}
                  {honorariosDesglose.map((d, i) => {
                    const col = colorEstado(d.estado)
                    return (
                      <tr key={i} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td style={tdS}>{d.fecha}</td>
                        <td style={tdS}>{d.cliente}</td>
                        <td style={tdS}>{d.instrumento}</td>
                        <td style={{ ...tdS, textAlign: 'center' }}>{d.duracion} min</td>
                        <td style={tdS}>{d.ciudad}</td>
                        <td style={tdS}>
                          <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: col.bg, color: col.color }}>{d.estado}</span>
                        </td>
                        <td style={{ ...tdS, fontWeight: '600', color: TEAL }}>{d.valor > 0 ? `$${d.valor.toLocaleString()}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: TEAL_LIGHT }}>
                    <td colSpan={6} style={{ padding: '12px 14px', fontWeight: '700', color: TEAL }}>Total</td>
                    <td style={{ padding: '12px 14px', fontWeight: '700', fontSize: '16px', color: TEAL }}>${honorariosTotal.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
