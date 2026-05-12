import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'

const TEAL       = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID   = '#b2d8d8'

// ── Tipos ──────────────────────────────────────────────────────────────────────
type FilaExcel = {
  fecha: string
  grupo: string
  sede: string
  duracion: number
  numClase: string
  obs: string | null
}

type Mapeo = {
  grupo: string
  clienteId: string | null
  contratoId: string | null
  clienteNombre: string | null
  contratoDesc: string | null
  ambiguo: boolean
}

type FilaConEstado = FilaExcel & {
  contratoId: string | null
  estadoFila: 'nueva' | 'duplicada' | 'sin_match'
  esCortesia: boolean
  esInasistencia: boolean
}

type Resultado = { insertadas: number; saltadas: number; errores: string[] }

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDuracion(s: string): number {
  const m = String(s).match(/(\d+)/)
  return m ? parseInt(m[1]) : 60
}

function normalizar(s: string) {
  return s.toLowerCase()
    .replace(/^ch\.?\s*/i, '').replace(/^r\.?\s*/i, '')
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
    .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
    .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ').trim()
}

function excelDateToISO(val: any): string | null {
  if (!val) return null
  // JS Date from SheetJS cellDates:true — use UTC to avoid timezone offset
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const d = String(val.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  // ISO string
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10)
  // Excel serial number (e.g. 46036)
  if (typeof val === 'number') {
    // Excel epoch: Dec 30, 1899 (accounting for Lotus 1-2-3 bug)
    const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000)
    return d.toISOString().substring(0, 10)
  }
  // String formats: MM/DD/YYYY or DD/MM/YYYY
  const mdy = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  return null
}

function esInasistencia(obs: string | null) {
  if (!obs) return false
  return /no asisti|inasist/i.test(obs)
}

function esCortesiaObs(numClase: string, obs: string | null) {
  if (numClase === '0' || numClase === '0.0') return true
  if (obs && /reemplaz|prueba|cortesia/i.test(obs)) return true
  return false
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function Importar() {
  const [paso, setPaso]             = useState<'subir'|'mapear'|'preview'|'listo'>('subir')
  const [filas, setFilas]           = useState<FilaExcel[]>([])
  const [profesorNombre, setProfesorNombre] = useState('')
  const [profesorId, setProfesorId] = useState<string|null>(null)
  const [mapeos, setMapeos]         = useState<Mapeo[]>([])
  const [preview, setPreview]       = useState<FilaConEstado[]>([])
  const [resultado, setResultado]   = useState<Resultado|null>(null)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState('')
  const [clientesDB, setClientesDB] = useState<any[]>([])
  const [contratosDB, setContratosDB] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Paso 1: Parsear Excel ────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setError('')
    setCargando(true)
    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array', cellDates: true, UTC: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })

      // Extraer nombre del profesor (fila 1, col 1)
      const profNombre = raw[1]?.[1] ? String(raw[1][1]).trim() : ''
      setProfesorNombre(profNombre)

      // Parsear filas de datos (desde fila 3)
      const parsed: FilaExcel[] = []
      for (let i = 3; i < raw.length; i++) {
        const r = raw[i]
        if (!r || !r[0]) continue
        const fecha = excelDateToISO(r[0])
        if (!fecha) continue
        const grupo = String(r[1] || '').trim()
        if (!grupo) continue
        parsed.push({
          fecha,
          grupo,
          sede: String(r[2] || '').trim(),
          duracion: parseDuracion(String(r[3] || '60')),
          numClase: String(r[4] || '0').trim(),
          obs: r[5] ? String(r[5]).trim() : null,
        })
      }
      setFilas(parsed)

      // Cargar clientes y contratos de Supabase
      const [{ data: clientes }, { data: contratos }, { data: profesores }] = await Promise.all([
        supabase.from('clientes').select('id, nombre, grupo_whatsapp'),
        supabase.from('contratos').select('id, cliente_id, profesor_id, estado, clases_tomadas, duracion_min, total_clases, instrumentos(nombre)').in('estado', ['activo','completado']),
        supabase.from('profesores').select('id, nombre').ilike('nombre', `%${profNombre.split(' ')[0]}%`)
      ])

      setClientesDB(clientes || [])
      setContratosDB(contratos || [])

      // Resolver profesor_id
      const prof = (profesores || []).find((p: any) =>
        normalizar(p.nombre).includes(normalizar(profNombre.split(' ')[0]))
      )
      setProfesorId(prof?.id || null)

      // Mapear grupos únicos
      const grupos = [...new Set(parsed.map(f => f.grupo))]
      const nuevosMapeos: Mapeo[] = grupos.map(grupo => {
        const normGrupo = normalizar(grupo)
        // Buscar cliente cuyo grupo_whatsapp coincida
        let mejorCliente: any = null
        let mejorScore = 0
        for (const c of (clientes || [])) {
          if (!c.grupo_whatsapp) continue
          const normDB = normalizar(c.grupo_whatsapp)
          // Score: cuántas palabras del grupo Excel están en el DB
          const palabrasExcel = normGrupo.split(/[\s:,/]+/).filter(p => p.length > 2)
          const hits = palabrasExcel.filter(p => normDB.includes(p)).length
          const score = hits / Math.max(palabrasExcel.length, 1)
          if (score > mejorScore && score >= 0.5) { mejorScore = score; mejorCliente = c }
        }

        if (!mejorCliente) return { grupo, clienteId: null, contratoId: null, clienteNombre: null, contratoDesc: null, ambiguo: false }

        // Buscar contrato activo del cliente con este profesor
        const ctsByCli = (contratos || []).filter((ct: any) =>
          ct.cliente_id === mejorCliente.id && ct.profesor_id === prof?.id
        )
        const ct = ctsByCli.find((c: any) => c.estado === 'activo') || ctsByCli[0] || null
        return {
          grupo,
          clienteId: mejorCliente.id,
          contratoId: ct?.id || null,
          clienteNombre: mejorCliente.nombre,
          contratoDesc: ct ? `${ct.instrumentos?.nombre || '—'} · ${ct.total_clases} clases` : null,
          ambiguo: ctsByCli.length > 1,
        }
      })
      setMapeos(nuevosMapeos)
      setPaso('mapear')
    } catch (e: any) {
      setError('Error al leer el archivo: ' + e.message)
    } finally {
      setCargando(false)
    }
  }

  // ── Paso 2 → 3: Generar preview ──────────────────────────────────────────────
  async function generarPreview() {
    setCargando(true)
    const mapeoPorGrupo = Object.fromEntries(mapeos.map(m => [m.grupo, m]))

    // Cargar clases existentes para detectar duplicados
    const contratoIds = [...new Set(mapeos.map(m => m.contratoId).filter(Boolean))]
    let clasesExistentes: any[] = []
    if (contratoIds.length > 0) {
      const { data } = await supabase.from('clases')
        .select('contrato_id, fecha, duracion_min, estado')
        .in('contrato_id', contratoIds)
        .eq('hora', '00:00:00')  // Solo clases importadas (hora genérica)
      clasesExistentes = data || []
    }

    // Contar existentes por (contrato+fecha+duracion)
    const keyCount: Record<string, number> = {}
    for (const c of clasesExistentes) {
      const k = `${c.contrato_id}|${c.fecha}|${c.duracion_min}`
      keyCount[k] = (keyCount[k] || 0) + 1
    }

    // Construir filas con estado
    const importCount: Record<string, number> = {}
    const resultado: FilaConEstado[] = filas.map(fila => {
      const mapeo = mapeoPorGrupo[fila.grupo]
      const contratoId = mapeo?.contratoId || null
      const cortesia = esCortesiaObs(fila.numClase, fila.obs)
      const inasist = esInasistencia(fila.obs)

      if (!contratoId) return { ...fila, contratoId: null, estadoFila: 'sin_match', esCortesia: cortesia, esInasistencia: inasist }

      const k = `${contratoId}|${fila.fecha}|${fila.duracion}`
      importCount[k] = (importCount[k] || 0) + 1
      const yaHayN = keyCount[k] || 0
      const estadoFila = importCount[k] <= yaHayN ? 'duplicada' : 'nueva'

      return { ...fila, contratoId, estadoFila, esCortesia: cortesia, esInasistencia: inasist }
    })

    setPreview(resultado)
    setPaso('preview')
    setCargando(false)
  }

  // ── Paso 3 → 4: Importar ────────────────────────────────────────────────────
  async function importar() {
    setCargando(true)
    const nuevas = preview.filter(f => f.estadoFila === 'nueva')
    let insertadas = 0; let saltadas = 0; const errores: string[] = []

    // Agrupar por contrato para actualizar clases_tomadas al final
    const contratosTocados = new Set<string>()

    for (const fila of nuevas) {
      if (!fila.contratoId || !profesorId) { saltadas++; continue }
      try {
        const estadoClase = fila.esInasistencia ? 'cancelada' : 'dada'
        const { error } = await supabase.from('clases').insert({
          contrato_id: fila.contratoId,
          profesor_id: profesorId,
          fecha: fila.fecha,
          hora: '00:00:00',
          duracion_min: fila.duracion,
          estado: estadoClase,
          es_cortesia: fila.esCortesia,
          cancelado_por_academia: fila.esInasistencia ? false : null,
          observaciones: fila.obs && !fila.esInasistencia ? fila.obs : null,
          modalidad: fila.sede.toLowerCase().includes('domicilio') ? 'domicilio' : 'presencial',
        })
        if (error) throw error
        insertadas++
        if (!fila.esCortesia && !fila.esInasistencia) contratosTocados.add(fila.contratoId)
      } catch (e: any) {
        errores.push(`${fila.fecha} ${fila.grupo}: ${e.message}`)
        saltadas++
      }
    }

    // Recalcular clases_tomadas para contratos tocados
    for (const ctId of contratosTocados) {
      const ct = contratosDB.find((c: any) => c.id === ctId)
      if (!ct) continue
      const { data: clasesDelCt } = await supabase.from('clases')
        .select('duracion_min, estado, es_cortesia')
        .eq('contrato_id', ctId)
        .eq('estado', 'dada')
        .neq('es_cortesia', true)
      const durPlan = ct.duracion_min || 60
      const tomadas = (clasesDelCt || []).reduce((s: number, c: any) =>
        s + parseFloat(((c.duracion_min || durPlan) / durPlan).toFixed(4)), 0)
      await supabase.from('contratos').update({ clases_tomadas: parseFloat(tomadas.toFixed(4)) }).eq('id', ctId)
    }

    setResultado({ insertadas, saltadas: saltadas + preview.filter(f => f.estadoFila === 'duplicada').length, errores })
    setPaso('listo')
    setCargando(false)
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────
  const nuevas    = preview.filter(f => f.estadoFila === 'nueva').length
  const duplicadas = preview.filter(f => f.estadoFila === 'duplicada').length
  const sinMatch  = preview.filter(f => f.estadoFila === 'sin_match').length

  const btn = (label: string, onClick: () => void, disabled = false, color = TEAL) => (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: '10px 24px', background: disabled ? '#cbd5e1' : color, color: 'white', border: 'none', borderRadius: '10px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit' }}>
      {label}
    </button>
  )

  const badge = (text: string, color: string, bg: string) => (
    <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', color, background: bg, whiteSpace: 'nowrap' }}>{text}</span>
  )

  return (
    <div style={{ padding: '24px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a' }}>Importar registro de clases</h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Sube el Excel de AppSheet de un profesor para alimentar el historial</p>
      </div>

      {/* Pasos */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexShrink: 0 }}>
        {[['1', 'Subir archivo', 'subir'], ['2', 'Mapear clientes', 'mapear'], ['3', 'Previsualizar', 'preview'], ['4', 'Listo', 'listo']].map(([n, label, id]) => {
          const activo = paso === id
          const hecho  = ['subir','mapear','preview','listo'].indexOf(paso) > ['subir','mapear','preview','listo'].indexOf(id as any)
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: activo ? TEAL : hecho ? '#dcfce7' : '#f1f5f9', color: activo ? 'white' : hecho ? '#166534' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>{hecho ? '✓' : n}</div>
              <span style={{ fontSize: '13px', color: activo ? TEAL : '#94a3b8', fontWeight: activo ? '600' : '400' }}>{label}</span>
              {n !== '4' && <span style={{ color: '#cbd5e1', margin: '0 4px' }}>›</span>}
            </div>
          )
        })}
      </div>

      {error && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#991b1b', flexShrink: 0 }}>{error}</div>}

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── PASO 1: Subir ── */}
        {paso === 'subir' && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            style={{ border: `2px dashed ${TEAL_MID}`, borderRadius: '16px', padding: '48px', textAlign: 'center', cursor: 'pointer', background: TEAL_LIGHT, maxWidth: '500px' }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            <p style={{ fontSize: '36px', margin: '0 0 12px' }}>📊</p>
            <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '600', color: TEAL }}>
              {cargando ? 'Procesando...' : 'Arrastra el Excel aquí o haz clic para seleccionar'}
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: '#888' }}>Archivos .xlsx del registro de AppSheet</p>
          </div>
        )}

        {/* ── PASO 2: Mapear ── */}
        {paso === 'mapear' && (
          <div>
            <div style={{ background: TEAL_LIGHT, borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <span>👤 Profesor: <strong>{profesorNombre}</strong> {profesorId ? '✓' : <span style={{ color: '#dc2626' }}>⚠ No encontrado en BD</span>}</span>
              <span>📋 Filas: <strong>{filas.length}</strong></span>
              <span>👥 Grupos únicos: <strong>{mapeos.length}</strong></span>
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: TEAL_LIGHT }}>
                    {['Grupo WhatsApp (Excel)', 'Cliente encontrado', 'Contrato', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '11px', color: TEAL, fontWeight: '700' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapeos.map((m, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '8px 12px', fontSize: '12px', maxWidth: '220px' }}>{m.grupo}</td>
                      <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                        {m.clienteId ? (
                          <select value={m.clienteId} onChange={e => {
                            const cliId = e.target.value
                            const cli = clientesDB.find((c: any) => c.id === cliId)
                            const cts = contratosDB.filter((c: any) => c.cliente_id === cliId && c.profesor_id === profesorId)
                            const ct = cts.find((c: any) => c.estado === 'activo') || cts[0]
                            setMapeos(prev => prev.map((mp, i) => i === idx ? { ...mp, clienteId: cliId, clienteNombre: cli?.nombre || '', contratoId: ct?.id || null, contratoDesc: ct ? `${ct.instrumentos?.nombre || '—'} · ${ct.total_clases} clases` : null } : mp))
                          }} style={{ padding: '4px 8px', border: `1px solid ${TEAL_MID}`, borderRadius: '6px', fontSize: '12px', maxWidth: '180px' }}>
                            {clientesDB.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        ) : (
                          <select onChange={e => {
                            const cliId = e.target.value
                            const cli = clientesDB.find((c: any) => c.id === cliId)
                            const cts = contratosDB.filter((c: any) => c.cliente_id === cliId && c.profesor_id === profesorId)
                            const ct = cts.find((c: any) => c.estado === 'activo') || cts[0]
                            setMapeos(prev => prev.map((mp, i) => i === idx ? { ...mp, clienteId: cliId, clienteNombre: cli?.nombre || '', contratoId: ct?.id || null, contratoDesc: ct ? `${ct.instrumentos?.nombre || '—'} · ${ct.total_clases} clases` : null } : mp))
                          }} style={{ padding: '4px 8px', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#991b1b', maxWidth: '180px' }}>
                            <option value="">— Sin match —</option>
                            {clientesDB.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '12px', color: m.contratoId ? '#333' : '#aaa' }}>
                        {m.contratoDesc || '—'}
                        {m.ambiguo && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#f59e0b' }}>⚠ múltiples</span>}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {m.clienteId && m.contratoId ? badge('✓ Listo', '#166534', '#dcfce7') :
                         m.clienteId && !m.contratoId ? badge('Sin contrato', '#92400e', '#fef3c7') :
                         badge('Sin match', '#991b1b', '#fee2e2')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {btn('← Volver', () => setPaso('subir'), false, '#94a3b8')}
              {btn(cargando ? 'Procesando...' : 'Ver previsualización →', generarPreview, cargando || !profesorId)}
            </div>
          </div>
        )}

        {/* ── PASO 3: Preview ── */}
        {paso === 'preview' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: '#dcfce7', borderRadius: '10px', padding: '10px 16px', border: '1px solid #bbf7d0' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Nuevas a insertar</p>
                <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#166534' }}>{nuevas}</p>
              </div>
              <div style={{ background: '#f1f5f9', borderRadius: '10px', padding: '10px 16px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Ya existían</p>
                <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#64748b' }}>{duplicadas}</p>
              </div>
              {sinMatch > 0 && (
                <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '10px 16px', border: '1px solid #fed7aa' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#c2410c', fontWeight: '700', textTransform: 'uppercase' }}>Sin match</p>
                  <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#c2410c' }}>{sinMatch}</p>
                </div>
              )}
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'auto', marginBottom: '16px', maxHeight: '420px' }}>
              <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
                  <tr>
                    {['Estado', 'Fecha', 'Grupo', 'Duración', 'Clase #', 'Tipo', 'Observaciones'].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: TEAL, fontWeight: '700', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((f, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9', background: f.estadoFila === 'duplicada' ? '#f8fafc' : f.estadoFila === 'sin_match' ? '#fff7ed' : 'white' }}>
                      <td style={{ padding: '6px 10px' }}>
                        {f.estadoFila === 'nueva'      ? badge('Nueva', '#166534', '#dcfce7') :
                         f.estadoFila === 'duplicada'  ? badge('Duplicada', '#64748b', '#f1f5f9') :
                         badge('Sin match', '#c2410c', '#fff7ed')}
                      </td>
                      <td style={{ padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}>{f.fecha}</td>
                      <td style={{ padding: '6px 10px', fontSize: '12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.grupo}</td>
                      <td style={{ padding: '6px 10px', fontSize: '12px' }}>{f.duracion} min</td>
                      <td style={{ padding: '6px 10px', fontSize: '12px', textAlign: 'center' }}>{f.numClase}</td>
                      <td style={{ padding: '6px 10px', fontSize: '12px' }}>
                        {f.esInasistencia ? badge('Inasistencia', '#c2410c', '#fff7ed') :
                         f.esCortesia     ? badge('Cortesía', '#0369a1', '#e0f2fe') :
                         badge('Dada', '#854d0e', '#fefce8')}
                      </td>
                      <td style={{ padding: '6px 10px', fontSize: '12px', color: '#888', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.obs || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {btn('← Volver', () => setPaso('mapear'), false, '#94a3b8')}
              {btn(cargando ? 'Importando...' : `✓ Importar ${nuevas} clases`, importar, cargando || nuevas === 0)}
            </div>
          </div>
        )}

        {/* ── PASO 4: Listo ── */}
        {paso === 'listo' && resultado && (
          <div style={{ maxWidth: '480px' }}>
            <div style={{ background: '#dcfce7', borderRadius: '16px', padding: '28px', border: '1px solid #bbf7d0', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '40px', margin: '0 0 8px' }}>✅</p>
              <h3 style={{ margin: '0 0 6px', color: '#166534', fontSize: '20px' }}>Importación completada</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>
                <strong>{resultado.insertadas}</strong> clases insertadas · <strong>{resultado.saltadas}</strong> saltadas
              </p>
            </div>
            {resultado.errores.length > 0 && (
              <div style={{ background: '#fff7ed', borderRadius: '12px', padding: '16px', border: '1px solid #fed7aa', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#c2410c' }}>⚠ {resultado.errores.length} errores:</p>
                {resultado.errores.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: '12px', color: '#92400e' }}>{e}</p>)}
              </div>
            )}
            {btn('← Importar otro archivo', () => { setPaso('subir'); setFilas([]); setMapeos([]); setPreview([]); setResultado(null); setError('') })}
          </div>
        )}

      </div>
    </div>
  )
}
