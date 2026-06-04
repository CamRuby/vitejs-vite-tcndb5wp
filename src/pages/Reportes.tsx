import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface PlanActivo {
  id: string
  cliente_id: string
  cliente_nombre: string
  grupo_whatsapp: string | null
  sede_id: string | null
  sede_nombre: string
  instrumento_id: string | null
  instrumento_nombre: string
  total_clases: number
  duracion_min: number
  clases_tomadas: number
  conteo_whatsapp: number | null
  diferencia: number
}

interface Instrumento {
  id: string
  nombre: string
}

interface Sede {
  id: string
  nombre: string
}

type CampoTexto = 'grupo_whatsapp'
type CampoNumero = 'total_clases' | 'duracion_min' | 'conteo_whatsapp'

interface Edicion {
  instrumento_id?: string
  sede_id?: string
  grupo_whatsapp?: string
  total_clases?: number
  duracion_min?: number
  conteo_whatsapp?: number | null
}

interface ClaseDada {
  id: string
  fecha: string
  hora: string
  duracion_min: number
  estado: string
  cancelado_por_academia: boolean | null
  es_cortesia: boolean
  numero_calculado: number | null
  honorario_valor: number | null
  contrato_id: string
  contrato_estado: string
  cliente_id: string
  cliente_nombre: string
  sede_nombre: string
  salon_nombre: string
  profesor_id: string
  profesor_nombre: string
  total_clases: number
}

// ─── MENÚ DE REPORTES ─────────────────────────────────────────────────────────
const REPORTES = [
  {
    id: 'clases_tomadas_por_plan',
    icono: '📋',
    titulo: 'Número de clases tomadas por plan',
    descripcion: 'Planes activos con verificación de conteo WhatsApp por sede',
  },
  {
    id: 'clases_dadas_rango',
    icono: '📊',
    titulo: 'Clases tomadas por rango de tiempo',
    descripcion: 'Historial de clases dadas e inasistencias con totales y filtros',
  },
]

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Reportes({ rol }: { rol?: string }) {
  const [reporteActivo, setReporteActivo] = useState<string | null>(null)

  if (reporteActivo === 'clases_tomadas_por_plan') {
    return <ReporteClasesTomadasPorPlan onVolver={() => setReporteActivo(null)} rol={rol} />
  }
  if (reporteActivo === 'clases_dadas_rango') {
    return <ReporteClasesDadasRango onVolver={() => setReporteActivo(null)} rol={rol} />
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: TEAL_DARK, marginBottom: '8px' }}>
        Reportes
      </h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '32px' }}>
        Selecciona un reporte para visualizarlo.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {REPORTES.map(r => (
          <button
            key={r.id}
            onClick={() => setReporteActivo(r.id)}
            style={{
              background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '12px',
              padding: '24px 20px', textAlign: 'left', cursor: 'pointer',
              transition: 'box-shadow 0.15s, border-color 0.15s',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(26,138,138,0.15)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = TEAL
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = TEAL_MID
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{r.icono}</div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: TEAL_DARK, marginBottom: '6px' }}>{r.titulo}</div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: 1.5 }}>{r.descripcion}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── REPORTE: NUMERO DE CLASES TOMADAS POR PLAN ─────────────────────────────────────────
function ReporteClasesTomadasPorPlan({ onVolver, rol }: { onVolver: () => void; rol?: string }) {
  const [datos, setDatos] = useState<PlanActivo[]>([])
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([])
  const [sedesDisponibles, setSedesDisponibles] = useState<Sede[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'al_dia' | 'pendiente'>('todos')
  const [sedeFiltro, setSedeFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [editados, setEditados] = useState<Record<string, Edicion>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)

const esAdmin = rol === 'superadmin'

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    setError(null)
    try {
      const [{ data, error: err }, { data: instr, error: errInstr }, { data: sedesData, error: errSedes }] = await Promise.all([
        supabase
          .from('contratos')
          .select(`
            id,
            cliente_id,
            sede_id,
            instrumento_id,
            total_clases,
            duracion_min,
            clases_tomadas,
            conteo_whatsapp,
            clientes ( nombres, apellidos, grupo_whatsapp ),
            sedes ( nombre ),
            instrumentos ( id, nombre )
          `)
          .eq('estado', 'activo'),
        supabase.from('instrumentos').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('sedes').select('id, nombre').order('nombre', { ascending: true })
      ])

      if (err) throw err
      if (errInstr) throw errInstr
      if (errSedes) throw errSedes

      setInstrumentos(instr || [])
      setSedesDisponibles(sedesData || [])

      const filas: PlanActivo[] = (data || []).map((row: any) => {
        const tomadas = Number(row.clases_tomadas ?? 0)
        const whatsapp = row.conteo_whatsapp !== null ? Number(row.conteo_whatsapp) : null
        const diferencia = whatsapp !== null ? tomadas - whatsapp : tomadas
        return {
          id: row.id,
          cliente_id: row.cliente_id,
          cliente_nombre: `${row.clientes?.nombres ?? ''} ${row.clientes?.apellidos ?? ''}`.trim(),
          grupo_whatsapp: row.clientes?.grupo_whatsapp ?? null,
          sede_id: row.sede_id ?? null,
          sede_nombre: row.sedes?.nombre ?? '—',
          instrumento_id: row.instrumento_id ?? null,
          instrumento_nombre: row.instrumentos?.nombre ?? '—',
          total_clases: Number(row.total_clases ?? 0),
          duracion_min: Number(row.duracion_min ?? 0),
          clases_tomadas: tomadas,
          conteo_whatsapp: whatsapp,
          diferencia,
        }
      }).sort((a, b) => a.sede_nombre.localeCompare(b.sede_nombre))

      setDatos(filas)
    } catch (e: any) {
      setError('No se pudieron cargar los datos. Verifica tu conexión.')
    } finally {
      setCargando(false)
    }
  }

  const sedes = ['todas', ...Array.from(new Set(datos.map(d => d.sede_nombre))).sort()]
  const totalGlobal = datos.length
  const alDiaGlobal = datos.filter(d => d.diferencia === 0).length
  const pendienteGlobal = datos.filter(d => d.diferencia > 0).length

  let filtrados = datos.filter(d => {
    const coincideBusqueda =
      d.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.sede_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.instrumento_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (d.grupo_whatsapp ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const coincideSede = sedeFiltro === 'todas' || d.sede_nombre === sedeFiltro
    return coincideBusqueda && coincideSede
  })

  if (filtro === 'al_dia') filtrados = filtrados.filter(d => d.diferencia === 0)
  else if (filtro === 'pendiente') filtrados = filtrados.filter(d => d.diferencia > 0).sort((a, b) => a.diferencia - b.diferencia)

  function getNum(plan: PlanActivo, campo: CampoNumero): number | string {
    const ed = editados[plan.id]
    if (ed && campo in ed) { const v = ed[campo]; return v === null || v === undefined ? '' : v }
    if (campo === 'conteo_whatsapp') return plan.conteo_whatsapp !== null ? plan.conteo_whatsapp : ''
    if (campo === 'total_clases') return plan.total_clases
    return plan.duracion_min
  }

  function getTxt(plan: PlanActivo, campo: CampoTexto): string {
    const ed = editados[plan.id]
    if (ed && campo in ed) return ed[campo] ?? ''
    return plan.grupo_whatsapp ?? ''
  }

  function getInstrumentoId(plan: PlanActivo): string {
    const ed = editados[plan.id]
    if (ed && 'instrumento_id' in ed) return ed.instrumento_id ?? ''
    return plan.instrumento_id ?? ''
  }

  function getSedeId(plan: PlanActivo): string {
    const ed = editados[plan.id]
    if (ed && 'sede_id' in ed) return ed.sede_id ?? ''
    return plan.sede_id ?? ''
  }

  function editarNum(id: string, campo: CampoNumero, valor: string) {
    const num = valor === '' ? null : Number(valor)
    setEditados(prev => ({ ...prev, [id]: { ...prev[id], [campo]: num } }))
  }

  function editarTxt(id: string, campo: CampoTexto, valor: string) {
    setEditados(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }))
  }

  function editarSede(id: string, valor: string) {
    setEditados(prev => ({ ...prev, [id]: { ...prev[id], sede_id: valor } }))
  }

  function editarInstrumento(id: string, valor: string) {
    setEditados(prev => ({ ...prev, [id]: { ...prev[id], instrumento_id: valor } }))
  }

  async function guardarCambios() {
    setGuardando(true)
    setMensajeGuardado(null)
    let errores = 0

    for (const [id, cambios] of Object.entries(editados)) {
      const plan = datos.find(d => d.id === id)
      if (!plan) continue

      const updateContrato: any = {}
      if ('total_clases' in cambios && cambios.total_clases !== null) updateContrato.total_clases = cambios.total_clases
      if ('duracion_min' in cambios && cambios.duracion_min !== null) updateContrato.duracion_min = cambios.duracion_min
      if ('conteo_whatsapp' in cambios) updateContrato.conteo_whatsapp = cambios.conteo_whatsapp
      if ('instrumento_id' in cambios && cambios.instrumento_id) updateContrato.instrumento_id = cambios.instrumento_id
      if ('sede_id' in cambios && cambios.sede_id) updateContrato.sede_id = cambios.sede_id

      if (Object.keys(updateContrato).length > 0) {
        const { error: err } = await supabase.from('contratos').update(updateContrato).eq('id', id)
        if (err) errores++
      }

      if ('grupo_whatsapp' in cambios) {
        const { error: err } = await supabase.from('clientes').update({ grupo_whatsapp: cambios.grupo_whatsapp }).eq('id', plan.cliente_id)
        if (err) errores++
      }
    }

    setGuardando(false)
    setEditados({})
    setModoEdicion(false)
    setMensajeGuardado(errores === 0 ? '✅ Cambios guardados correctamente.' : `⚠️ ${errores} cambio(s) no se pudieron guardar.`)
    await cargarDatos()
    setTimeout(() => setMensajeGuardado(null), 4000)
  }

  function cancelarEdicion() { setEditados({}); setModoEdicion(false) }
  const hayCambios = Object.keys(editados).length > 0

  const estiloInput = (editado: boolean) => ({
    padding: '5px 8px', borderRadius: '6px', textAlign: 'center' as const,
    border: `1.5px solid ${editado ? TEAL : TEAL_MID}`,
    fontSize: '13px', outline: 'none', background: '#fff',
  })

  const estiloInputTxt = (editado: boolean) => ({
    padding: '5px 8px', borderRadius: '6px',
    border: `1.5px solid ${editado ? TEAL : TEAL_MID}`,
    fontSize: '13px', outline: 'none', background: '#fff', width: '100%', minWidth: '120px',
  })

  const estiloSelect = (editado: boolean) => ({
    padding: '5px 8px', borderRadius: '6px',
    border: `1.5px solid ${editado ? TEAL : TEAL_MID}`,
    fontSize: '13px', outline: 'none', background: '#fff', width: '100%', minWidth: '130px', cursor: 'pointer',
  })

  const columnas = ['#', 'Cliente', 'Grupo WA', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Clases tomadas', 'Conteo WA', 'Diferencia']
  const editables = ['Grupo WA', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Conteo WA']

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: 0, flex: 1 }}>📋 Número de clases tomadas por plan</h2>
        {esAdmin && (
          !modoEdicion ? (
            <button onClick={() => setModoEdicion(true)} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>✏️ Modo edición</button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelarEdicion} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarCambios} disabled={!hayCambios || guardando} style={{ background: hayCambios ? TEAL : '#a0c8c8', border: 'none', borderRadius: '8px', padding: '7px 18px', cursor: hayCambios ? 'pointer' : 'not-allowed', fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                {guardando ? 'Guardando…' : `💾 Guardar${hayCambios ? ` (${Object.keys(editados).length})` : ''}`}
              </button>
            </div>
          )
        )}
      </div>

      {mensajeGuardado && (
        <div style={{ background: mensajeGuardado.startsWith('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${mensajeGuardado.startsWith('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: mensajeGuardado.startsWith('✅') ? '#166534' : '#92400e' }}>{mensajeGuardado}</div>
      )}

      {modoEdicion && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
          ✏️ Modo edición activo — puedes modificar <strong>Grupo WA</strong>, <strong>Sede</strong>, <strong>Instrumento</strong>, <strong>Plan</strong>, <strong>Duración</strong> y <strong>Conteo WA</strong>.
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total planes activos', valor: totalGlobal, color: TEAL },
          { label: 'Planes con registros de clases al día', valor: alDiaGlobal, color: '#16a34a' },
          { label: 'Planes con registros de clases pendientes', valor: pendienteGlobal, color: '#d97706' },
        ].map(t => (
          <div key={t.label} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px', padding: '14px 20px', minWidth: '160px', flex: '1' }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: t.color }}>{cargando ? '…' : t.valor}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{t.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        {([
          { key: 'todos', label: '📋 Todos' },
          { key: 'al_dia', label: '✅ Conteo al día' },
          { key: 'pendiente', label: '⏳ Pendiente de ajustar' },
        ] as const).map(f => (
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
            <thead>
              <tr style={{ background: TEAL, color: '#fff' }}>
                {columnas.map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', fontWeight: 700, textAlign: i === 0 || i >= 5 ? 'center' : 'left', whiteSpace: 'nowrap', fontSize: '12px', letterSpacing: '0.03em' }}>
                    {h}{modoEdicion && editables.includes(h) ? ' ✏️' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={columnas.length} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No hay planes que coincidan con el filtro.</td></tr>
              ) : filtrados.map((plan, idx) => {
                const ed = editados[plan.id] ?? {}
                const filaEditada = Object.keys(ed).length > 0
                const waActual = 'conteo_whatsapp' in ed ? ed.conteo_whatsapp : plan.conteo_whatsapp
                const diff = waActual !== null && waActual !== undefined ? plan.clases_tomadas - (waActual as number) : plan.clases_tomadas
                const diffColor = diff === 0 ? '#16a34a' : diff <= 2 ? '#d97706' : '#dc2626'
                const diffBg = diff === 0 ? '#f0fdf4' : diff <= 2 ? '#fffbeb' : '#fef2f2'
                const instrIdActual = getInstrumentoId(plan)
                return (
                  <tr key={plan.id} style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: filaEditada ? '#fffde7' : idx % 2 === 0 ? '#fff' : '#fafefe' }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{plan.cliente_nombre}</td>
                    <td style={{ padding: '6px 14px', minWidth: '130px' }}>
                      {modoEdicion ? <input type="text" value={getTxt(plan, 'grupo_whatsapp')} onChange={e => editarTxt(plan.id, 'grupo_whatsapp', e.target.value)} placeholder="Sin grupo" style={estiloInputTxt('grupo_whatsapp' in ed)} /> : <span style={{ color: plan.grupo_whatsapp ? '#334155' : '#ccc' }}>{plan.grupo_whatsapp || '—'}</span>}
                    </td>
                    <td style={{ padding: '6px 14px', minWidth: '130px' }}>
                      {modoEdicion ? (
                        <select value={getSedeId(plan)} onChange={e => editarSede(plan.id, e.target.value)} style={estiloSelect('sede_id' in ed)}>
                          <option value="">— Sin sede —</option>
                          {sedesDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                        </select>
                      ) : <span style={{ color: '#475569', whiteSpace: 'nowrap' }}>{plan.sede_nombre}</span>}
                    </td>
                    <td style={{ padding: '6px 14px', minWidth: '140px' }}>
                      {modoEdicion ? (
                        <select value={instrIdActual} onChange={e => editarInstrumento(plan.id, e.target.value)} style={estiloSelect('instrumento_id' in ed)}>
                          <option value="">— Sin instrumento —</option>
                          {instrumentos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                        </select>
                      ) : <span style={{ color: '#475569' }}>{plan.instrumento_nombre}</span>}
                    </td>
                    <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                      {modoEdicion ? <input type="number" value={getNum(plan, 'total_clases')} onChange={e => editarNum(plan.id, 'total_clases', e.target.value)} style={{ ...estiloInput('total_clases' in ed), width: '64px' }} /> : <span style={{ color: '#334155', fontWeight: 600 }}>{plan.total_clases}</span>}
                    </td>
                    <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                      {modoEdicion ? <input type="number" value={getNum(plan, 'duracion_min')} onChange={e => editarNum(plan.id, 'duracion_min', e.target.value)} style={{ ...estiloInput('duracion_min' in ed), width: '64px' }} /> : <span style={{ color: '#334155' }}>{plan.duracion_min} min</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>{plan.clases_tomadas}</td>
                    <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                      {modoEdicion ? <input type="number" value={getNum(plan, 'conteo_whatsapp')} onChange={e => editarNum(plan.id, 'conteo_whatsapp', e.target.value)} placeholder="—" style={{ ...estiloInput('conteo_whatsapp' in ed), width: '64px' }} /> : plan.conteo_whatsapp !== null ? <span style={{ color: '#334155' }}>{plan.conteo_whatsapp}</span> : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{ background: diffBg, color: diffColor, borderRadius: '20px', padding: '3px 12px', fontWeight: 700, fontSize: '13px', display: 'inline-block' }}>
                        {diff === 0 ? '✓ 0' : `+${diff}`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'right' }}>
          Mostrando {filtrados.length} de {datos.length} planes
        </div>
      )}
    </div>
  )
}

// ─── REPORTE: CLASES TOMADAS POR RANGO DE TIEMPO ──────────────────────────────────────────
function ReporteClasesDadasRango({ onVolver, rol }: { onVolver: () => void; rol?: string }) {
  const hoy = new Date()
  const primerDiaMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
  const ultimoDiaMesStr = `${ultimoDiaMes.getFullYear()}-${String(ultimoDiaMes.getMonth() + 1).padStart(2, '0')}-${String(ultimoDiaMes.getDate()).padStart(2, '0')}`

  const [datos, setDatos] = useState<ClaseDada[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fechaInicio, setFechaInicio] = useState(primerDiaMes)
  const [fechaFin, setFechaFin] = useState(ultimoDiaMesStr)
  const [filtroPro, setFiltroPro] = useState('todos')
  const [filtroSede, setFiltroSede] = useState('todas')
  const [filtroSalon, setFiltroSalon] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'archivado'>('todos')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'dada' | 'inasistencia'>('todos')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [honorariosEdit, setHonorariosEdit] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null)
  const [confirmarMover, setConfirmarMover] = useState<string | null>(null)

  const esAdmin = rol === 'superadmin'
  useEffect(() => { cargarDatos() }, [fechaInicio, fechaFin])

  async function cargarDatos() {
    setCargando(true)
    setError(null)
    try {
      const [{ data: dadas, error: err1 }, { data: inasistencias, error: err2 }] = await Promise.all([
  supabase.from('clases_con_numero').select(`id, fecha, hora, duracion_min, estado, cancelado_por_academia, es_cortesia, numero_calculado, honorario_valor, contrato_id, contratos ( id, estado, cliente_id, total_clases, clientes ( nombres, apellidos ) ), profesores ( id, nombre ), salones ( nombre, sedes ( nombre ) )`)
    .gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'dada')
    .order('fecha', { ascending: false }).order('hora', { ascending: false }),
  supabase.from('clases_con_numero').select(`id, fecha, hora, duracion_min, estado, cancelado_por_academia, es_cortesia, numero_calculado, honorario_valor, contrato_id, contratos ( id, estado, cliente_id, total_clases, clientes ( nombres, apellidos ) ), profesores ( id, nombre ), salones ( nombre, sedes ( nombre ) )`)
    .gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'cancelada').eq('cancelado_por_academia', false)
    .order('fecha', { ascending: false }).order('hora', { ascending: false })
])
const err = err1 || err2
const data = [...(dadas || []), ...(inasistencias || [])].sort((a, b) =>
  b.fecha.localeCompare(a.fecha) || (b.hora || '').localeCompare(a.hora || '')
)
      if (err) throw err

      const filas: ClaseDada[] = (data || [])
        .filter((r: any) => !r.es_cortesia)
        .map((r: any) => ({
          id: r.id,
          fecha: r.fecha,
          hora: r.hora?.substring(0, 5) || '—',
          duracion_min: Number(r.duracion_min || 0),
          estado: r.estado,
          cancelado_por_academia: r.cancelado_por_academia,
          es_cortesia: r.es_cortesia,
          numero_calculado: r.numero_calculado,
          honorario_valor: r.honorario_valor !== null ? Number(r.honorario_valor) : null,
          contrato_id: r.contrato_id,
          contrato_estado: r.contratos?.estado || '—',
          cliente_id: r.contratos?.cliente_id || '',
          cliente_nombre: `${r.contratos?.clientes?.nombres ?? ''} ${r.contratos?.clientes?.apellidos ?? ''}`.trim(),
          sede_nombre: r.salones?.sedes?.nombre || '—',
          salon_nombre: r.salones?.nombre || '—',
          profesor_id: r.profesores?.id || '',
          profesor_nombre: r.profesores?.nombre || '—',
          total_clases: Number(r.contratos?.total_clases || 0),
        }))

      setDatos(filas)
    } catch (e: any) {
      setError('No se pudieron cargar los datos.')
    } finally {
      setCargando(false)
    }
  }

  // Listas para filtros
  const profesores = ['todos', ...Array.from(new Set(datos.map(d => d.profesor_nombre))).sort()]
  const sedes = ['todas', ...Array.from(new Set(datos.map(d => d.sede_nombre))).sort()]
  const salones = ['todos', ...Array.from(new Set(datos.filter(d => filtroSede === 'todas' || d.sede_nombre === filtroSede).map(d => d.salon_nombre))).sort()]

  // Filtrar
  const filtrados = datos.filter(d => {
    if (filtroPro !== 'todos' && d.profesor_nombre !== filtroPro) return false
    if (filtroSede !== 'todas' && d.sede_nombre !== filtroSede) return false
    if (filtroSalon !== 'todos' && d.salon_nombre !== filtroSalon) return false
    if (filtroEstado !== 'todos' && d.contrato_estado !== filtroEstado) return false
    if (filtroTipo === 'dada' && d.estado !== 'dada') return false
    if (filtroTipo === 'inasistencia' && !(d.estado === 'cancelada' && !d.cancelado_por_academia)) return false
    return true
  })

  // Totales
  const totalClases = filtrados.filter(d => d.estado === 'dada').length
  const totalMinutos = filtrados.filter(d => d.estado === 'dada').reduce((s, d) => s + d.duracion_min, 0)
  const totalHoras = Math.floor(totalMinutos / 60)
  const minResto = totalMinutos % 60
  const totalHonorarios = filtrados.reduce((s, d) => s + (d.honorario_valor || 0), 0)
  const totalInasistencias = filtrados.filter(d => d.estado === 'cancelada' && !d.cancelado_por_academia).length

  async function moverClase(claseId: string, contratoId: string, clienteId: string, estadoActual: string) {
    // Buscar el contrato destino
    const estadoDestino = estadoActual === 'activo' ? 'archivado' : 'activo'
    const { data: contratos } = await supabase
      .from('contratos')
      .select('id, clases_tomadas')
      .eq('cliente_id', clienteId)
      .eq('estado', estadoDestino)
      .order('fecha_inicio', { ascending: false })
      .limit(1)

    if (!contratos || contratos.length === 0) {
      alert(`No hay contrato ${estadoDestino} para este cliente.`)
      return
    }

    const contratoDestino = contratos[0]

    // Mover la clase
    await supabase.from('clases').update({ contrato_id: contratoDestino.id }).eq('id', claseId)

    // Restar del contrato origen
    const { data: origen } = await supabase.from('contratos').select('clases_tomadas').eq('id', contratoId).single()
    if (origen) await supabase.from('contratos').update({ clases_tomadas: Math.max(0, (origen.clases_tomadas || 0) - 1) }).eq('id', contratoId)

    // Sumar al contrato destino
    await supabase.from('contratos').update({ clases_tomadas: (contratoDestino.clases_tomadas || 0) + 1 }).eq('id', contratoDestino.id)

    setConfirmarMover(null)
    setMensajeGuardado('✅ Clase movida correctamente.')
    setTimeout(() => setMensajeGuardado(null), 4000)
    await cargarDatos()
  }

  async function borrarClase(claseId: string, contratoId: string) {
    // Restar del contrato
    const { data: ct } = await supabase.from('contratos').select('clases_tomadas').eq('id', contratoId).single()
    if (ct) await supabase.from('contratos').update({ clases_tomadas: Math.max(0, (ct.clases_tomadas || 0) - 1) }).eq('id', contratoId)
    await supabase.from('clases').delete().eq('id', claseId)
    setConfirmarBorrar(null)
    setMensajeGuardado('✅ Clase eliminada.')
    setTimeout(() => setMensajeGuardado(null), 4000)
    await cargarDatos()
  }

  async function guardarHonorarios() {
    setGuardando(true)
    let errores = 0
    for (const [id, valor] of Object.entries(honorariosEdit)) {
      const { error: err } = await supabase.from('clases').update({ honorario_valor: Number(valor) }).eq('id', id)
      if (err) errores++
    }
    setGuardando(false)
    setHonorariosEdit({})
    setModoEdicion(false)
    setMensajeGuardado(errores === 0 ? '✅ Honorarios guardados.' : `⚠️ ${errores} error(es).`)
    setTimeout(() => setMensajeGuardado(null), 4000)
    await cargarDatos()
  }

  const estiloFiltro = (activo: boolean) => ({
    padding: '7px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', border: `1.5px solid ${activo ? TEAL : TEAL_MID}`,
    background: activo ? TEAL : '#fff', color: activo ? '#fff' : TEAL_DARK,
  })

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>← Reportes</button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: 0, flex: 1 }}>📊 Clases tomadas por rango de tiempo</h2>
        {esAdmin && (
          !modoEdicion ? (
            <button onClick={() => setModoEdicion(true)} style={{ background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600 }}>✏️ Modo edición</button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setModoEdicion(false); setHonorariosEdit({}) }} style={{ background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Cancelar</button>
              <button onClick={guardarHonorarios} disabled={Object.keys(honorariosEdit).length === 0 || guardando} style={{ background: Object.keys(honorariosEdit).length > 0 ? TEAL : '#a0c8c8', border: 'none', borderRadius: '8px', padding: '7px 18px', cursor: Object.keys(honorariosEdit).length > 0 ? 'pointer' : 'not-allowed', fontSize: '13px', color: '#fff', fontWeight: 700 }}>
                {guardando ? 'Guardando…' : `💾 Guardar honorarios`}
              </button>
            </div>
          )
        )}
      </div>

      {mensajeGuardado && (
        <div style={{ background: mensajeGuardado.startsWith('✅') ? '#f0fdf4' : '#fffbeb', border: `1px solid ${mensajeGuardado.startsWith('✅') ? '#bbf7d0' : '#fde68a'}`, borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '14px', color: mensajeGuardado.startsWith('✅') ? '#166534' : '#92400e' }}>{mensajeGuardado}</div>
      )}

      {/* Rango de fechas */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#555', fontWeight: 600 }}>Desde:</label>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#555', fontWeight: 600 }}>Hasta:</label>
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none' }} />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Tipo */}
        {([
          { key: 'todos', label: '📋 Todos' },
          { key: 'dada', label: '✅ Dadas' },
          { key: 'inasistencia', label: '⚠️ Inasistencias' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFiltroTipo(f.key)} style={estiloFiltro(filtroTipo === f.key)}>{f.label}</button>
        ))}

        <div style={{ width: '1px', height: '28px', background: '#e2e8f0', margin: '0 4px' }} />

        {/* Estado contrato */}
        {([
          { key: 'todos', label: '🗂 Activo y archivo' },
          { key: 'activo', label: '🟢 Activo' },
          { key: 'archivado', label: '📦 Archivado' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => setFiltroEstado(f.key)} style={estiloFiltro(filtroEstado === f.key)}>{f.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Profesor */}
        <select value={filtroPro} onChange={e => setFiltroPro(e.target.value)} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${filtroPro !== 'todos' ? TEAL : TEAL_MID}`, background: filtroPro !== 'todos' ? TEAL_LIGHT : '#fff', color: filtroPro !== 'todos' ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          {profesores.map(p => <option key={p} value={p}>{p === 'todos' ? '👨‍🏫 Todos los profesores' : p}</option>)}
        </select>

        {/* Sede */}
        <select value={filtroSede} onChange={e => { setFiltroSede(e.target.value); setFiltroSalon('todos') }} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${filtroSede !== 'todas' ? TEAL : TEAL_MID}`, background: filtroSede !== 'todas' ? TEAL_LIGHT : '#fff', color: filtroSede !== 'todas' ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          {sedes.map(s => <option key={s} value={s}>{s === 'todas' ? '🏢 Todas las sedes' : `🏢 ${s}`}</option>)}
        </select>

        {/* Salón */}
        <select value={filtroSalon} onChange={e => setFiltroSalon(e.target.value)} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, border: `1.5px solid ${filtroSalon !== 'todos' ? TEAL : TEAL_MID}`, background: filtroSalon !== 'todos' ? TEAL_LIGHT : '#fff', color: filtroSalon !== 'todos' ? TEAL_DARK : '#475569', outline: 'none', cursor: 'pointer' }}>
          {salones.map(s => <option key={s} value={s}>{s === 'todos' ? '🚪 Todos los salones' : s}</option>)}
        </select>
      </div>

      {/* Totales */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Clases dadas', valor: totalClases, color: TEAL },
          { label: 'Inasistencias', valor: totalInasistencias, color: '#d97706' },
          { label: 'Tiempo total', valor: `${totalHoras}h ${minResto}m`, color: '#7c3aed' },
          { label: 'Total honorarios', valor: `$${totalHonorarios.toLocaleString('es-CO')}`, color: '#16a34a' },
        ].map(t => (
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
            <thead>
              <tr style={{ background: TEAL, color: '#fff' }}>
                {['#', 'Fecha / Hora', 'Cliente', 'Sede', 'Salón', 'Clase', 'Duración', 'Profesor', 'Honorario', 'Plan', ...(esAdmin && modoEdicion ? ['Acciones'] : [])].map((h, i) => (
                  <th key={i} style={{ padding: '11px 14px', fontWeight: 700, textAlign: i === 0 || i >= 5 ? 'center' : 'left', whiteSpace: 'nowrap', fontSize: '12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No hay clases en este rango.</td></tr>
              ) : filtrados.map((c, idx) => {
                const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia
                const bgFila = esInasistencia ? '#fff7ed' : idx % 2 === 0 ? '#fff' : '#fafefe'
                const honEdit = honorariosEdit[c.id]
                const honMostrar = honEdit !== undefined ? honEdit : c.honorario_valor !== null ? String(c.honorario_valor) : ''

                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${TEAL_LIGHT}`, background: bgFila }}>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.fecha}</div>
                      <div style={{ fontSize: '12px', color: '#888' }}>{c.hora}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>{c.cliente_nombre}</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{c.sede_nombre}</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{c.salon_nombre}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {c.numero_calculado && c.total_clases
                        ? <span style={{ fontWeight: 700, color: TEAL }}>{c.numero_calculado}/{c.total_clases}</span>
                        : <span style={{ color: '#ccc' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155' }}>{c.duracion_min} min</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{c.profesor_nombre}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {modoEdicion && esAdmin ? (
                        <input type="number" value={honMostrar} onChange={e => setHonorariosEdit(prev => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="—" style={{ width: '80px', padding: '4px 8px', borderRadius: '6px', border: `1.5px solid ${honEdit !== undefined ? TEAL : TEAL_MID}`, fontSize: '13px', outline: 'none', textAlign: 'center' }} />
                      ) : (
                        c.honorario_valor !== null
                          ? <span style={{ fontWeight: 600, color: '#16a34a' }}>${c.honorario_valor.toLocaleString('es-CO')}</span>
                          : esInasistencia ? <span style={{ color: '#d97706', fontSize: '11px', fontWeight: 600 }}>⏳ Pendiente</span>
                          : <span style={{ color: '#ccc' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                        background: esInasistencia ? '#fff7ed' : c.contrato_estado === 'activo' ? '#dcfce7' : '#f1f5f9',
                        color: esInasistencia ? '#c2410c' : c.contrato_estado === 'activo' ? '#166534' : '#64748b',
                      }}>
                        {esInasistencia ? '⚠️ Inasistencia' : c.contrato_estado === 'activo' ? '🟢 Activo' : '📦 Archivo'}
                      </span>
                    </td>
                    {esAdmin && modoEdicion && (
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {/* Mover */}
                          {confirmarMover === c.id ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button onClick={() => moverClase(c.id, c.contrato_id, c.cliente_id, c.contrato_estado)}
                                style={{ padding: '4px 10px', background: TEAL, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                                ✓
                              </button>
                              <button onClick={() => setConfirmarMover(null)}
                                style={{ padding: '4px 10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmarMover(c.id)}
                              title={c.contrato_estado === 'activo' ? 'Mover a archivo' : 'Mover a activo'}
                              style={{ padding: '4px 10px', background: TEAL_LIGHT, color: TEAL_DARK, border: `1px solid ${TEAL_MID}`, borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                              {c.contrato_estado === 'activo' ? '📦 Archivar' : '🟢 Activar'}
                            </button>
                          )}
                            {/* Borrar */}
                            {(esInasistencia || c.estado === 'dada') && (
                            confirmarBorrar === c.id ? (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => borrarClase(c.id, c.contrato_id)}
                                  style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                                  ✓
                                </button>
                                <button onClick={() => setConfirmarBorrar(null)}
                                  style={{ padding: '4px 10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmarBorrar(c.id)}
                                style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                                🗑 Borrar
                              </button>
                            )
                          )}
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

      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'right' }}>
          Mostrando {filtrados.length} de {datos.length} registros
        </div>
      )}
    </div>
  )
}
