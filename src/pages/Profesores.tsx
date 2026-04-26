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

const fS: React.CSSProperties = { width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }
const lS: React.CSSProperties = { display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555' }
const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333' }

function colorEstado(e: string) {
  if (e === 'dada') return { bg: '#fefce8', color: '#854d0e' }
  if (e === 'cancelada') return { bg: '#fee2e2', color: '#991b1b' }
  if (e === 'confirmada') return { bg: '#dcfce7', color: '#166534' }
  return { bg: '#eff6ff', color: '#1d4ed8' }
}

export default function Profesores() {
  const [modo, setModo] = useState<'lista' | 'ver' | 'nuevo'>('lista')
  const [editando, setEditando] = useState(false)
  const [profesores, setProfesores] = useState<any[]>([])
  const [prof, setProf] = useState<any>(null)
  const [cargando, setCargando] = useState(false)

  const fVacio = { nombre: '', telefono: '', email: '', ciudad: 'Bogotá', activo: true }
  const [form, setForm] = useState<any>(fVacio)
  const [guardando, setGuardando] = useState(false)
  const [errForm, setErrForm] = useState('')

  const [disponibilidad, setDisponibilidad] = useState<any[]>([])
  const [nuevoDia, setNuevoDia] = useState('lunes')
  const [nuevaHI, setNuevaHI] = useState('08:00')
  const [nuevaHF, setNuevaHF] = useState('12:00')

  const [tarifas, setTarifas] = useState<any[]>([])
  const [ntCiudad, setNtCiudad] = useState('Bogotá')
  const [ntDuracion, setNtDuracion] = useState(60)
  const [ntTaller, setNtTaller] = useState(false)
  const [ntValor, setNtValor] = useState('')

  const [clases, setClases] = useState<any[]>([])
  const [mes, setMes] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
  })

  const [claseModal, setClaseModal] = useState<any>(null)
  const [editHonorario, setEditHonorario] = useState('')
  const [guardandoH, setGuardandoH] = useState(false)

  useEffect(() => { cargarProfesores() }, [])
  useEffect(() => { if (prof) cargarClases(prof) }, [mes])

  async function cargarProfesores() {
    setCargando(true)
    const { data } = await supabase.from('profesores').select('id, nombre, telefono, email, ciudad, activo').order('nombre')
    setProfesores(data || [])
    setCargando(false)
  }

  async function seleccionar(p: any) {
    setCargando(true)
    const { data: completo } = await supabase.from('profesores').select('*').eq('id', p.id).single()
    const profesor = completo || p
    setProf(profesor)
    setForm({ nombre: profesor.nombre || '', telefono: profesor.telefono || '', email: profesor.email || '', ciudad: profesor.ciudad || 'Bogotá', activo: profesor.activo !== false })
    const { data: disp } = await supabase.from('profesor_disponibilidad').select('*').eq('profesor_id', p.id).order('dia_semana')
    setDisponibilidad(disp || [])
    const { data: tar } = await supabase.from('profesor_tarifas').select('*').eq('profesor_id', p.id).order('ciudad').order('duracion_min')
    setTarifas(tar || [])
    await cargarClases(profesor)
    setEditando(false)
    setErrForm('')
    setCargando(false)
    setModo('ver')
  }

  async function cargarClases(p: any) {
    const fechaInicio = `${mes}-01`
    const [a, m] = mes.split('-')
    const ultimo = new Date(parseInt(a), parseInt(m), 0).getDate()
    const fechaFin = `${mes}-${ultimo}`
    const { data } = await supabase
      .from('clases')
      .select('id, fecha, hora, duracion_min, estado, revision_pendiente, observaciones, honorario_valor, contratos(clientes(nombre), instrumentos(nombre)), salones(nombre, sedes(nombre))')
      .eq('profesor_id', p.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false })
    setClases(data || [])
  }

  async function guardar() {
    if (!form.nombre.trim()) { setErrForm('El nombre es obligatorio'); return }
    setGuardando(true); setErrForm('')
    const payload = { nombre: form.nombre.trim(), telefono: form.telefono || null, email: form.email || null, ciudad: form.ciudad, activo: form.activo }
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('profesores').insert(payload).select().single()
      if (error) { setErrForm('Error: ' + error.message); setGuardando(false); return }
      setProf(data); setDisponibilidad([]); setTarifas([]); setClases([])
      setEditando(false); setModo('ver')
    } else {
      const { error } = await supabase.from('profesores').update(payload).eq('id', prof.id)
      if (error) { setErrForm('Error: ' + error.message); setGuardando(false); return }
      setProf({ ...prof, ...payload }); setEditando(false)
    }
    await cargarProfesores()
    setGuardando(false)
  }

  async function agregarDisp() {
    if (!prof) return
    const { data, error } = await supabase.from('profesor_disponibilidad').insert({
      profesor_id: prof.id, dia_semana: nuevoDia, hora_inicio: nuevaHI + ':00', hora_fin: nuevaHF + ':00'
    }).select().single()
    if (!error && data) setDisponibilidad(prev => [...prev, data])
  }

  async function borrarDisp(id: string) {
    await supabase.from('profesor_disponibilidad').delete().eq('id', id)
    setDisponibilidad(prev => prev.filter(d => d.id !== id))
  }

  async function agregarTarifa() {
    if (!prof || !ntValor) return
    const { data, error } = await supabase.from('profesor_tarifas').insert({
      profesor_id: prof.id, ciudad: ntCiudad,
      duracion_min: ntTaller ? null : ntDuracion,
      taller_grupal: ntTaller, valor: Number(ntValor)
    }).select().single()
    if (!error && data) { setTarifas(prev => [...prev, data]); setNtValor('') }
  }

  async function borrarTarifa(id: string) {
    await supabase.from('profesor_tarifas').delete().eq('id', id)
    setTarifas(prev => prev.filter(t => t.id !== id))
  }

  async function guardarHonorario() {
    if (!claseModal) return
    setGuardandoH(true)
    await supabase.from('clases').update({ honorario_valor: Number(editHonorario) }).eq('id', claseModal.id)
    setClases(prev => prev.map(c => c.id === claseModal.id ? { ...c, honorario_valor: Number(editHonorario) } : c))
    setClaseModal(null)
    setGuardandoH(false)
  }

  function getHonorario(c: any) {
    if (c.honorario_valor !== null && c.honorario_valor !== undefined) return Number(c.honorario_valor)
    const sede = c.salones?.sedes?.nombre || ''
    const ciudad = sede.toLowerCase().includes('tunja') ? 'Tunja' : 'Bogotá'
    const t = tarifas.find(t => t.ciudad === ciudad && t.duracion_min === c.duracion_min && !t.taller_grupal)
    return t?.valor || 0
  }

  const clasesDadas = clases.filter(c => c.estado === 'dada')
  const totalHonorarios = clasesDadas.reduce((sum, c) => sum + getHonorario(c), 0)
  const contadores = {
    programada: clases.filter(c => c.estado === 'programada').length,
    confirmada: clases.filter(c => c.estado === 'confirmada').length,
    dada: clases.filter(c => c.estado === 'dada').length,
    cancelada: clases.filter(c => c.estado === 'cancelada').length,
  }

  return (
    <div style={{ padding: '24px 32px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a' }}>Profesores</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Gestiona profesores, disponibilidad, tarifas y honorarios</p>
        </div>
        {modo === 'lista' && (
          <button onClick={() => { setForm(fVacio); setErrForm(''); setModo('nuevo') }}
            style={{ padding: '10px 20px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
            + Nuevo profesor
          </button>
        )}
      </div>

      {/* LISTA */}
      {modo === 'lista' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando...</p>}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: TEAL_LIGHT }}>
                <tr>{['#', 'Nombre', 'Ciudad', 'Telefono', 'Correo', 'Estado'].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {profesores.length === 0 && <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Sin profesores</td></tr>}
                {profesores.map((p, i) => (
                  <tr key={p.id} onClick={() => seleccionar(p)}
                    style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}>
                    <td style={{ ...tdS, color: '#aaa' }}>{i + 1}</td>
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

      {/* NUEVO */}
      {modo === 'nuevo' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <button onClick={() => setModo('lista')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '16px', padding: 0, fontWeight: '500' }}>
            ← Volver
          </button>
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', maxWidth: '700px' }}>
            <div style={{ background: TEAL, padding: '20px 28px' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>Nuevo profesor</h3>
            </div>
            <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lS}>Nombre completo *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={fS} />
              </div>
              <div><label style={lS}>Telefono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={fS} /></div>
              <div><label style={lS}>Correo</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={fS} /></div>
              <div>
                <label style={lS}>Ciudad</label>
                <select value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} style={fS}>
                  {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lS}>Estado</label>
                <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm({ ...form, activo: e.target.value === 'activo' })}
                  style={{ ...fS, background: form.activo ? '#dcfce7' : '#fee2e2', color: form.activo ? '#166534' : '#991b1b', fontWeight: '600' }}>
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
              {errForm && <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: '13px', margin: 0 }}>{errForm}</p>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px' }}>
                <button onClick={guardar} disabled={guardando} style={{ padding: '11px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setModo('lista')} style={{ padding: '11px 28px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VER PROFESOR */}
      {modo === 'ver' && prof && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <button onClick={() => { setProf(null); setModo('lista') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '16px', padding: 0, fontWeight: '500' }}>
            ← Volver a la lista
          </button>

          {/* Tarjeta */}
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', color: 'white' }}>
                  {prof.nombre?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '19px' }}>{editando ? form.nombre || prof.nombre : prof.nombre}</h3>
                  <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                    {prof.ciudad || '—'} · {prof.telefono || '—'} · {prof.email || '—'}
                  </p>
                </div>
              </div>
              {!editando
                ? <button onClick={() => setEditando(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px' }}>
                    ✏️ Editar
                  </button>
                : <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={guardar} disabled={guardando} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', color: TEAL, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      {guardando ? '...' : '✓ Guardar'}
                    </button>
                    <button onClick={() => { setForm({ nombre: prof.nombre, telefono: prof.telefono || '', email: prof.email || '', ciudad: prof.ciudad || 'Bogotá', activo: prof.activo !== false }); setEditando(false) }}
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                  </div>
              }
            </div>
            {editando && (
              <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
                <div><label style={lS}>Nombre *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={fS} /></div>
                <div><label style={lS}>Telefono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={fS} /></div>
                <div><label style={lS}>Correo</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={fS} /></div>
                <div>
                  <label style={lS}>Ciudad</label>
                  <select value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} style={fS}>
                    {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lS}>Estado</label>
                  <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm({ ...form, activo: e.target.value === 'activo' })}
                    style={{ ...fS, background: form.activo ? '#dcfce7' : '#fee2e2', color: form.activo ? '#166534' : '#991b1b', fontWeight: '600' }}>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </div>
                {errForm && <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: '13px', margin: 0 }}>{errForm}</p>}
              </div>
            )}
          </div>

          {/* Disponibilidad y tarifas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            {/* Disponibilidad */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
              <div style={{ background: TEAL_LIGHT, padding: '12px 18px', borderBottom: '1px solid #eef2f7' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: TEAL }}>Disponibilidad semanal</p>
              </div>
              <div style={{ padding: '14px 18px' }}>
                {disponibilidad.length === 0 && <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 10px' }}>Sin franjas registradas</p>}
                {disponibilidad.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: TEAL_LIGHT, borderRadius: '8px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>
                      {d.dia_semana.charAt(0).toUpperCase() + d.dia_semana.slice(1)} {d.hora_inicio?.substring(0, 5)} - {d.hora_fin?.substring(0, 5)}
                    </span>
                    {editando && <button onClick={() => borrarDisp(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>x</button>}
                  </div>
                ))}
                {editando && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '10px', alignItems: 'end' }}>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Dia</label>
                      <select value={nuevoDia} onChange={e => setNuevoDia(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Desde</label>
                      <select value={nuevaHI} onChange={e => setNuevaHI(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Hasta</label>
                      <select value={nuevaHF} onChange={e => setNuevaHF(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <button onClick={agregarDisp} style={{ padding: '6px 10px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      + Agregar
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tarifas */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
              <div style={{ background: TEAL_LIGHT, padding: '12px 18px', borderBottom: '1px solid #eef2f7' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: TEAL }}>Tarifas de honorarios</p>
              </div>
              <div style={{ padding: '14px 18px' }}>
                {tarifas.length === 0 && <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 10px' }}>Sin tarifas registradas</p>}
                {tarifas.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fafbfc', borderRadius: '8px', marginBottom: '5px', border: '1px solid #f1f5f9' }}>
                    <span style={{ fontSize: '13px', color: '#333' }}>{t.ciudad} {t.taller_grupal ? 'Taller grupal' : `${t.duracion_min} min`}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: TEAL }}>${Number(t.valor).toLocaleString()}</span>
                      {editando && <button onClick={() => borrarTarifa(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>x</button>}
                    </div>
                  </div>
                ))}
                {editando && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '10px', alignItems: 'end' }}>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Ciudad</label>
                      <select value={ntCiudad} onChange={e => setNtCiudad(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {CIUDADES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Tipo</label>
                      <select value={ntTaller ? 'taller' : String(ntDuracion)}
                        onChange={e => { const v = e.target.value; setNtTaller(v === 'taller'); setNtDuracion(v === 'taller' ? 60 : Number(v)) }}
                        style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {DURACIONES.map(d => <option key={d} value={d}>{d} min</option>)}
                        <option value="taller">Taller grupal</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Valor ($)</label>
                      <input type="number" value={ntValor} onChange={e => setNtValor(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }} placeholder="0" />
                    </div>
                    <button onClick={agregarTarifa} style={{ padding: '6px 10px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      + Agregar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Encabezado clases del mes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '17px', color: '#1a1a1a' }}>Clases del mes</h3>
            <input type="month" value={mes} onChange={e => setMes(e.target.value)}
              style={{ padding: '6px 10px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
          </div>

          {/* Contadores */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Programadas', count: contadores.programada, bg: '#eff6ff', color: '#1d4ed8' },
              { label: 'Confirmadas', count: contadores.confirmada, bg: '#dcfce7', color: '#166534' },
              { label: 'Dadas', count: contadores.dada, bg: '#fefce8', color: '#854d0e' },
              { label: 'Canceladas', count: contadores.cancelada, bg: '#fee2e2', color: '#991b1b' },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: '10px', padding: '10px 18px', textAlign: 'center', minWidth: '100px' }}>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: c.color }}>{c.count}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: c.color }}>{c.label}</p>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '10px', padding: '10px 18px', textAlign: 'center', minWidth: '140px' }}>
              <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: TEAL }}>${totalHonorarios.toLocaleString()}</p>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: TEAL }}>Honorarios ({clasesDadas.length} dadas)</p>
            </div>
          </div>

          {/* Tabla clases */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: TEAL_LIGHT }}>
                <tr>{['Fecha', 'Hora', 'Cliente', 'Duracion', 'Sede', 'Estado', 'Honorario', ''].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {clases.length === 0 && <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#aaa' }}>Sin clases este mes</td></tr>}
                {clases.map((c, i) => {
                  const col = colorEstado(c.estado)
                  const honorario = getHonorario(c)
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid #f8fafc', background: c.revision_pendiente ? '#fff7ed' : i % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={tdS}>{c.fecha}</td>
                      <td style={tdS}>{c.hora?.substring(0, 5) || '—'}</td>
                      <td style={{ ...tdS, fontWeight: '500' }}>
                        {c.contratos?.clientes?.nombre || '—'}
                        {c.revision_pendiente && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#fff7ed', color: '#c2410c', padding: '1px 6px', borderRadius: '10px' }}>revision pendiente</span>}
                      </td>
                      <td style={{ ...tdS, textAlign: 'center' }}>{c.duracion_min} min</td>
                      <td style={tdS}>{c.salones?.sedes?.nombre || '—'}</td>
                      <td style={tdS}><span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: col.bg, color: col.color }}>{c.estado}</span></td>
                      <td style={{ ...tdS, fontWeight: '600', color: c.estado === 'dada' ? TEAL : '#aaa' }}>
                        {c.estado === 'dada' ? `$${honorario.toLocaleString()}` : '—'}
                        {c.honorario_valor !== null && c.honorario_valor !== undefined && <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>editado</span>}
                      </td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <button onClick={() => { setClaseModal(c); setEditHonorario(String(getHonorario(c))) }}
                          style={{ background: 'none', border: `1px solid ${TEAL_MID}`, borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px', color: TEAL }}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL CLASE */}
      {claseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: TEAL, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Detalle de clase</h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  {claseModal.contratos?.clientes?.nombre} {claseModal.fecha} {claseModal.hora?.substring(0, 5)}
                </p>
              </div>
              <button onClick={() => setClaseModal(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 11px', cursor: 'pointer' }}>X</button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div><span style={{ color: '#999' }}>Instrumento: </span><strong>{claseModal.contratos?.instrumentos?.nombre || '—'}</strong></div>
                <div><span style={{ color: '#999' }}>Duracion: </span><strong>{claseModal.duracion_min} min</strong></div>
                <div><span style={{ color: '#999' }}>Sede: </span><strong>{claseModal.salones?.sedes?.nombre || '—'}</strong></div>
                <div>
                  <span style={{ color: '#999' }}>Estado: </span>
                  <span style={{ padding: '1px 8px', borderRadius: '10px', fontWeight: '600', fontSize: '12px', background: colorEstado(claseModal.estado).bg, color: colorEstado(claseModal.estado).color }}>
                    {claseModal.estado}
                  </span>
                </div>
              </div>

              {claseModal.revision_pendiente && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: '#c2410c' }}>
                  El estudiante no asistio - pendiente de revision
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ ...lS, marginBottom: '6px' }}>Observaciones del profesor</label>
                {claseModal.observaciones
                  ? <div style={{ background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#333', lineHeight: '1.5' }}>
                      {claseModal.observaciones}
                    </div>
                  : <p style={{ color: '#aaa', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>Sin observaciones</p>
                }
              </div>

              {claseModal.estado === 'dada' && (
                <div>
                  <label style={lS}>Honorario ($)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" value={editHonorario} onChange={e => setEditHonorario(e.target.value)} style={{ ...fS, flex: 1 }} />
                    <button onClick={guardarHonorario} disabled={guardandoH}
                      style={{ padding: '9px 18px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>
                      {guardandoH ? '...' : 'Guardar'}
                    </button>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#aaa' }}>El valor editado reemplaza al calculado por tarifa</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
