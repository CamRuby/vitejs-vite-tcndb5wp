import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { auditar } from '../auditoria'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const DURACIONES = [30, 45, 60, 90, 120]
const MODALIDADES = ['presencial', 'domicilio', 'taller']
const HORAS = Array.from({ length: 29 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})

const SUPABASE_URL = 'https://wvjohorkzmktthzjteci.supabase.co'

const fS: React.CSSProperties = { width: '100%', padding: '9px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }
const lS: React.CSSProperties = { display: 'block', fontWeight: '500', fontSize: '13px', marginBottom: '5px', color: '#555' }
const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', textAlign: 'left' }

function colEstado(e: string, canceladoTarde = false) {
  if (e === 'dada')      return { bg: '#fefce8', color: '#854d0e' }
  if (e === 'cancelada' && canceladoTarde) return { bg: '#fef3c7', color: '#92400e' }
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

  const fVacio = { nombre: '', telefono: '', email: '', ciudad: 'Bogotá', ciudad_cc: 'Bogotá', activo: true, cc: '', banco: '', tipo_cuenta: 'Ahorros', numero_cuenta: '' }
  const [form, setForm] = useState<any>(fVacio)
  const [guardando, setGuardando] = useState(false)
  const [errForm, setErrForm] = useState('')

  const [disponibilidad, setDisponibilidad] = useState<any[]>([])
  const [nDia, setNDia] = useState('lunes')
  const [nHI, setNHI] = useState('08:00')
  const [nHF, setNHF] = useState('12:00')

  const [tarifas, setTarifas] = useState<any[]>([])
  const [tModalidad, setTModalidad] = useState('presencial')
  const [tDur, setTDur] = useState(60)
  const [tTaller, setTTaller] = useState(false)
  const [tValor, setTValor] = useState('')

  // ── Copiar tarifas ──
  const [mostrarCopiar, setMostrarCopiar] = useState(false)
  const [profCopiar, setProfCopiar] = useState('')
  const [copiando, setCopiando] = useState(false)

  const [clases, setClases] = useState<any[]>([])
  const [mes, setMes] = useState(() => {
    const h = new Date()
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`
  })
  const [filtroVista, setFiltroVista] = useState<'historial' | 'programadas'>('historial')

  const [claseModal, setClaseModal] = useState<any>(null)
  const [modalAsistentes, setModalAsistentes] = useState<any[]>([])
  const [editHon, setEditHon] = useState('')
  const [editObsAdmin, setEditObsAdmin] = useState('')
  const [guardandoH, setGuardandoH] = useState(false)

  // ── Acceso app profesor ──
  const [tieneAcceso, setTieneAcceso] = useState<boolean | null>(null)
  const [nuevoEmail, setNuevoEmail] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [creandoAcceso, setCreandoAcceso] = useState(false)
  const [errAcceso, setErrAcceso] = useState('')
  const [okAcceso, setOkAcceso] = useState('')

  useEffect(() => { cargarProfesores() }, [])
  useEffect(() => { if (prof) cargarClases(prof) }, [mes])

  async function cargarProfesores() {
    setCargando(true)
    const { data, error } = await supabase.from('profesores').select('id, nombre, telefono, email, ciudad, ciudad_cc, activo, cc, banco, tipo_cuenta, numero_cuenta').order('nombre')
    if (error) {
      const { data: data2 } = await supabase.from('profesores').select('id, nombre, telefono, email, ciudad, activo').order('nombre')
      setProfesores(data2 || [])
      setCargando(false)
      return
    }
    setProfesores(data || [])
    setCargando(false)
  }

  async function verificarAcceso(email: string) {
    if (!email) { setTieneAcceso(false); return }
    const { data } = await supabase.from('roles').select('rol').eq('email', email).single()
    setTieneAcceso(!!data)
  }

  async function seleccionar(p: any) {
    setCargando(true)
    const { data: c } = await supabase.from('profesores').select('*').eq('id', p.id).single()
    const pr = c || p
    setProf(pr)
    setForm({ nombre: pr.nombre || '', telefono: pr.telefono || '', email: pr.email || '', ciudad: pr.ciudad || 'Bogotá', ciudad_cc: pr.ciudad_cc || 'Bogotá', activo: pr.activo !== false, cc: pr.cc || '', banco: pr.banco || '', tipo_cuenta: pr.tipo_cuenta || 'Ahorros', numero_cuenta: pr.numero_cuenta || '' })
    const { data: d } = await supabase.from('profesor_disponibilidad').select('*').eq('profesor_id', p.id).order('dia_semana')
    setDisponibilidad(d || [])
    const { data: t } = await supabase.from('profesor_tarifas').select('*').eq('profesor_id', p.id).order('modalidad').order('duracion_min')
    setTarifas(t || [])
    await cargarClases(pr)
    await verificarAcceso(pr.email || '')
    setNuevoEmail(pr.email || '')
    setNuevaPassword('')
    setErrAcceso('')
    setOkAcceso('')
    setEditando(false)
    setErrForm('')
    setMostrarCopiar(false)
    setProfCopiar('')
    setCargando(false)
    setModo('ver')
  }

  async function copiarTarifas() {
    if (!profCopiar) { alert('Selecciona un profesor'); return }
    setCopiando(true)
    const { data: tarifasSource } = await supabase.from('profesor_tarifas').select('modalidad, duracion_min, taller_grupal, valor').eq('profesor_id', profCopiar)
    if (!tarifasSource?.length) { alert('El profesor seleccionado no tiene tarifas registradas'); setCopiando(false); return }
    await supabase.from('profesor_tarifas').delete().eq('profesor_id', prof.id)
    const inserts = tarifasSource.map((t: any) => ({ profesor_id: prof.id, modalidad: t.modalidad, duracion_min: t.duracion_min, taller_grupal: t.taller_grupal, valor: t.valor }))
    const { data: nuevas } = await supabase.from('profesor_tarifas').insert(inserts).select()
    setTarifas(nuevas || [])
    setMostrarCopiar(false)
    setProfCopiar('')
    setCopiando(false)
  }

  async function crearAcceso() {
    if (!nuevoEmail.trim()) { setErrAcceso('El correo es obligatorio'); return }
    if (nuevaPassword.length < 6) { setErrAcceso('La contraseña debe tener al menos 6 caracteres'); return }
    setCreandoAcceso(true); setErrAcceso(''); setOkAcceso('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${SUPABASE_URL}/functions/v1/crear-usuario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: nuevoEmail.trim(), password: nuevaPassword, rol: 'profesor' })
      })
      const json = await res.json()
      if (json.error && !json.error.toLowerCase().includes('already')) { setErrAcceso(json.error); return }
      await supabase.from('profesores').update({ email: nuevoEmail.trim() }).eq('id', prof.id)
      setForm((prev: any) => ({ ...prev, email: nuevoEmail.trim() }))
      setTieneAcceso(true)
      setOkAcceso(`✓ Acceso creado para ${nuevoEmail.trim()}`)
      setNuevaPassword('')
      setProf((prev: any) => ({ ...prev, email: nuevoEmail.trim() }))
    } catch (e: any) {
      setErrAcceso('Error al crear acceso: ' + e.message)
    } finally {
      setCreandoAcceso(false)
    }
  }

  async function cargarClases(p: any) {
    const fi = `${mes}-01`
    const [a, m] = mes.split('-')
    const ul = new Date(parseInt(a), parseInt(m), 0).getDate()
    const ff = `${mes}-${ul}`
    let result: any[] = []
    try {
      const { data: d, error } = await supabase
        .from('clases_con_numero')
       .select('id, fecha, hora, duracion_min, estado, es_cortesia, modalidad, observaciones, observaciones_admin, honorario_valor, cancelado_tarde, cancelado_por_academia, numero_calculado, contratos(clientes(nombre), instrumentos(nombre), total_clases), salones(nombre, sedes(nombre))')
        .gte('fecha', fi)
        .lte('fecha', ff)
        .order('fecha', { ascending: false })
      if (error) throw error
      result = d || []
    } catch {
      const { data: d } = await supabase
        .from('clases_con_numero')
        .select('id, fecha, hora, duracion_min, estado, es_cortesia, observaciones, honorario_valor, numero_calculado, contratos(clientes(nombre), instrumentos(nombre), total_clases), salones(nombre, sedes(nombre))')
        .eq('profesor_id', p.id)
        .gte('fecha', fi)
        .lte('fecha', ff)
        .order('fecha', { ascending: false })
      result = (d || []).map((c: any) => ({ ...c, cancelado_tarde: false, cancelado_por_academia: false, observaciones_admin: null }))
    }
    const { data: talleres } = await supabase.from('talleres')
      .select('id, nombre, hora, duracion_min, salones(nombre, sedes(nombre))').eq('profesor_id', p.id)
    if (talleres && talleres.length > 0) {
      const { data: sesiones } = await supabase.from('taller_sesiones')
        .select('id, fecha, estado, observaciones, honorario_valor, observaciones_admin, taller_id')
        .in('taller_id', talleres.map((t: any) => t.id))
        .gte('fecha', fi).lte('fecha', ff)
        .order('fecha', { ascending: false })
      const tallerMap: Record<string, any> = {}
      talleres.forEach((t: any) => { tallerMap[t.id] = t })
      const tallerRows = (sesiones || []).map((s: any) => {
        const t = tallerMap[s.taller_id]
        return {
          id: `taller-${s.id}`, fecha: s.fecha, hora: t?.hora || '00:00:00',
          duracion_min: t?.duracion_min, estado: s.estado, esTaller: true,
          nombreTaller: t?.nombre, salones: t?.salones, observaciones: s.observaciones,
          es_cortesia: false, cancelado_tarde: false, cancelado_por_academia: false,
          honorario_valor: s.honorario_valor ?? null,
          observaciones_admin: s.observaciones_admin ?? null,
          numero_calculado: null, contratos: null
        }
      })
      result = [...result, ...tallerRows].sort((a, b) =>
        b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || '')
      )
    }
    setClases(result)
  }

  async function guardar() {
    if (!form.nombre.trim()) { setErrForm('El nombre es obligatorio'); return }
    setGuardando(true); setErrForm('')
    const payload = { nombre: form.nombre.trim(), telefono: form.telefono || null, ciudad: form.ciudad, ciudad_cc: form.ciudad_cc || null, activo: form.activo, cc: form.cc || null, banco: form.banco || null, tipo_cuenta: form.tipo_cuenta || null, numero_cuenta: form.numero_cuenta || null }
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('profesores').insert(payload).select().single()
      if (error) { setErrForm('Error: ' + error.message); setGuardando(false); return }
      setProf(data); setDisponibilidad([]); setTarifas([]); setClases([])
      setEditando(false); setModo('ver')
    } else {
      const profId = prof?.id
      if (!profId) { setErrForm('Error: ID del profesor no encontrado'); setGuardando(false); return }
      const { data: updated, error } = await supabase.from('profesores').update(payload).eq('id', profId).select().single()
      if (error) { setErrForm('Error al guardar: ' + error.message); alert('Error: ' + error.message); setGuardando(false); return }
      setProf(updated || { ...prof, ...payload })
      setEditando(false)
    }
    await cargarProfesores()
    setGuardando(false)
  }

  async function agregarDisp() {
    if (!prof?.id) { alert('Sin profesor seleccionado'); return }
    const { data, error } = await supabase.from('profesor_disponibilidad')
      .insert({ profesor_id: prof.id, dia_semana: nDia, hora_inicio: nHI + ':00', hora_fin: nHF + ':00' })
      .select().single()
    if (error) { alert('Error: ' + error.message); return }
    if (data) setDisponibilidad(prev => [...prev, data])
  }

  async function borrarDisp(id: string) {
    await supabase.from('profesor_disponibilidad').delete().eq('id', id)
    setDisponibilidad(prev => prev.filter(d => d.id !== id))
  }

  async function agregarTarifa() {
    if (!prof?.id) { alert('Sin profesor seleccionado'); return }
    if (!tValor) { alert('Ingresa un valor'); return }
    const existe = tarifas.some(t =>
      t.modalidad === tModalidad && t.taller_grupal === tTaller && (tTaller ? true : t.duracion_min === tDur)
    )
    if (existe) { alert(`Ya existe una tarifa para ${tModalidad} · ${tTaller ? 'Taller grupal' : tDur + ' min'}`); return }
    const { data, error } = await supabase.from('profesor_tarifas')
      .insert({ profesor_id: prof.id, modalidad: tModalidad, duracion_min: tTaller ? null : tDur, taller_grupal: tTaller, valor: Number(tValor) })
      .select().single()
    if (error) { alert('Error: ' + error.message); return }
    if (data) { setTarifas(prev => [...prev, data]); setTValor('') }
  }

  async function borrarTarifa(id: string) {
    await supabase.from('profesor_tarifas').delete().eq('id', id)
    setTarifas(prev => prev.filter(t => t.id !== id))
  }

  async function abrirClaseModal(c: any) {
    setClaseModal(c)
    setEditHon(String(getHon(c)))
    setEditObsAdmin(c.observaciones_admin || '')
    setModalAsistentes([])
    if (c.esTaller) {
      const sesionId = c.id.replace('taller-', '')
      const { data: asis } = await supabase.from('taller_asistencias')
        .select('inscripcion_id, asistio, taller_inscripciones(clientes(nombre))')
        .eq('sesion_id', sesionId)
      const asistentes = (asis || []).filter((a: any) => a.asistio)
      setModalAsistentes(asistentes)
      const numAsistentes = asistentes.length
      let autoHon = 0
      if (numAsistentes >= 3) {
        const tarTaller = tarifas.find(x => x.modalidad === 'taller' && x.duracion_min === c.duracion_min)
        autoHon = tarTaller ? Number(tarTaller.valor) : 0
      } else {
        const tarReg = tarifas.find(x => x.modalidad === 'presencial' && x.duracion_min === c.duracion_min)
          || tarifas.find(x => !x.taller_grupal && x.duracion_min === c.duracion_min)
        autoHon = tarReg ? Number(tarReg.valor) : 0
        if (numAsistentes === 0) autoHon = 0
      }
      if (numAsistentes > 0) setEditHon(String(autoHon))
    }
  }

  async function guardarClaseModal() {
    if (!claseModal) return
    setGuardandoH(true)
    const update: any = { observaciones_admin: editObsAdmin || null }
    if (claseModal.estado === 'dada' || claseModal.cancelado_tarde) {
      update.honorario_valor = Number(editHon)
    }
    if (claseModal.esTaller) {
      const sesionId = claseModal.id.replace('taller-', '')
      await supabase.from('taller_sesiones').update({
        honorario_valor: Number(editHon), observaciones_admin: editObsAdmin || null
      }).eq('id', sesionId)
      setClases(prev => prev.map(c => c.id === claseModal.id
        ? { ...c, honorario_valor: Number(editHon), observaciones_admin: editObsAdmin || null } : c))
      setClaseModal(null); setGuardandoH(false); return
    }
    auditar('editar_honorario', 'clases', claseModal.id, { honorario_valor: Number(editHon), obs_admin: editObsAdmin })
    await supabase.from('clases').update(update).eq('id', claseModal.id)
    setClases(prev => prev.map(c => c.id === claseModal.id ? { ...c, ...update } : c))
    setClaseModal(null)
    setGuardandoH(false)
  }

  async function toggleCanceladaTarde(claseId: string, valor: boolean) {
    await supabase.from('clases').update({ cancelado_tarde: valor }).eq('id', claseId)
    setClases(prev => prev.map(c => c.id === claseId ? { ...c, cancelado_tarde: valor } : c))
    setClaseModal((prev: any) => prev ? { ...prev, cancelado_tarde: valor } : prev)
  }

  function getHon(c: any) {
  if (c.honorario_valor !== null && c.honorario_valor !== undefined) return Number(c.honorario_valor)
  if (c.esTaller) return 0
  const modalidad = (c.modalidad || 'presencial').toLowerCase()
  const exacta = tarifas.find(x => !x.taller_grupal && x.duracion_min === c.duracion_min && x.modalidad === modalidad)
  if (exacta) return exacta.valor || 0
  const cualquiera = tarifas.find(x => !x.taller_grupal && x.duracion_min === c.duracion_min)
  return cualquiera?.valor || 0
}

  const clasesFiltradas = filtroVista === 'programadas'
    ? clases.filter(c => c.estado === 'programada' || c.estado === 'confirmada')
    : clases.filter(c => c.estado === 'dada' || c.estado === 'cancelada')
const dadas = clases.filter(c => c.estado === 'dada')
 const canceladasTarde = clases.filter(c => c.estado === 'cancelada' && (c.cancelado_tarde || (!c.cancelado_por_academia && c.honorario_valor !== null && c.honorario_valor !== undefined)))
  const totalHon = [...dadas, ...canceladasTarde].reduce((s, c) => s + getHon(c), 0)
  const cnt = {
    programada: clases.filter(c => c.estado === 'programada').length,
    confirmada: clases.filter(c => c.estado === 'confirmada').length,
    dada: clases.filter(c => c.estado === 'dada').length,
    cancelada: clases.filter(c => c.estado === 'cancelada').length,
  }

  return (
    <div style={{ padding: '20px 24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

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

      {/* ── LISTA ── */}
      {modo === 'lista' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {cargando && <p style={{ textAlign: 'center', color: '#666' }}>Cargando...</p>}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: TEAL_LIGHT }}>
                <tr>{['#', 'Nombre', 'Ciudad', 'Teléfono', 'Correo', 'Estado'].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
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

      {/* ── NUEVO ── */}
      {modo === 'nuevo' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <button onClick={() => setModo('lista')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '16px', padding: 0, fontWeight: '500' }}>← Volver</button>
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', maxWidth: '700px' }}>
            <div style={{ background: TEAL, padding: '20px 28px' }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>Nuevo profesor</h3>
            </div>
            <div style={{ padding: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lS}>Nombre completo *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={fS} />
              </div>
              <div><label style={lS}>Teléfono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={fS} /></div>
              <div><label style={lS}>Ciudad (sede)</label><input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} style={fS} placeholder="Ej: Tunja" /></div>
              <div><label style={lS}>Cédula</label><input value={form.cc} onChange={e => setForm({ ...form, cc: e.target.value })} style={fS} placeholder="Ej: 7.181.939" /></div>
              <div><label style={lS}>Ciudad de expedición CC</label><input value={form.ciudad_cc} onChange={e => setForm({ ...form, ciudad_cc: e.target.value })} style={fS} placeholder="Ej: Bogotá" /></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <div><label style={lS}>Banco</label><input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} style={fS} placeholder="Ej: BANCOLOMBIA" /></div>
                <div><label style={lS}>Tipo de cuenta</label>
                  <select value={form.tipo_cuenta} onChange={e => setForm({ ...form, tipo_cuenta: e.target.value })} style={fS}>
                    <option value="Ahorros">Ahorros</option><option value="Corriente">Corriente</option>
                    <option value="Nequi">Nequi</option><option value="Daviplata">Daviplata</option>
                  </select>
                </div>
              </div>
              <div><label style={lS}>Número de cuenta</label><input value={form.numero_cuenta} onChange={e => setForm({ ...form, numero_cuenta: e.target.value })} style={fS} placeholder="Ej: 258-901663-45" /></div>
              <div>
                <label style={lS}>Estado</label>
                <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm({ ...form, activo: e.target.value === 'activo' })}
                  style={{ ...fS, background: form.activo ? '#dcfce7' : '#fee2e2', color: form.activo ? '#166534' : '#991b1b', fontWeight: '600' }}>
                  <option value="activo">Activo</option><option value="inactivo">Inactivo</option>
                </select>
              </div>
              {errForm && <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: '13px', margin: 0 }}>{errForm}</p>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={guardar} disabled={guardando} style={{ padding: '11px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setModo('lista')} style={{ padding: '11px 28px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VER PROFESOR ── */}
      {modo === 'ver' && prof && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <button onClick={() => { setProf(null); setModo('lista') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '16px', padding: 0, fontWeight: '500' }}>
            ← Volver a la lista
          </button>

          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '20px' }}>
            <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '700', color: 'white' }}>
                  {prof.nombre?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '19px' }}>{prof.nombre}</h3>
                  <p style={{ margin: '3px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                    {prof.ciudad || '—'} · {prof.telefono || '—'} · {prof.email || '—'}
                  </p>
                </div>
              </div>
              {!editando
                ? <button onClick={() => setEditando(true)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px' }}>✏️ Editar</button>
                : <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={guardar} disabled={guardando} style={{ background: 'rgba(255,255,255,0.9)', border: 'none', color: TEAL, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      {guardando ? '...' : '✓ Guardar'}
                    </button>
                    <button onClick={() => { setForm({ nombre: prof.nombre, telefono: prof.telefono || '', email: prof.email || '', ciudad: prof.ciudad || 'Bogotá', ciudad_cc: prof.ciudad_cc || 'Bogotá', activo: prof.activo !== false, cc: prof.cc || '', banco: prof.banco || '', tipo_cuenta: prof.tipo_cuenta || 'Ahorros', numero_cuenta: prof.numero_cuenta || '' }); setEditando(false) }}
                      style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                  </div>
              }
            </div>

            {editando && (
              <div style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
                <div><label style={lS}>Nombre *</label><input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} style={fS} /></div>
                <div><label style={lS}>Teléfono</label><input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} style={fS} /></div>
                <div><label style={lS}>Ciudad (sede)</label><input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} style={fS} placeholder="Ej: Tunja" /></div>
                <div><label style={lS}>Cédula</label><input value={form.cc} onChange={e => setForm({ ...form, cc: e.target.value })} style={fS} placeholder="Ej: 79838241" /></div>
                <div><label style={lS}>Ciudad expedición CC</label><input value={form.ciudad_cc} onChange={e => setForm({ ...form, ciudad_cc: e.target.value })} style={fS} placeholder="Ej: Bogotá" /></div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  <div><label style={lS}>Banco</label><input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} style={fS} placeholder="Ej: BANCOLOMBIA" /></div>
                  <div><label style={lS}>Tipo de cuenta</label>
                    <select value={form.tipo_cuenta} onChange={e => setForm({ ...form, tipo_cuenta: e.target.value })} style={fS}>
                      <option value="Ahorros">Ahorros</option><option value="Corriente">Corriente</option>
                      <option value="Nequi">Nequi</option><option value="Daviplata">Daviplata</option>
                    </select>
                  </div>
                </div>
                <div><label style={lS}>Número de cuenta</label><input value={form.numero_cuenta} onChange={e => setForm({ ...form, numero_cuenta: e.target.value })} style={fS} placeholder="Ej: 258-901663-45" /></div>
                <div>
                  <label style={lS}>Estado</label>
                  <select value={form.activo ? 'activo' : 'inactivo'} onChange={e => setForm({ ...form, activo: e.target.value === 'activo' })}
                    style={{ ...fS, background: form.activo ? '#dcfce7' : '#fee2e2', color: form.activo ? '#166534' : '#991b1b', fontWeight: '600' }}>
                    <option value="activo">Activo</option><option value="inactivo">Inactivo</option>
                  </select>
                </div>
                {errForm && <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontSize: '13px', margin: 0 }}>{errForm}</p>}
              </div>
            )}
          </div>

          {/* Acceso app */}
          {!editando && (
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ background: TEAL_LIGHT, padding: '12px 18px', borderBottom: '1px solid #eef2f7', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: TEAL }}>📱 Acceso a la app</p>
                {tieneAcceso === true && <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#166534' }}>✓ Activo</span>}
                {tieneAcceso === false && <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: '#fee2e2', color: '#991b1b' }}>Sin acceso</span>}
              </div>
              <div style={{ padding: '16px 18px' }}>
                {tieneAcceso === true
                  ? <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>Este profesor ya tiene acceso a la app con el correo <strong>{prof.email}</strong>.</p>
                  : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end', maxWidth: '600px' }}>
                      <div>
                        <label style={lS}>Correo</label>
                        <input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} style={fS} placeholder="correo@ejemplo.com" />
                      </div>
                      <div>
                        <label style={lS}>Contraseña</label>
                        <input type="password" value={nuevaPassword} onChange={e => setNuevaPassword(e.target.value)} style={fS} placeholder="Mínimo 6 caracteres" />
                      </div>
                      <button onClick={crearAcceso} disabled={creandoAcceso}
                        style={{ padding: '9px 18px', background: creandoAcceso ? '#cbd5e1' : TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: creandoAcceso ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {creandoAcceso ? 'Creando...' : '+ Crear acceso'}
                      </button>
                    </div>
                  )
                }
                {errAcceso && <p style={{ margin: '10px 0 0', color: '#dc2626', fontSize: '13px' }}>⚠ {errAcceso}</p>}
                {okAcceso && <p style={{ margin: '10px 0 0', color: '#166534', fontSize: '13px', fontWeight: '600' }}>{okAcceso}</p>}
              </div>
            </div>
          )}

          {/* Disponibilidad y Tarifas */}
          {editando && (
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
                      <button onClick={() => borrarDisp(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>x</button>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '10px', alignItems: 'end' }}>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Día</label>
                      <select value={nDia} onChange={e => setNDia(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {DIAS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Desde</label>
                      <select value={nHI} onChange={e => setNHI(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Hasta</label>
                      <select value={nHF} onChange={e => setNHF(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={agregarDisp} style={{ padding: '6px 10px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* Tarifas */}
              <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
                <div style={{ background: TEAL_LIGHT, padding: '12px 18px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: TEAL }}>Tarifas de honorarios</p>
                  <button onClick={() => { setMostrarCopiar(!mostrarCopiar); setProfCopiar('') }}
                    style={{ padding: '4px 12px', background: mostrarCopiar ? '#e2e8f0' : 'white', border: `1px solid ${TEAL_MID}`, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: TEAL, fontWeight: '600' }}>
                    📋 Copiar de otro
                  </button>
                </div>
                {mostrarCopiar && (
                  <div style={{ padding: '10px 18px', background: '#f8fafc', borderBottom: '1px solid #eef2f7', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select value={profCopiar} onChange={e => setProfCopiar(e.target.value)}
                      style={{ ...fS, fontSize: '12px', padding: '6px 8px', flex: 1 }}>
                      <option value="">— Seleccionar profesor —</option>
                      {profesores.filter(p => p.id !== prof?.id).map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                    <button onClick={copiarTarifas} disabled={copiando || !profCopiar}
                      style={{ padding: '6px 14px', background: profCopiar ? TEAL : '#cbd5e1', color: 'white', border: 'none', borderRadius: '6px', cursor: profCopiar ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      {copiando ? 'Copiando...' : 'Aplicar'}
                    </button>
                    <button onClick={() => { setMostrarCopiar(false); setProfCopiar('') }}
                      style={{ padding: '6px 10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#666' }}>
                      ✕
                    </button>
                  </div>
                )}
                <div style={{ padding: '14px 18px' }}>
                  {tarifas.length === 0 && <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 10px' }}>Sin tarifas registradas</p>}
                  {tarifas.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#fafbfc', borderRadius: '8px', marginBottom: '5px', border: '1px solid #f1f5f9' }}>
                      <span style={{ fontSize: '13px', color: '#333', textTransform: 'capitalize' }}>{t.modalidad} · {t.taller_grupal ? 'Taller grupal' : `${t.duracion_min} min`}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: TEAL }}>${Number(t.valor).toLocaleString()}</span>
                        <button onClick={() => borrarTarifa(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: '16px' }}>x</button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '10px', alignItems: 'end' }}>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Modalidad</label>
                      <select value={tModalidad} onChange={e => setTModalidad(e.target.value)} style={{ ...fS, fontSize: '12px', padding: '6px 8px', textTransform: 'capitalize' }}>
                        {MODALIDADES.map(m => <option key={m} value={m} style={{ textTransform: 'capitalize' }}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Tipo</label>
                      <select value={tTaller ? 'taller' : String(tDur)}
                        onChange={e => { const v = e.target.value; setTTaller(v === 'taller'); setTDur(v === 'taller' ? 60 : Number(v)) }}
                        style={{ ...fS, fontSize: '12px', padding: '6px 8px' }}>
                        {DURACIONES.map(d => <option key={d} value={d}>{d} min</option>)}
                        <option value="taller">Taller grupal</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lS, fontSize: '11px' }}>Valor ($)</label>
                      <input type="number" value={tValor} onChange={e => setTValor(e.target.value)} placeholder="0" style={{ ...fS, fontSize: '12px', padding: '6px 8px' }} />
                    </div>
                    <button type="button" onClick={agregarTarifa} style={{ padding: '6px 10px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      + Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Clases del mes */}
          {!editando && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#1a1a1a' }}>Clases del mes</h3>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
                    {([
                      { key: 'historial', label: '📋 Historial' },
                      { key: 'programadas', label: '📅 Programadas' },
                    ] as const).map(op => (
                      <button key={op.key} onClick={() => setFiltroVista(op.key)}
                        style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                          background: filtroVista === op.key ? 'white' : 'transparent',
                          color: filtroVista === op.key ? TEAL : '#666',
                          boxShadow: filtroVista === op.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="month" value={mes} onChange={e => setMes(e.target.value)}
                  style={{ padding: '6px 10px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[
                  { label: 'Programadas', count: cnt.programada, bg: '#eff6ff', color: '#1d4ed8' },
                  { label: 'Confirmadas', count: cnt.confirmada, bg: '#dcfce7', color: '#166534' },
                  { label: 'Dadas', count: cnt.dada, bg: '#fefce8', color: '#854d0e' },
                  { label: 'Canceladas', count: cnt.cancelada, bg: '#fee2e2', color: '#991b1b' },
                ].map(c => (
                  <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}33`, borderRadius: '10px', padding: '10px 18px', textAlign: 'center', minWidth: '100px' }}>
                    <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: c.color }}>{c.count}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: c.color }}>{c.label}</p>
                  </div>
                ))}
                <div style={{ marginLeft: 'auto', background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '10px', padding: '10px 18px', textAlign: 'center', minWidth: '160px' }}>
                  <p style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: TEAL }}>${totalHon.toLocaleString()}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: TEAL }}>
                    Honorarios ({dadas.length} dadas{canceladasTarde.length > 0 ? ` + ${canceladasTarde.length} tarde` : ''})
                  </p>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: TEAL_LIGHT }}>
                    <tr>{['Fecha', 'Hora', 'Cliente / Taller', 'Duración', 'Sede', 'Estado', 'Honorarios', 'Resumen', ''].map(h => (
                        <th key={h} style={{ ...thS, textAlign: h === 'Cliente / Taller' ? 'center' : 'left' }}>{h}</th>
                      ))}</tr>
                  </thead>
                  <tbody>
                    {clasesFiltradas.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#aaa' }}>
                        {filtroVista === 'programadas' ? 'Sin clases programadas este mes' : 'Sin clases en el historial de este mes'}
                      </td></tr>
                    )}
                    {clasesFiltradas.map((c, i) => {
                      const esTarde = c.cancelado_tarde
                      const col = colEstado(c.estado, esTarde)
                      const hon = getHon(c)
                      const pagarHon = c.estado === 'dada' || esTarde
                      return (
                        <tr key={c.id} style={{ borderTop: '1px solid #f8fafc', background: (c.estado === 'cancelada' && !c.cancelado_por_academia) ? '#fff7ed' : i % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td style={tdS}>{c.fecha}</td>
                          <td style={tdS}>{c.hora?.substring(0, 5) || '—'}</td>
                          <td style={{ ...tdS, fontWeight: '500', textAlign: 'center' }}>
                            {c.esTaller
                              ? <span style={{ color: '#7c3aed', fontWeight: '600' }}>🎸 {c.nombreTaller || '—'}</span>
                              : <>
                                  {c.contratos?.clientes?.nombre || '—'}
                                  {!c.es_cortesia && c.numero_calculado && c.contratos?.total_clases && (
                                    <span style={{ marginLeft: '6px', fontSize: '11px', color: TEAL, fontWeight: '700' }}>
                                      ({c.numero_calculado}/{c.contratos.total_clases})
                                    </span>
                                  )}
                                  {(c.estado === 'cancelada' && !c.cancelado_por_academia) && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#fff7ed', color: '#c2410c', padding: '1px 6px', borderRadius: '10px' }}>Inasistencia</span>}
                                </>
                            }
                          </td>
                          <td style={{ ...tdS, textAlign: 'center' }}>{c.duracion_min} min</td>
                          <td style={tdS}>{c.salones?.sedes?.nombre || '—'}</td>
                          <td style={tdS}>
                            <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: col.bg, color: col.color, whiteSpace: 'nowrap' }}>
                              {esTarde ? '⚠️ Cancelada (tarde)' : c.estado}
                            </span>
                          </td>
                          <td style={{ ...tdS, fontWeight: '600', color: (pagarHon || c.honorario_valor) ? TEAL : '#aaa' }}>
                            {(pagarHon || c.honorario_valor !== null) ? `$${hon.toLocaleString()}` : '—'}
                            {c.honorario_valor !== null && c.honorario_valor !== undefined && !c.esTaller && <span style={{ fontSize: '10px', color: '#f59e0b', marginLeft: '4px' }}>editado</span>}
                          </td>
                          <td style={{ ...tdS, textAlign: 'center' }}>
                            {c.observaciones ? <span title="Resumen registrado" style={{ fontSize: '14px', cursor: 'default' }}>📝</span> : null}
                          </td>
                          <td style={{ ...tdS, textAlign: 'center' }}>
                            <button onClick={() => abrirClaseModal(c)}
                              style={{ background: 'none', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '11px',
                                border: c.observaciones_admin ? '1.5px solid #dc2626' : `1px solid ${TEAL_MID}`,
                                color: c.observaciones_admin ? '#dc2626' : TEAL,
                                fontWeight: c.observaciones_admin ? '600' : '400' }}>
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
        </div>
      )}

      {/* ── MODAL DETALLE DE CLASE ── */}
      {claseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '520px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
            <div style={{ background: TEAL, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>{claseModal.esTaller ? '🎸 Sesión de taller' : 'Detalle de la clase'}</h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  {claseModal.esTaller ? claseModal.nombreTaller : claseModal.contratos?.clientes?.nombre} · {claseModal.fecha} {claseModal.hora?.substring(0, 5)}
                </p>
              </div>
              <button onClick={() => setClaseModal(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 11px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '20px 28px' }}>
              <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                <div><span style={{ color: '#999' }}>Instrumento: </span><strong>{claseModal.contratos?.instrumentos?.nombre || '—'}</strong></div>
                <div><span style={{ color: '#999' }}>Duración: </span><strong>{claseModal.duracion_min} min</strong></div>
                <div><span style={{ color: '#999' }}>Sede: </span><strong>{claseModal.salones?.sedes?.nombre || '—'}</strong></div>
                <div>
                  <span style={{ color: '#999' }}>Estado: </span>
                  <span style={{ padding: '1px 8px', borderRadius: '10px', fontWeight: '600', fontSize: '12px',
                    background: colEstado(claseModal.estado, claseModal.cancelado_tarde).bg,
                    color: colEstado(claseModal.estado, claseModal.cancelado_tarde).color }}>
                    {claseModal.cancelado_tarde ? '⚠️ Cancelada fuera de tiempo' : claseModal.estado}
                  </span>
                </div>
              </div>

              {claseModal.esTaller && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#333' }}>
                    Asistentes ({modalAsistentes.length})
                    <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '600', padding: '1px 8px', borderRadius: '10px',
                      background: modalAsistentes.length >= 3 ? '#f3e8ff' : '#eff6ff',
                      color: modalAsistentes.length >= 3 ? '#7c3aed' : '#1d4ed8' }}>
                      {modalAsistentes.length >= 3 ? 'Tarifa taller' : modalAsistentes.length > 0 ? 'Tarifa regular' : 'Sin asistentes'}
                    </span>
                  </p>
                  {modalAsistentes.length === 0
                    ? <p style={{ fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>Ningún inscrito asistió</p>
                    : modalAsistentes.map((a: any, i) => (
                        <div key={i} style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '4px', fontSize: '13px', color: '#333' }}>
                          ✓ {a.taller_inscripciones?.clientes?.nombre || '—'}
                        </div>
                      ))
                  }
                </div>
              )}

              {claseModal.estado === 'cancelada' && !claseModal.cancelado_por_academia && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: '#c2410c' }}>
                  El estudiante no asistió — pendiente de revisión
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#333' }}>
                  Resumen de la clase
                  {claseModal.estado === 'dada' && !claseModal.observaciones && (
                    <span style={{ marginLeft: '8px', fontSize: '11px', color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: '10px', fontWeight: '600' }}>⚠️ Requerido para pago</span>
                  )}
                </p>
                {claseModal.observaciones
                  ? <div style={{ background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {claseModal.observaciones}
                    </div>
                  : <p style={{ color: '#aaa', fontSize: '13px', margin: 0, fontStyle: 'italic', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Sin resumen registrado</p>
                }
              </div>

              {(claseModal.estado === 'dada' || claseModal.cancelado_tarde) && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#333' }}>Honorarios ($)</p>
                  <input type="number" value={editHon} onChange={e => setEditHon(e.target.value)} style={fS} />
                  <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#aaa' }}>El valor editado reemplaza al calculado por tarifa</p>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#333' }}>Observaciones administrativas</p>
                <textarea value={editObsAdmin} onChange={e => setEditObsAdmin(e.target.value)}
                  placeholder="Notas internas de la asistente u otro administrativo..."
                  rows={3} style={{ ...fS, resize: 'vertical', lineHeight: '1.5', fontFamily: 'inherit' }} />
              </div>

              <button onClick={guardarClaseModal} disabled={guardandoH}
                style={{ width: '100%', padding: '11px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }}>
                {guardandoH ? 'Guardando...' : '✓ Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
