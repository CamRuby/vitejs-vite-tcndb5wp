import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

interface PlanActivo {
  id: string; cliente_id: string; cliente_nombre: string; grupo_whatsapp: string | null
  sede_id: string | null; sede_nombre: string; instrumento_id: string | null
  instrumento_nombre: string; total_clases: number; duracion_min: number
  clases_tomadas: number; conteo_whatsapp: number | null; diferencia: number
}
interface Instrumento { id: string; nombre: string }
interface Sede { id: string; nombre: string }
type CampoTexto = 'grupo_whatsapp'
type CampoNumero = 'total_clases' | 'duracion_min' | 'conteo_whatsapp'
interface Edicion {
  instrumento_id?: string; sede_id?: string; grupo_whatsapp?: string
  total_clases?: number; duracion_min?: number; conteo_whatsapp?: number | null
}
interface ClaseDada {
  id: string; fecha: string; hora: string; duracion_min: number; estado: string
  cancelado_por_academia: boolean | null; es_cortesia: boolean
  numero_calculado: number | null; honorario_valor: number | null
  contrato_id: string; contrato_estado: string; cliente_id: string
  cliente_nombre: string; sede_nombre: string; salon_nombre: string
  salon_id: string; sede_id: string; profesor_id: string; profesor_nombre: string
  total_clases: number; modalidad: string
}

const REPORTES = [
  { id: 'clases_tomadas_por_plan', icono: '📋', titulo: 'Número de clases tomadas por plan', descripcion: 'Planes activos con verificación de conteo WhatsApp por sede' },
  { id: 'clases_dadas_rango', icono: '📊', titulo: 'Clases tomadas por rango de tiempo', descripcion: 'Historial de clases dadas, inasistencias y canceladas con totales y filtros' },
]

export default function Reportes({ rol }: { rol?: string }) {
  const [reporteActivo, setReporteActivo] = useState<string | null>(null)
  if (reporteActivo === 'clases_tomadas_por_plan') return <ReporteClasesTomadasPorPlan onVolver={() => setReporteActivo(null)} rol={rol} />
  if (reporteActivo === 'clases_dadas_rango') return <ReporteClasesDadasRango onVolver={() => setReporteActivo(null)} rol={rol} />
  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: TEAL_DARK, marginBottom: '8px' }}>Reportes</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>Selecciona un reporte para visualizarlo.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {REPORTES.map(r => (
          <button key={r.id} onClick={() => setReporteActivo(r.id)}
            style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '12px', padding: '24px 20px', textAlign: 'left', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(26,138,138,0.15)'; (e.currentTarget as HTMLButtonElement).style.borderColor = TEAL }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = TEAL_MID }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{r.icono}</div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: TEAL_DARK, marginBottom: '6px' }}>{r.titulo}</div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>{r.descripcion}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── REPORTE 1 ────────────────────────────────────────────────────────────────
function ReporteClasesTomadasPorPlan({ onVolver, rol }: { onVolver: () => void; rol?: string }) {
  const [datos, setDatos] = useState<PlanActivo[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [sedesDisponibles, setSedesDisponibles] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'al_dia' | 'pendiente'>('todos')
  const [sedeFiltro, setSedeFiltro] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [editados, setEditados] = useState<Record<string, Edicion>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)
  const esAdmin = rol === 'superadmin'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true); setError(null)
    try {
      const [{ data, error: err }, { data: instr }, { data: sedesData }] = await Promise.all([
        supabase.from('contratos').select(`id, cliente_id, sede_id, instrumento_id, total_clases, duracion_min, clases_tomadas, conteo_whatsapp, clientes ( nombres, apellidos, grupo_whatsapp ), sedes ( nombre ), instrumentos ( id, nombre )`).eq('estado', 'activo'),
        supabase.from('instrumentos').select('id, nombre').order('nombre'),
        supabase.from('sedes').select('id, nombre').order('nombre')
      ])
      if (err) throw err
      setInstrumentos(instr || []); setSedesDisponibles(sedesData || [])
      const filas: PlanActivo[] = (data || []).map((row: any) => {
        const tomadas = Number(row.clases_tomadas ?? 0)
        const whatsapp = row.conteo_whatsapp !== null ? Number(row.conteo_whatsapp) : null
        return {
          id: row.id, cliente_id: row.cliente_id,
          cliente_nombre: `${row.clientes?.nombres ?? ''} ${row.clientes?.apellidos ?? ''}`.trim(),
          grupo_whatsapp: row.clientes?.grupo_whatsapp ?? null, sede_id: row.sede_id ?? null,
          sede_nombre: row.sedes?.nombre ?? '—', instrumento_id: row.instrumento_id ?? null,
          instrumento_nombre: row.instrumentos?.nombre ?? '—',
          total_clases: Number(row.total_clases ?? 0), duracion_min: Number(row.duracion_min ?? 0),
          clases_tomadas: tomadas, conteo_whatsapp: whatsapp,
          diferencia: whatsapp !== null ? tomadas - whatsapp : tomadas,
        }
      }).sort((a, b) => a.sede_nombre.localeCompare(b.sede_nombre))
      setDatos(filas)
    } catch { setError('No se pudieron cargar los datos.') } finally { setCargando(false) }
  }

  const sedes = ['todas', ...Array.from(new Set(datos.map(d => d.sede_nombre))).sort()]
  let filtrados = datos.filter(d => {
    const q = busqueda.toLowerCase()
    if (busqueda && !d.cliente_nombre.toLowerCase().includes(q) && !d.sede_nombre.toLowerCase().includes(q) && !d.instrumento_nombre.toLowerCase().includes(q) && !(d.grupo_whatsapp ?? '').toLowerCase().includes(q)) return false
    if (sedeFiltro !== 'todas' && d.sede_nombre !== sedeFiltro) return false
    return true
  })
  if (filtro === 'al_dia') filtrados = filtrados.filter(d => d.diferencia === 0)
  else if (filtro === 'pendiente') filtrados = filtrados.filter(d => d.diferencia > 0).sort((a, b) => a.diferencia - b.diferencia)

  function getNum(plan: PlanActivo, campo: CampoNumero): number | string {
    const ed = editados[plan.id]
    if (ed && campo in ed) { const v = ed[campo]; return v === null || v === undefined ? '' : v }
    if (campo === 'conteo_whatsapp') return plan.conteo_whatsapp !== null ? plan.conteo_whatsapp : ''
    return campo === 'total_clases' ? plan.total_clases : plan.duracion_min
  }
  function getTxt(plan: PlanActivo, campo: CampoTexto): string { const ed = editados[plan.id]; return ed && campo in ed ? ed[campo] ?? '' : plan.grupo_whatsapp ?? '' }
  function getInstrumentoId(plan: PlanActivo): string { const ed = editados[plan.id]; return ed && 'instrumento_id' in ed ? ed.instrumento_id ?? '' : plan.instrumento_id ?? '' }
  function getSedeId(plan: PlanActivo): string { const ed = editados[plan.id]; return ed && 'sede_id' in ed ? ed.sede_id ?? '' : plan.sede_id ?? '' }
  function editarNum(id: string, campo: CampoNumero, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor === '' ? null : Number(valor) } })) }
  function editarTxt(id: string, campo: CampoTexto, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } })) }
  function editarSede(id: string, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], sede_id: valor } })) }
  function editarInstrumento(id: string, valor: string) { setEditados(prev => ({ ...prev, [id]: { ...prev[id], instrumento_id: valor } })) }

  async function guardarCambios() {
    setGuardando(true); setMensajeGuardado(null); let errores = 0
    for (const [id, cambios] of Object.entries(editados)) {
      const plan = datos.find(d => d.id === id); if (!plan) continue
      const updateContrato: any = {}
      if ('total_clases' in cambios && cambios.total_clases !== null) updateContrato.total_clases = cambios.total_clases
      if ('duracion_min' in cambios && cambios.duracion_min !== null) updateContrato.duracion_min = cambios.duracion_min
      if ('conteo_whatsapp' in cambios) updateContrato.conteo_whatsapp = cambios.conteo_whatsapp
      if ('instrumento_id' in cambios && cambios.instrumento_id) updateContrato.instrumento_id = cambios.instrumento_id
      if ('sede_id' in cambios && cambios.sede_id) updateContrato.sede_id = cambios.sede_id
      if (Object.keys(updateContrato).length > 0) { const { error: err } = await supabase.from('contratos').update(updateContrato).eq('id', id); if (err) errores++ }
      if ('grupo_whatsapp' in cambios) { const { error: err } = await supabase.from('clientes').update({ grupo_whatsapp: cambios.grupo_whatsapp }).eq('id', plan.cliente_id); if (err) errores++ }
    }
    setGuardando(false); setEditados({}); setModoEdicion(false)
    setMensajeGuardado(errores === 0 ? '✅ Cambios guardados.' : `⚠️ ${errores} error(es).`)
    await cargarDatos(); setTimeout(() => setMensajeGuardado(null), 4000)
  }

  const hayCambios = Object.keys(editados).length > 0
  const estiloInput = (editado: boolean) => ({ padding: '5px 8px', borderRadius: '6px', textAlign: 'center' as const, border: `1.5px solid ${editado ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', background: '#fff' })
  const estiloInputTxt = (editado: boolean) => ({ padding: '5px 8px', borderRadius: '6px', border: `1.5px solid ${editado ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', background: '#fff', width: '100%', minWidth: '120px' })
  const estiloSelect = (editado: boolean) => ({ padding: '5px 8px', borderRadius: '6px', border: `1.5px solid ${editado ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', background: '#fff', width: '100%', minWidth: '130px', cursor: 'pointer' })
  const columnas = ['#', 'Cliente', 'Grupo WA', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Clases tomadas', 'Conteo WA', 'Diferencia']
  const editables = ['Grupo WA', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Conteo WA']

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: 0, flex: 1 }}>📋 Número de clases tomadas por plan</h2>
        {esAdmin && (!modoEdicion
          ? <button onClick={() => setModoEdicion(true)} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>✏️ Modo edición</button>
          : <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEditados({}); setModoEdicion(false) }} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarCambios} disabled={!hayCambios || guardando} style={{ background: hayCambios ? TEAL : '#a0c8c8', border: 'none', borderRadius: '8px', padding: '7px 18px', cursor: hayCambios ? 'pointer' : 'not-allowed', fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                {guardando ? 'Guardando…' : `💾 Guardar${hayCambios ? ` (${Object.keys(editados).length})` : ''}`}
              </button>
            </div>
        )}
      </div>
      {mensajeGuardado && <div style={{ background: mensajeGuardado.startsWith('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${mensajeGuardado.startsWith('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: mensajeGuardado.startsWith('✅') ? '#166534' : '#92400e' }}>{mensajeGuardado}</div>}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[{ label: 'Total planes activos', valor: datos.length, color: TEAL }, { label: 'Al día', valor: datos.filter(d => d.diferencia === 0).length, color: '#16a34a' }, { label: 'Pendiente', valor: datos.filter(d => d.diferencia > 0).length, color: '#d97706' }].map(t => (
          <div key={t.label} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', padding: '14px 20px', minWidth: '140px', flex: '1' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: t.color }}>{cargando ? '…' : t.valor}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{t.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {([{ key: 'todos', label: '📋 Todos' }, { key: 'al_dia', label: '✅ Al día' }, { key: 'pendiente', label: '⏳ Pendiente' }] as const).map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)} style={{ padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', background: filtro === f.key ? TEAL : '#fff', color: filtro === f.key ? '#fff' : TEAL_DARK, border: `1.5px solid ${filtro === f.key ? TEAL : TEAL_MID}` }}>{f.label}</button>
        ))}
        <select value={sedeFiltro} onChange={e => setSedeFiltro(e.target.value)} style={{ padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, border: `1.5px solid ${sedeFiltro !== 'todas' ? TEAL : TEAL_MID}`, background: sedeFiltro !== 'todas' ? TEAL_LIGHT : '#fff', color: sedeFiltro !== 'todas' ? TEAL_DARK : '#475569', cursor: 'pointer', outline: 'none' }}>
          {sedes.map(s => <option key={s} value={s}>{s === 'todas' ? '🏢 Todas las sedes' : `🏢 ${s}`}</option>)}
        </select>
        <input type="text" placeholder="Buscar cliente, instrumento, grupo…" value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: '20px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none', width: '240px', color: '#333' }} />
      </div>
      {cargando && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando datos…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}
      {!cargando && !error && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1.5px solid ${TEAL_MID}`, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: TEAL, color: '#fff' }}>
              {columnas.map((h, i) => <th key={i} style={{ padding: '11px 14px', fontWeight: 700, textAlign: i === 0 || i >= 5 ? 'center' : 'left', whiteSpace: 'nowrap', fontSize: '12px' }}>{h}{modoEdicion && editables.includes(h) ? ' ✏️' : ''}</th>)}
            </tr></thead>
            <tbody>
              {filtrados.length === 0
                ? <tr><td colSpan={columnas.length} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No hay planes.</td></tr>
                : filtrados.map((plan, idx) => {
                  const ed = editados[plan.id] ?? {}
                  const waActual = 'conteo_whatsapp' in ed ? ed.conteo_whatsapp : plan.conteo_whatsapp
                  const diff = waActual !== null && waActual !== undefined ? plan.clases_tomadas - (waActual as number) : plan.clases_tomadas
                  const diffColor = diff === 0 ? '#16a34a' : diff <= 2 ? '#d97706' : '#dc2626'
                  const diffBg = diff === 0 ? '#f0fdf4' : diff <= 2 ? '#fffbeb' : '#fef2f2'
                  return (
                    <tr key={plan.id} style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: Object.keys(ed).length > 0 ? '#fffde7' : idx % 2 === 0 ? '#fff' : '#fafefe' }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{plan.cliente_nombre}</td>
                      <td style={{ padding: '6px 14px', minWidth: '130px' }}>{modoEdicion ? <input type="text" value={getTxt(plan, 'grupo_whatsapp')} onChange={e => editarTxt(plan.id, 'grupo_whatsapp', e.target.value)} placeholder="Sin grupo" style={estiloInputTxt('grupo_whatsapp' in ed)} /> : <span style={{ color: plan.grupo_whatsapp ? '#334155' : '#ccc' }}>{plan.grupo_whatsapp || '—'}</span>}</td>
                      <td style={{ padding: '6px 14px', minWidth: '130px' }}>{modoEdicion ? <select value={getSedeId(plan)} onChange={e => editarSede(plan.id, e.target.value)} style={estiloSelect('sede_id' in ed)}><option value="">— Sin sede —</option>{sedesDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select> : <span style={{ color: '#475569' }}>{plan.sede_nombre}</span>}</td>
                      <td style={{ padding: '6px 14px', minWidth: '140px' }}>{modoEdicion ? <select value={getInstrumentoId(plan)} onChange={e => editarInstrumento(plan.id, e.target.value)} style={estiloSelect('instrumento_id' in ed)}><option value="">— Sin instrumento —</option>{instrumentos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}</select> : <span style={{ color: '#475569' }}>{plan.instrumento_nombre}</span>}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>{modoEdicion ? <input type="number" value={getNum(plan, 'total_clases')} onChange={e => editarNum(plan.id, 'total_clases', e.target.value)} style={{ ...estiloInput('total_clases' in ed), width: '64px' }} /> : <span style={{ color: '#334155', fontWeight: 600 }}>{plan.total_clases}</span>}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>{modoEdicion ? <input type="number" value={getNum(plan, 'duracion_min')} onChange={e => editarNum(plan.id, 'duracion_min', e.target.value)} style={{ ...estiloInput('duracion_min' in ed), width: '64px' }} /> : <span style={{ color: '#334155' }}>{plan.duracion_min} min</span>}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>{plan.clases_tomadas}</td>
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>{modoEdicion ? <input type="number" value={getNum(plan, 'conteo_whatsapp')} onChange={e => editarNum(plan.id, 'conteo_whatsapp', e.target.value)} placeholder="—" style={{ ...estiloInput('conteo_whatsapp' in ed), width: '64px' }} /> : plan.conteo_whatsapp !== null ? <span style={{ color: '#334155' }}>{plan.conteo_whatsapp}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}><span style={{ background: diffBg, color: diffColor, borderRadius: '20px', padding: '3px 12px', fontWeight: 700, fontSize: '13px', display: 'inline-block' }}>{diff === 0 ? '✓ 0' : `+${diff}`}</span></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
      {!cargando && !error && filtrados.length > 0 && <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'right' }}>Mostrando {filtrados.length} de {datos.length} planes</div>}
    </div>
  )
}

// ─── REPORTE 2 ────────────────────────────────────────────────────────────────
function ReporteClasesDadasRango({ onVolver, rol }: { onVolver: () => void; rol?: string }) {
  const hoy = new Date()
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const ultimoDiaMesStr = `${ultimoDiaMes.getFullYear()}-${String(ultimoDiaMes.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaMes.getDate()).padStart(2, '0')}`

  const [datos, setDatos] = useState<ClaseDada[]>([])
  const [sedesDisp, setSedesDisp] = useState<Sede[]>([])
  const [tarifas, setTarifas] = useState<any[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes)
  const [fechaFin, setFechaFin] = useState(ultimoDiaMesStr)
  const [filtroPro, setFiltroPro] = useState('todos')
  const [filtroSede, setFiltroSede] = useState('todas')
  const [filtroSalon, setFiltroSalon] = useState('todos')
  const [filtroEstadoContrato, setFiltroEstadoContrato] = useState<'todos' | 'activo' | 'archivado'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'dada' | 'inasistencia' | 'cancelada'>('todos')
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [edits, setEdits] = useState<Record<string, { duracion?: string; sede_id?: string }>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null)
  const [confirmarMover, setConfirmarMover] = useState<string | null>(null)
  const esAdmin = rol === 'superadmin'

  useEffect(() => { cargarSedes(); cargarTarifas() }, [])
  useEffect(() => { cargarDatos() }, [fechaInicio, fechaFin])

  async function cargarSedes() {
    const { data } = await supabase.from('sedes').select('id, nombre').order('nombre')
    setSedesDisp(data || [])
  }

  async function cargarTarifas() {
    const { data } = await supabase.from('profesor_tarifas').select('profesor_id, modalidad, duracion_min, valor').eq('taller_grupal', false)
    setTarifas(data || [])
  }

  function calcularHonorario(clase: ClaseDada): number | null {
    if (clase.estado !== 'dada') return clase.honorario_valor
    const modalidad = (clase.modalidad || 'presencial').toLowerCase()
    const duracion = clase.duracion_min
    let tarifa = tarifas.find(t => t.profesor_id === clase.profesor_id && t.modalidad?.toLowerCase() === modalidad && Number(t.duracion_min) === duracion)
    if (!tarifa) tarifa = tarifas.find(t => t.profesor_id === clase.profesor_id && Number(t.duracion_min) === duracion)
    return tarifa ? Number(tarifa.valor) : null
  }

  async function cargarDatos() {
    setCargando(true); setError(null)
    try {
      const select = `id, fecha, hora, duracion_min, estado, cancelado_por_academia, es_cortesia, numero_calculado, honorario_valor, contrato_id, modalidad, contratos ( id, estado, cliente_id, total_clases, clientes ( nombres, apellidos ) ), profesores ( id, nombre ), salones ( id, nombre, sede_id, sedes ( nombre ) )`
      const [{ data: dadas, error: e1 }, { data: inasistencias, error: e2 }, { data: canceladas, error: e3 }] = await Promise.all([
        supabase.from('clases_con_numero').select(select).gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'dada').order('fecha', { ascending: false }).order('hora', { ascending: false }),
        supabase.from('clases_con_numero').select(select).gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'cancelada').eq('cancelado_por_academia', false).order('fecha', { ascending: false }).order('hora', { ascending: false }),
        supabase.from('clases_con_numero').select(select).gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'cancelada').eq('cancelado_por_academia', true).order('fecha', { ascending: false }).order('hora', { ascending: false }),
      ])
      if (e1 || e2 || e3) throw e1 || e2 || e3
      const raw = [...(dadas || []), ...(inasistencias || []), ...(canceladas || [])].sort((a: any, b: any) => b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || ''))
      const filas: ClaseDada[] = raw.filter((r: any) => !r.es_cortesia).map((r: any) => ({
        id: r.id, fecha: r.fecha, hora: r.hora?.substring(0, 5) || '—',
        duracion_min: Number(r.duracion_min || 0), estado: r.estado,
        cancelado_por_academia: r.cancelado_por_academia, es_cortesia: r.es_cortesia,
        numero_calculado: r.numero_calculado,
        honorario_valor: r.honorario_valor !== null ? Number(r.honorario_valor) : null,
        contrato_id: r.contrato_id, contrato_estado: r.contratos?.estado || '—',
        cliente_id: r.contratos?.cliente_id || '',
        cliente_nombre: `${r.contratos?.clientes?.nombres ?? ''} ${r.contratos?.clientes?.apellidos ?? ''}`.trim(),
        sede_nombre: r.salones?.sedes?.nombre || '—', salon_nombre: r.salones?.nombre || '—',
        salon_id: r.salones?.id || '', sede_id: r.salones?.sede_id || '',
        profesor_id: r.profesores?.id || '', profesor_nombre: r.profesores?.nombre || '—',
        total_clases: Number(r.contratos?.total_clases || 0), modalidad: r.modalidad || 'presencial',
      }))
      setDatos(filas)
    } catch { setError('No se pudieron cargar los datos.') } finally { setCargando(false) }
  }

  const profesores = ['todos', ...Array.from(new Set(datos.map(d => d.profesor_nombre))).sort()]
  const sedes = ['todas', ...Array.from(new Set(datos.map(d => d.sede_nombre))).sort()]
  const salonesDisp = ['todos', ...Array.from(new Set(datos.filter(d => filtroSede === 'todas' || d.sede_nombre === filtroSede).map(d => d.salon_nombre))).sort()]

  const filtrados = datos.filter(d => {
    const esInasistencia = d.estado === 'cancelada' && !d.cancelado_por_academia
    const esCancelada = d.estado === 'cancelada' && d.cancelado_por_academia
    if (filtroPro !== 'todos' && d.profesor_nombre !== filtroPro) return false
    if (filtroSede !== 'todas' && d.sede_nombre !== filtroSede) return false
    if (filtroSalon !== 'todos' && d.salon_nombre !== filtroSalon) return false
    if (filtroEstadoContrato !== 'todos' && d.contrato_estado !== filtroEstadoContrato) return false
    if (filtroTipo === 'dada' && d.estado !== 'dada') return false
    if (filtroTipo === 'inasistencia' && !esInasistencia) return false
    if (filtroTipo === 'cancelada' && !esCancelada) return false
    if (busquedaCliente && !d.cliente_nombre.toLowerCase().includes(busquedaCliente.toLowerCase())) return false
    return true
  })

  const totalClases = filtrados.filter(d => d.estado === 'dada').length
  const totalMinutos = filtrados.filter(d => d.estado === 'dada').reduce((s, d) => s + d.duracion_min, 0)
  const totalHoras = Math.floor(totalMinutos / 60)
  const minResto = totalMinutos % 60
  const totalHonorarios = filtrados.reduce((s, d) => { const h = calcularHonorario(d); return s + (h || 0) }, 0)
  const totalInasistencias = filtrados.filter(d => d.estado === 'cancelada' && !d.cancelado_por_academia).length

  async function guardarEdits() {
    setGuardando(true); let errores = 0
    for (const [id, cambios] of Object.entries(edits)) {
      const payload: any = {}
      if (cambios.duracion !== undefined) payload.duracion_min = Number(cambios.duracion)
      if (cambios.sede_id !== undefined) {
        // Buscar salon_id de la misma sede para esta clase
        const clase = datos.find(d => d.id === id)
        if (clase && cambios.sede_id !== clase.sede_id) {
          // Buscar el primer salon de esa sede
          const { data: salonesSede } = await supabase.from('salones').select('id').eq('sede_id', cambios.sede_id).order('orden').limit(1)
          if (salonesSede && salonesSede.length > 0) payload.salon_id = salonesSede[0].id
        }
      }
      if (Object.keys(payload).length > 0) { const { error: err } = await supabase.from('clases').update(payload).eq('id', id); if (err) errores++ }
    }
    setGuardando(false); setEdits({}); setModoEdicion(false)
    setMensajeGuardado(errores === 0 ? '✅ Cambios guardados.' : `⚠️ ${errores} error(es).`)
    setTimeout(() => setMensajeGuardado(null), 4000); await cargarDatos()
  }

  async function moverClase(claseId: string, contratoId: string, clienteId: string, estadoActual: string) {
    const estadoDestino = estadoActual === 'activo' ? 'archivado' : 'activo'
    const { data: contratos } = await supabase.from('contratos').select('id, clases_tomadas').eq('cliente_id', clienteId).eq('estado', estadoDestino).order('created_at', { ascending: false }).limit(1)
    if (!contratos || contratos.length === 0) { alert(`No hay contrato ${estadoDestino} para este cliente.`); return }
    const dest = contratos[0]
    await supabase.from('clases').update({ contrato_id: dest.id }).eq('id', claseId)
    const { data: origen } = await supabase.from('contratos').select('clases_tomadas').eq('id', contratoId).single()
    if (origen) await supabase.from('contratos').update({ clases_tomadas: Math.max(0, (origen.clases_tomadas || 0) - 1) }).eq('id', contratoId)
    await supabase.from('contratos').update({ clases_tomadas: (dest.clases_tomadas || 0) + 1 }).eq('id', dest.id)
    setConfirmarMover(null); setMensajeGuardado('✅ Clase movida.'); setTimeout(() => setMensajeGuardado(null), 4000); await cargarDatos()
  }

  async function borrarClase(claseId: string, contratoId: string, estado: string) {
    if (estado === 'dada') {
      const { data: ct } = await supabase.from('contratos').select('clases_tomadas').eq('id', contratoId).single()
      if (ct) await supabase.from('contratos').update({ clases_tomadas: Math.max(0, (ct.clases_tomadas || 0) - 1) }).eq('id', contratoId)
    }
    await supabase.from('clases').delete().eq('id', claseId)
    setConfirmarBorrar(null); setMensajeGuardado('✅ Clase eliminada.'); setTimeout(() => setMensajeGuardado(null), 4000); await cargarDatos()
  }

  const estiloF = (activo: boolean) => ({ padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 as const, cursor: 'pointer' as const, border: `1.5px solid ${activo ? TEAL : TEAL_MID}`, background: activo ? TEAL : '#fff', color: activo ? '#fff' : TEAL_DARK })
  const estiloSel = { padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 as const, border: `1.5px solid ${TEAL_MID}`, background: '#fff', color: '#475569', outline: 'none', cursor: 'pointer' as const }
  const hayCambios = Object.keys(edits).length > 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: 0, flex: 1 }}>📊 Clases tomadas por rango de tiempo</h2>
        {esAdmin && (!modoEdicion
          ? <button onClick={() => setModoEdicion(true)} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>✏️ Modo edición</button>
          : <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEdits({}); setModoEdicion(false) }} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarEdits} disabled={!hayCambios || guardando} style={{ background: hayCambios ? TEAL : '#a0c8c8', border: 'none', borderRadius: '8px', padding: '7px 18px', cursor: hayCambios ? 'pointer' : 'not-allowed', fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                {guardando ? 'Guardando…' : `💾 Guardar${hayCambios ? ` (${Object.keys(edits).length})` : ''}`}
              </button>
            </div>
        )}
      </div>
      {mensajeGuardado && <div style={{ background: mensajeGuardado.startsWith('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${mensajeGuardado.startsWith('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: mensajeGuardado.startsWith('✅') ? '#166534' : '#92400e' }}>{mensajeGuardado}</div>}

      {/* Fechas + buscador */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#555', fontWeight: 600 }}>Desde:</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#555', fontWeight: 600 }}>Hasta:</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none' }} />
        </div>
        <input type="text" placeholder="🔍 Buscar cliente…" value={busquedaCliente} onChange={e => setBusquedaCliente(e.target.value)} style={{ padding: '7px 14px', borderRadius: '20px', border: `1.5px solid ${busquedaCliente ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', minWidth: '200px', color: '#333' }} />
      </div>

      {/* Filtros tipo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {([{ key: 'todos', label: '📋 Todos' }, { key: 'dada', label: '✅ Dadas' }, { key: 'inasistencia', label: '⚠️ Inasistencias' }, { key: 'cancelada', label: '❌ Canceladas academia' }] as const).map(f => (
          <button key={f.key} onClick={() => setFiltroTipo(f.key)} style={estiloF(filtroTipo === f.key)}>{f.label}</button>
        ))}
        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 4px' }} />
        {([{ key: 'todos', label: '🗂 Activo y archivo' }, { key: 'activo', label: '🟢 Activo' }, { key: 'archivado', label: '📦 Archivado' }] as const).map(f => (
          <button key={f.key} onClick={() => setFiltroEstadoContrato(f.key)} style={estiloF(filtroEstadoContrato === f.key)}>{f.label}</button>
        ))}
      </div>

      {/* Filtros dropdowns */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <select value={filtroPro} onChange={e => setFiltroPro(e.target.value)} style={{ ...estiloSel, border: `1.5px solid ${filtroPro !== 'todos' ? TEAL : TEAL_MID}`, background: filtroPro !== 'todos' ? TEAL_LIGHT : '#fff', color: filtroPro !== 'todos' ? TEAL_DARK : '#475569' }}>
          {profesores.map(p => <option key={p} value={p}>{p === 'todos' ? '👨‍🏫 Todos los profesores' : p}</option>)}
        </select>
        <select value={filtroSede} onChange={e => { setFiltroSede(e.target.value); setFiltroSalon('todos') }} style={{ ...estiloSel, border: `1.5px solid ${filtroSede !== 'todas' ? TEAL : TEAL_MID}`, background: filtroSede !== 'todas' ? TEAL_LIGHT : '#fff', color: filtroSede !== 'todas' ? TEAL_DARK : '#475569' }}>
          {sedes.map(s => <option key={s} value={s}>{s === 'todas' ? '🏢 Todas las sedes' : `🏢 ${s}`}</option>)}
        </select>
        <select value={filtroSalon} onChange={e => setFiltroSalon(e.target.value)} style={{ ...estiloSel, border: `1.5px solid ${filtroSalon !== 'todos' ? TEAL : TEAL_MID}`, background: filtroSalon !== 'todos' ? TEAL_LIGHT : '#fff', color: filtroSalon !== 'todos' ? TEAL_DARK : '#475569' }}>
          {salonesDisp.map(s => <option key={s} value={s}>{s === 'todos' ? '🚪 Todos los salones' : s}</option>)}
        </select>
      </div>

      {/* Totales */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[{ label: 'Clases dadas', valor: totalClases, color: TEAL }, { label: 'Inasistencias', valor: totalInasistencias, color: '#d97706' }, { label: 'Tiempo total', valor: `${totalHoras}h ${minResto}m`, color: '#7c3aed' }, { label: 'Total honorarios', valor: `$${totalHonorarios.toLocaleString('es-CO')}`, color: '#16a34a' }].map(t => (
          <div key={t.label} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', padding: '14px 20px', minWidth: '140px', flex: '1' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: t.color }}>{cargando ? '…' : t.valor}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {cargando && <div style={{ textAlign: 'center', padding: '60px', color: '#999' }}>Cargando datos…</div>}
      {error && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>{error}</div>}

      {!cargando && !error && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1.5px solid ${TEAL_MID}`, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead><tr style={{ background: TEAL, color: '#fff' }}>
              {['#', 'Fecha / Hora', 'Cliente', 'Sede', 'Salón', 'Clase', 'Duración', 'Profesor', 'Honorario', 'Estado', ...(esAdmin && modoEdicion ? ['Acciones'] : [])].map((h, i) => (
                <th key={i} style={{ padding: '11px 14px', fontWeight: 700, textAlign: i === 0 || i >= 5 ? 'center' : 'left', whiteSpace: 'nowrap', fontSize: '12px' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtrados.length === 0
                ? <tr><td colSpan={11} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No hay clases en este rango.</td></tr>
                : filtrados.map((c, idx) => {
                  const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia
                  const esCancelada = c.estado === 'cancelada' && c.cancelado_por_academia
                  const bgFila = esInasistencia ? '#fff7ed' : esCancelada ? '#fef2f2' : idx % 2 === 0 ? '#fff' : '#fafefe'
                  const editC = edits[c.id] || {}
                  const durMostrar = editC.duracion !== undefined ? editC.duracion : String(c.duracion_min)
                  const sedeActual = editC.sede_id !== undefined ? editC.sede_id : c.sede_id
                  const honorarioCalculado = calcularHonorario(c)

                  return (
                    <tr key={c.id} style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: bgFila }}>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.fecha}</div>
                        <div style={{ fontSize: '12px', color: '#888' }}>{c.hora}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{c.cliente_nombre}</td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>
                        {modoEdicion && esAdmin
                          ? <select value={sedeActual} onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], sede_id: e.target.value } }))} style={{ padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${editC.sede_id ? TEAL : TEAL_MID}`, fontSize: '12px', outline: 'none', cursor: 'pointer' }}>
                              {sedesDisp.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                            </select>
                          : c.sede_nombre}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{c.salon_nombre}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {c.numero_calculado && c.total_clases
                          ? <span style={{ fontWeight: 700, color: TEAL }}>{c.numero_calculado}/{c.total_clases}</span>
                          : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {modoEdicion && esAdmin
                          ? <input type="number" value={durMostrar} onChange={e => setEdits(prev => ({ ...prev, [c.id]: { ...prev[c.id], duracion: e.target.value } }))} style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${editC.duracion ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', textAlign: 'center' }} />
                          : <span style={{ color: '#334155' }}>{c.duracion_min} min</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569' }}>{c.profesor_nombre}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {honorarioCalculado !== null
                          ? <span style={{ fontWeight: 600, color: '#16a34a' }}>${honorarioCalculado.toLocaleString('es-CO')}</span>
                          : esInasistencia ? <span style={{ color: '#d97706', fontSize: '11px', fontWeight: 600 }}>⏳ Pendiente</span>
                          : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: esInasistencia ? '#fff7ed' : esCancelada ? '#fef2f2' : c.contrato_estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: esInasistencia ? '#c2410c' : esCancelada ? '#991b1b' : c.contrato_estado === 'activo' ? '#166534' : '#64748b' }}>
                          {esInasistencia ? '⚠️ Inasistencia' : esCancelada ? '❌ Cancelada' : c.contrato_estado === 'activo' ? '🟢 Activo' : '📦 Archivo'}
                        </span>
                      </td>
                      {esAdmin && modoEdicion && (
                        <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            {!esCancelada && (confirmarMover === c.id
                              ? <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => moverClase(c.id, c.contrato_id, c.cliente_id, c.contrato_estado)} style={{ padding: '4px 8px', background: TEAL, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>✓</button>
                                  <button onClick={() => setConfirmarMover(null)} style={{ padding: '4px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                </div>
                              : <button onClick={() => setConfirmarMover(c.id)} title={c.contrato_estado === 'activo' ? 'Mover a archivo' : 'Mover a activo'} style={{ padding: '4px 8px', background: TEAL_LIGHT, color: TEAL_DARK, border: `1px solid ${TEAL_MID}`, borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                  {c.contrato_estado === 'activo' ? '📦' : '🟢'}
                                </button>
                            )}
                            {confirmarBorrar === c.id
                              ? <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => borrarClase(c.id, c.contrato_id, c.estado)} style={{ padding: '4px 8px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>✓</button>
                                  <button onClick={() => setConfirmarBorrar(null)} style={{ padding: '4px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                                </div>
                              : <button onClick={() => setConfirmarBorrar(c.id)} style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>🗑</button>
                            }
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
      {!cargando && !error && filtrados.length > 0 && <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'right' }}>Mostrando {filtrados.length} de {datos.length} registros</div>}
    </div>
  )
}
