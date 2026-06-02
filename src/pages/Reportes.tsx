import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const TEAL_DARK = '#146f6f'

// ─── TIPOS ────────────────────────────────────────────────────────────────────
interface PlanActivo {
  id: string
  cliente_nombre: string
  sede_nombre: string
  instrumento_nombre: string
  total_clases: number
  duracion_min: number
  clases_tomadas: number
  conteo_whatsapp: number | null
  diferencia: number
}

// ─── MENÚ DE REPORTES ─────────────────────────────────────────────────────────
const REPORTES = [
  {
    id: 'clases_tomadas_por_plan',
    icono: '📋',
    titulo: 'Clases tomadas por plan',
    descripcion: 'Planes activos con verificación de conteo WhatsApp por sede',
  },
]

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Reportes() {
  const [reporteActivo, setReporteActivo] = useState<string | null>(null)

  if (reporteActivo === 'clases_tomadas_por_plan') {
    return <ReporteClasesTomadasPorPlan onVolver={() => setReporteActivo(null)} />
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

// ─── REPORTE: CLASES TOMADAS POR PLAN ─────────────────────────────────────────
function ReporteClasesTomadasPorPlan({ onVolver }: { onVolver: () => void }) {
  const [datos, setDatos] = useState<PlanActivo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'al_dia' | 'pendiente'>('todos')
  const [sedeFiltro, setSedeFiltro] = useState<string>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [modoEdicion, setModoEdicion] = useState(false)
  const [editados, setEditados] = useState<Record<string, { duracion_min?: number; conteo_whatsapp?: number | null }>>({})
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setCargando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('contratos')
        .select(`
          id,
          total_clases,
          duracion_min,
          clases_tomadas,
          conteo_whatsapp,
          clientes ( nombres, apellidos ),
          sedes ( nombre ),
          instrumentos ( nombre )
        `)
        .eq('estado', 'activo')

      if (err) throw err

      const filas: PlanActivo[] = (data || []).map((row: any) => {
        const tomadas = Number(row.clases_tomadas ?? 0)
        const whatsapp = row.conteo_whatsapp !== null ? Number(row.conteo_whatsapp) : null
        const diferencia = whatsapp !== null ? tomadas - whatsapp : tomadas
        return {
          id: row.id,
          cliente_nombre: `${row.clientes?.nombres ?? ''} ${row.clientes?.apellidos ?? ''}`.trim(),
          sede_nombre: row.sedes?.nombre ?? '—',
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

  // ── Sedes disponibles ──
  const sedes = ['todas', ...Array.from(new Set(datos.map(d => d.sede_nombre))).sort()]

  // ── Indicadores globales (siempre sobre TODOS los datos) ──
  const totalGlobal = datos.length
  const alDiaGlobal = datos.filter(d => d.diferencia === 0).length
  const pendienteGlobal = datos.filter(d => d.diferencia > 0).length

  // ── Filtrar para la tabla ──
  let filtrados = datos.filter(d => {
    const coincideBusqueda =
      d.cliente_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.sede_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      d.instrumento_nombre.toLowerCase().includes(busqueda.toLowerCase())
    const coincideSede = sedeFiltro === 'todas' || d.sede_nombre === sedeFiltro
    return coincideBusqueda && coincideSede
  })

  if (filtro === 'al_dia') {
    filtrados = filtrados.filter(d => d.diferencia === 0)
  } else if (filtro === 'pendiente') {
    filtrados = filtrados.filter(d => d.diferencia > 0).sort((a, b) => a.diferencia - b.diferencia)
  }

  // ── Edición ──
  function getValor(plan: PlanActivo, campo: 'duracion_min' | 'conteo_whatsapp') {
    if (editados[plan.id] && campo in editados[plan.id]) {
      return editados[plan.id][campo] ?? ''
    }
    return campo === 'conteo_whatsapp'
      ? (plan.conteo_whatsapp !== null ? plan.conteo_whatsapp : '')
      : plan.duracion_min
  }

  function handleEditar(id: string, campo: 'duracion_min' | 'conteo_whatsapp', valor: string) {
    const num = valor === '' ? null : Number(valor)
    setEditados(prev => ({
      ...prev,
      [id]: { ...prev[id], [campo]: num }
    }))
  }

  async function guardarCambios() {
    setGuardando(true)
    setMensajeGuardado(null)
    const ids = Object.keys(editados)
    let errores = 0
    for (const id of ids) {
      const cambios = editados[id]
      const update: any = {}
      if ('duracion_min' in cambios && cambios.duracion_min !== null) update.duracion_min = cambios.duracion_min
      if ('conteo_whatsapp' in cambios) update.conteo_whatsapp = cambios.conteo_whatsapp
      if (Object.keys(update).length > 0) {
        const { error: err } = await supabase.from('contratos').update(update).eq('id', id)
        if (err) errores++
      }
    }
    setGuardando(false)
    setEditados({})
    setModoEdicion(false)
    if (errores === 0) {
      setMensajeGuardado('✅ Cambios guardados correctamente.')
    } else {
      setMensajeGuardado(`⚠️ ${errores} cambio(s) no se pudieron guardar.`)
    }
    await cargarDatos()
    setTimeout(() => setMensajeGuardado(null), 4000)
  }

  function cancelarEdicion() {
    setEditados({})
    setModoEdicion(false)
  }

  const hayCambios = Object.keys(editados).length > 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1300px', margin: '0 auto' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={onVolver}
          style={{
            background: TEAL_LIGHT, border: `1px solid ${TEAL_MID}`, borderRadius: '8px',
            padding: '6px 14px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600,
          }}
        >
          ← Reportes
        </button>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: TEAL_DARK, margin: 0, flex: 1 }}>
          📋 Clases tomadas por plan
        </h2>

        {/* Botones modo edición */}
        {!modoEdicion ? (
          <button
            onClick={() => setModoEdicion(true)}
            style={{
              background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '8px',
              padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: TEAL_DARK, fontWeight: 600,
            }}
          >
            ✏️ Modo edición
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={cancelarEdicion}
              style={{
                background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px',
                padding: '7px 16px', cursor: 'pointer', fontSize: '13px', color: '#64748b', fontWeight: 600,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={guardarCambios}
              disabled={!hayCambios || guardando}
              style={{
                background: hayCambios ? TEAL : '#a0c8c8', border: 'none', borderRadius: '8px',
                padding: '7px 18px', cursor: hayCambios ? 'pointer' : 'not-allowed',
                fontSize: '13px', color: '#fff', fontWeight: 700,
              }}
            >
              {guardando ? 'Guardando…' : `💾 Guardar${hayCambios ? ` (${Object.keys(editados).length})` : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* Mensaje guardado */}
      {mensajeGuardado && (
        <div style={{
          background: mensajeGuardado.startsWith('✅') ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${mensajeGuardado.startsWith('✅') ? '#bbf7d0' : '#fde68a'}`,
          borderRadius: '8px', padding: '10px 16px', marginBottom: '16px',
          fontSize: '14px', color: mensajeGuardado.startsWith('✅') ? '#166534' : '#92400e',
        }}>
          {mensajeGuardado}
        </div>
      )}

      {/* Aviso modo edición */}
      {modoEdicion && (
        <div style={{
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px',
          padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#92400e',
        }}>
          ✏️ Modo edición activo — puedes modificar <strong>Duración</strong> y <strong>Conteo WA</strong> directamente en la tabla. Pulsa <strong>Guardar</strong> cuando termines.
        </div>
      )}

      {/* Tarjetas resumen — siempre globales */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total planes activos', valor: totalGlobal, color: TEAL },
          { label: 'Conteo al día', valor: alDiaGlobal, color: '#16a34a' },
          { label: 'Conteo pendiente', valor: pendienteGlobal, color: '#d97706' },
        ].map(t => (
          <div key={t.label} style={{
            background: '#fff', border: `1.5px solid ${TEAL_MID}`, borderRadius: '10px',
            padding: '14px 20px', minWidth: '160px', flex: '1',
          }}>
            <div style={{ fontSize: '24px', fontWeight: 800, color: t.color }}>{cargando ? '…' : t.valor}</div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Filtro estado conteo */}
        {([
          { key: 'todos', label: '📋 Todos' },
          { key: 'al_dia', label: '✅ Conteo al día' },
          { key: 'pendiente', label: '⏳ Pendiente de ajustar' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            style={{
              padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              background: filtro === f.key ? TEAL : '#fff',
              color: filtro === f.key ? '#fff' : TEAL_DARK,
              border: `1.5px solid ${filtro === f.key ? TEAL : TEAL_MID}`,
            }}
          >
            {f.label}
          </button>
        ))}

        {/* Filtro sede */}
        <select
          value={sedeFiltro}
          onChange={e => setSedeFiltro(e.target.value)}
          style={{
            padding: '7px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
            border: `1.5px solid ${sedeFiltro !== 'todas' ? TEAL : TEAL_MID}`,
            background: sedeFiltro !== 'todas' ? TEAL_LIGHT : '#fff',
            color: sedeFiltro !== 'todas' ? TEAL_DARK : '#475569',
            cursor: 'pointer', outline: 'none',
          }}
        >
          {sedes.map(s => (
            <option key={s} value={s}>{s === 'todas' ? '🏢 Todas las sedes' : `🏢 ${s}`}</option>
          ))}
        </select>

        {/* Búsqueda */}
        <input
          type="text"
          placeholder="Buscar cliente o instrumento…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: '20px',
            border: `1.5px solid ${TEAL_MID}`, fontSize: '13px', outline: 'none',
            width: '220px', color: '#333',
          }}
        />
      </div>

      {/* Estado carga / error */}
      {cargando && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#999', fontSize: '15px' }}>
          Cargando datos…
        </div>
      )}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '16px', color: '#b91c1c', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Tabla */}
      {!cargando && !error && (
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1.5px solid ${TEAL_MID}`, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: TEAL, color: '#fff' }}>
                {['#', 'Cliente', 'Sede', 'Instrumento', 'Plan', 'Duración', 'Clases tomadas', 'Conteo WA', 'Diferencia'].map((h, i) => (
                  <th key={i} style={{
                    padding: '11px 14px', fontWeight: 700,
                    textAlign: i === 0 || i >= 4 ? 'center' : 'left',
                    whiteSpace: 'nowrap', fontSize: '12px', letterSpacing: '0.03em',
                  }}>
                    {h}{modoEdicion && (h === 'Duración' || h === 'Conteo WA') ? ' ✏️' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                    No hay planes que coincidan con el filtro.
                  </td>
                </tr>
              ) : (
                filtrados.map((plan, idx) => {
                  // Calcular diferencia con valores editados si existen
                  const durActual = editados[plan.id]?.duracion_min ?? plan.duracion_min
                  const waActual = 'conteo_whatsapp' in (editados[plan.id] ?? {})
                    ? editados[plan.id].conteo_whatsapp
                    : plan.conteo_whatsapp
                  const diff = waActual !== null && waActual !== undefined
                    ? plan.clases_tomadas - (waActual as number)
                    : plan.clases_tomadas
                  const diffColor = diff === 0 ? '#16a34a' : diff <= 2 ? '#d97706' : '#dc2626'
                  const diffBg = diff === 0 ? '#f0fdf4' : diff <= 2 ? '#fffbeb' : '#fef2f2'
                  const filaEditada = !!editados[plan.id]

                  return (
                    <tr
                      key={plan.id}
                      style={{
                        borderTop: `1px solid ${TEAL_LIGHT}`,
                        background: filaEditada ? '#fffde7' : idx % 2 === 0 ? '#fff' : '#fafefe',
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#999', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                        {plan.cliente_nombre}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {plan.sede_nombre}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {plan.instrumento_nombre}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>
                        {plan.total_clases}
                      </td>

                      {/* Duración — editable */}
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                        {modoEdicion ? (
                          <input
                            type="number"
                            value={getValor(plan, 'duracion_min')}
                            onChange={e => handleEditar(plan.id, 'duracion_min', e.target.value)}
                            style={{
                              width: '64px', padding: '5px 8px', borderRadius: '6px', textAlign: 'center',
                              border: `1.5px solid ${filaEditada && 'duracion_min' in (editados[plan.id] ?? {}) ? TEAL : TEAL_MID}`,
                              fontSize: '13px', outline: 'none', background: '#fff',
                            }}
                          />
                        ) : (
                          <span style={{ color: '#334155' }}>{plan.duracion_min} min</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 600 }}>
                        {plan.clases_tomadas}
                      </td>

                      {/* Conteo WA — editable */}
                      <td style={{ padding: '6px 14px', textAlign: 'center' }}>
                        {modoEdicion ? (
                          <input
                            type="number"
                            value={getValor(plan, 'conteo_whatsapp') === null ? '' : getValor(plan, 'conteo_whatsapp') as number}
                            onChange={e => handleEditar(plan.id, 'conteo_whatsapp', e.target.value)}
                            placeholder="—"
                            style={{
                              width: '64px', padding: '5px 8px', borderRadius: '6px', textAlign: 'center',
                              border: `1.5px solid ${filaEditada && 'conteo_whatsapp' in (editados[plan.id] ?? {}) ? TEAL : TEAL_MID}`,
                              fontSize: '13px', outline: 'none', background: '#fff',
                            }}
                          />
                        ) : (
                          plan.conteo_whatsapp !== null
                            ? <span style={{ color: '#334155' }}>{plan.conteo_whatsapp}</span>
                            : <span style={{ color: '#ccc' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{
                          background: diffBg, color: diffColor, borderRadius: '20px',
                          padding: '3px 12px', fontWeight: 700, fontSize: '13px', display: 'inline-block',
                        }}>
                          {diff === 0 ? '✓ 0' : `+${diff}`}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pie */}
      {!cargando && !error && filtrados.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#999', textAlign: 'right' }}>
          Mostrando {filtrados.length} de {datos.length} planes
        </div>
      )}
    </div>
  )
}
