import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../supabase'

const TEAL       = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID   = '#b2d8d8'

type PlanTipo = 'archivo' | 'activo' | 'activo2'

type FilaExcel = {
  fecha: string
  grupo: string
  sede: string
  duracion: number
  numClase: string
  obs: string | null
  plan: PlanTipo
}

type Mapeo = {
  grupo: string
  clienteId: string | null
  clienteNombre: string | null
  ambiguo: boolean
}

type GrupoCliente = {
  grupo: string
  clienteId: string
  clienteNombre: string
  filasArchivo: FilaExcel[]
  filasActivo: FilaExcel[]
  filasActivo2: FilaExcel[]
  contratoArchivoId: string | null
  contratoActivoId: string | null
  contratoActivo2Id: string | null
}

type Resultado = { insertadas: number; saltadas: number; errores: string[] }

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
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, '0')
    const d = String(val.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.substring(0, 10)
  if (typeof val === 'number') {
    const d = new Date(Date.UTC(1899, 11, 30) + val * 86400000)
    return d.toISOString().substring(0, 10)
  }
  const mdy = String(val).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  return null
}

function parsePlan(val: any): PlanTipo {
  const s = String(val || '').trim().toLowerCase()
  if (s === 'activo 2' || s === 'activo2') return 'activo2'
  if (s === 'activo') return 'activo'
  return 'archivo'
}

function esInasistencia(obs: string | null) {
  if (!obs) return false
  return /no asisti|inasist/i.test(obs)
}

export default function Importar() {
  const [paso, setPaso]             = useState<'subir'|'mapear'|'preview'|'listo'>('subir')
  const [filas, setFilas]           = useState<FilaExcel[]>([])
  const [profesorNombre, setProfesorNombre] = useState('')
  const [profesorId, setProfesorId] = useState<string|null>(null)
  const [profesoresDB, setProfesoresDB] = useState<any[]>([])
  const [mapeos, setMapeos]         = useState<Mapeo[]>([])
  const [grupos, setGrupos]         = useState<GrupoCliente[]>([])
  const [resultado, setResultado]   = useState<Resultado|null>(null)
  const [cargando, setCargando]     = useState(false)
  const [error, setError]           = useState('')
  const [clientesDB, setClientesDB] = useState<any[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const salonCache = useRef<Record<string, string | null>>({})

  async function buscarSalonPorSede(sede: string): Promise<string | null> {
    const key = normalizar(sede.split(' ')[0])
    if (key in salonCache.current) return salonCache.current[key]
    const { data } = await supabase
      .from('salones')
      .select('id, sedes(nombre)')
      .ilike('sedes.nombre', `%${sede.split(' ')[0]}%`)
      .limit(1)
    const id = (data?.[0] as any)?.id || null
    salonCache.current[key] = id
    return id
  }

  async function handleFile(file: File) {
    setError(''); setCargando(true)
    salonCache.current = {}
    try {
      const ab = await file.arrayBuffer()
      const wb = XLSX.read(ab, { type: 'array', cellDates: true, UTC: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null })

      const profNombre = raw[1]?.[1] ? String(raw[1][1]).trim() : ''
      setProfesorNombre(profNombre)

      const parsed: FilaExcel[] = []
      for (let i = 3; i < raw.length; i++) {
        const r = raw[i]
        if (!r) continue
        if (!r[0] && !r[1]) continue
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
          plan: parsePlan(r[6]),
        })
      }
      setFilas(parsed)

      // Cargar TODOS los profesores y todos los clientes
      const [{ data: clientes }, { data: profesores }] = await Promise.all([
        supabase.from('clientes').select('id, nombre, grupo_whatsapp'),
        supabase.from('profesores').select('id, nombre').order('nombre')
      ])
      setClientesDB(clientes || [])
      setProfesoresDB(profesores || [])
      setProfesorId(null) // siempre requiere selección manual

      const gruposUnicos = [...new Set(parsed.map(f => f.grupo))]
      const nuevosMapeos: Mapeo[] = gruposUnicos.map(grupo => {
        const normGrupo = normalizar(grupo)
        let mejorCliente: any = null; let mejorScore = 0
        for (const c of (clientes || [])) {
          if (!c.grupo_whatsapp) continue
          const normDB = normalizar(c.grupo_whatsapp)
          const palabras = normGrupo.split(/[\s:,/]+/).filter((p: string) => p.length > 2)
          const hits = palabras.filter((p: string) => normDB.includes(p)).length
          const score = hits / Math.max(palabras.length, 1)
          if (score > mejorScore && score >= 0.5) { mejorScore = score; mejorCliente = c }
        }
        return { grupo, clienteId: mejorCliente?.id || null, clienteNombre: mejorCliente?.nombre || null, ambiguo: false }
      })
      setMapeos(nuevosMapeos)
      setPaso('mapear')
    } catch (e: any) {
      setError('Error al leer el archivo: ' + e.message)
    } finally {
      setCargando(false)
    }
  }

  async function generarPreview() {
    setCargando(true)
    const mapPorGrupo = Object.fromEntries(mapeos.map(m => [m.grupo, m]))
    const porCliente: Record<string, GrupoCliente> = {}
    for (const fila of filas) {
      const mapeo = mapPorGrupo[fila.grupo]
      if (!mapeo?.clienteId) continue
      const key = mapeo.clienteId
      if (!porCliente[key]) {
        porCliente[key] = {
          grupo: fila.grupo,
          clienteId: mapeo.clienteId,
          clienteNombre: mapeo.clienteNombre || '',
          filasArchivo: [], filasActivo: [], filasActivo2: [],
          contratoArchivoId: null, contratoActivoId: null, contratoActivo2Id: null
        }
      }
      if (fila.plan === 'activo') porCliente[key].filasActivo.push(fila)
      else if (fila.plan === 'activo2') porCliente[key].filasActivo2.push(fila)
      else porCliente[key].filasArchivo.push(fila)
    }
    setGrupos(Object.values(porCliente))
    setPaso('preview')
    setCargando(false)
  }

  async function importar() {
    setCargando(true)
    salonCache.current = {}
    let insertadas = 0; let saltadas = 0; const errores: string[] = []

    for (const gc of grupos) {

      async function procesarBloque(filasBloque: FilaExcel[], estado: 'archivado' | 'activo') {
        if (filasBloque.length === 0) return
        const filasOrdenadas = [...filasBloque].sort((a, b) => a.fecha.localeCompare(b.fecha))
        const fechaInicio = filasOrdenadas[0].fecha
        const fechaFin = filasOrdenadas[filasOrdenadas.length - 1].fecha
        const duracionComun = filasBloque[0].duracion
        const clasesDadas = estado === 'archivado'
          ? filasBloque
          : filasBloque.filter(f => !esInasistencia(f.obs) && !(f.numClase === '0' || f.numClase === '0.0' || /prueba|cortesia/i.test(f.obs || '')))
        const clasesTomadas = clasesDadas.length

        const { data: ct, error: ctErr } = await supabase.from('contratos').insert({
          cliente_id: gc.clienteId,
          profesor_id: profesorId,
          estado,
          duracion_min: duracionComun,
          total_clases: estado === 'activo' ? 0 : clasesTomadas,
          clases_tomadas: clasesTomadas,
          fecha_inicio: fechaInicio,
          fecha_fin: estado === 'archivado' ? fechaFin : null,
          importado: true,
        }).select().single()
        if (ctErr || !ct) { errores.push(`Error creando contrato ${gc.clienteNombre}: ${ctErr?.message}`); return }

        for (const fila of filasBloque) {
          const salonId = fila.sede ? await buscarSalonPorSede(fila.sede) : null
          const esArchivo = estado === 'archivado'
          const cortesia = esArchivo ? false : (fila.numClase === '0' || fila.numClase === '0.0' || /prueba|cortesia/i.test(fila.obs || ''))
          const inasist  = esArchivo ? false : esInasistencia(fila.obs)
          const { error: clErr } = await supabase.from('clases').insert({
            contrato_id: (ct as any).id,
            profesor_id: profesorId,
            salon_id: salonId,
            fecha: fila.fecha,
            hora: '00:00:00',
            duracion_min: fila.duracion,
            estado: inasist ? 'cancelada' : 'dada',
            es_cortesia: cortesia,
            cancelado_por_academia: inasist ? false : null,
            observaciones: fila.obs ? fila.obs : null,
            modalidad: fila.sede.toLowerCase().includes('domicilio') ? 'domicilio' : 'presencial',
          })
          if (clErr) { errores.push(`${fila.fecha} ${fila.grupo}: ${clErr.message}`); saltadas++ }
          else insertadas++
        }
      }

      await procesarBloque(gc.filasArchivo, 'archivado')
      await procesarBloque(gc.filasActivo, 'activo')
      await procesarBloque(gc.filasActivo2, 'activo')
    }

    setResultado({ insertadas, saltadas, errores })
    setPaso('listo')
    setCargando(false)
  }

  const sinMatch = filas.filter(f => {
    const m = mapeos.find(mp => mp.grupo === f.grupo)
    return !m?.clienteId
  }).length

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
      <div style={{ marginBottom: '20px', flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: '24px', color: '#1a1a1a' }}>Importar registro de clases</h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Sube el Excel de un profesor para alimentar el historial</p>
      </div>

      {/* Pasos */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexShrink: 0 }}>
        {[['1','Subir archivo','subir'],['2','Mapear clientes','mapear'],['3','Previsualizar','preview'],['4','Listo','listo']].map(([n, label, id]) => {
          const activo = paso === id
          const done = ['subir','mapear','preview','listo'].indexOf(paso) > ['subir','mapear','preview','listo'].indexOf(id)
          return (
            <div key={id} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <div style={{ width:'26px', height:'26px', borderRadius:'50%', background: activo ? TEAL : done ? '#86efac' : '#e2e8f0', color: activo ? 'white' : done ? '#166534' : '#94a3b8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'700' }}>
                {done ? '✓' : n}
              </div>
              <span style={{ fontSize:'13px', fontWeight: activo ? '700' : '400', color: activo ? TEAL : '#94a3b8' }}>{label}</span>
              {id !== 'listo' && <div style={{ width:'24px', height:'2px', background:'#e2e8f0', marginLeft:'2px' }} />}
            </div>
          )
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* PASO 1: Subir */}
        {paso === 'subir' && (
          <div>
            <div style={{ background: TEAL_LIGHT, borderRadius: '14px', padding: '20px 24px', marginBottom: '24px', maxWidth: '680px', border: `1px solid ${TEAL_MID}` }}>
              <p style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '700', color: TEAL }}>📋 Estructura requerida del Excel</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${TEAL_MID}` }}>
                    {['Celda/Col','Contenido','Ejemplo'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: TEAL, fontWeight: '700', fontSize: '11px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['B2', 'Nombre del profesor', 'Rafael Ernesto'],
                    ['A (desde fila 4)', 'Fecha de la clase', '15/04/2026'],
                    ['B', 'Nombre del grupo (debe coincidir con campo "Grupo WhatsApp" del cliente)', 'Ch. Monserrat Piano'],
                    ['C', 'Sede', 'Chicó'],
                    ['D', 'Duración', '60 o 45min o 30'],
                    ['E', 'Número de clase (0 = cortesía)', '1, 2, 3... o 0'],
                    ['F', 'Observaciones (opcional)', 'No asistió · reemplaz'],
                    ['G', 'Plan: vacío/"Archivo", "Activo" o "Activo 2"', 'Activo'],
                  ].map(([col, desc, ej]) => (
                    <tr key={col} style={{ borderBottom: '1px solid #d1eded' }}>
                      <td style={{ padding: '5px 8px', fontWeight: '700', color: TEAL, whiteSpace: 'nowrap' }}>{col}</td>
                      <td style={{ padding: '5px 8px', color: '#374151' }}>{desc}</td>
                      <td style={{ padding: '5px 8px', color: '#888', fontStyle: 'italic' }}>{ej}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>• <strong>Archivo / vacío</strong> → historial, se archiva automáticamente, numeración no importa</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>• <strong>Activo</strong> → plan vigente, <code>clases_tomadas</code> se calcula, completar <code>total_clases</code> desde Clientes</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#555' }}>• <strong>Activo 2</strong> → segundo plan vigente simultáneo</p>
              </div>
            </div>

            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <div onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${TEAL_MID}`, borderRadius: '14px', padding: '40px', textAlign: 'center', cursor: 'pointer', background: 'white', maxWidth: '480px' }}>
              <p style={{ fontSize: '36px', margin: '0 0 8px' }}>📂</p>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: TEAL }}>Haz clic para seleccionar el archivo</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>.xlsx o .xls</p>
            </div>
            {cargando && <p style={{ color: TEAL, marginTop: '12px', fontSize: '14px' }}>Leyendo archivo...</p>}
            {error && <p style={{ color: '#dc2626', marginTop: '12px', fontSize: '13px' }}>{error}</p>}
          </div>
        )}

        {/* PASO 2: Mapear */}
        {paso === 'mapear' && (
          <div>
            {/* Selector de profesor — confirmación manual obligatoria */}
            <div style={{ background: 'white', borderRadius: '12px', border: `2px solid ${profesorId ? TEAL_MID : '#fca5a5'}`, padding: '16px 20px', marginBottom: '20px', maxWidth: '700px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: profesorId ? TEAL : '#dc2626' }}>
                {profesorId ? '✓ Profesor confirmado' : '⚠ Confirma el profesor antes de continuar'}
              </p>
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#666' }}>
                El Excel indica: <strong>"{profesorNombre}"</strong> — selecciona el profesor correcto en la lista:
              </p>
              <select
                value={profesorId || ''}
                onChange={e => setProfesorId(e.target.value || null)}
                style={{ width: '100%', padding: '9px 12px', border: `1px solid ${profesorId ? TEAL_MID : '#fca5a5'}`, borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
              >
                <option value="">— Selecciona el profesor —</option>
                {profesoresDB.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', maxWidth: '700px', fontSize: '13px', color: '#374151' }}>
              <strong>{filas.length}</strong> filas leídas &nbsp;·&nbsp;
              <strong style={{ color: '#854d0e' }}>{filas.filter(f=>f.plan==='archivo').length}</strong> archivo &nbsp;·&nbsp;
              <strong style={{ color: TEAL }}>{filas.filter(f=>f.plan==='activo').length}</strong> activo &nbsp;·&nbsp;
              <strong style={{ color: '#7c3aed' }}>{filas.filter(f=>f.plan==='activo2').length}</strong> activo 2
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'auto', marginBottom: '16px', maxHeight: '420px', maxWidth: '700px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: TEAL_LIGHT }}>
                  <tr>
                    {['Grupo (Excel)', 'Cliente', 'Filas', 'Estado'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '11px', color: TEAL, fontWeight: '700' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapeos.map((m, idx) => {
                    const filasGrupo = filas.filter(f => f.grupo === m.grupo)
                    const nArch = filasGrupo.filter(f => f.plan === 'archivo').length
                    const nAct  = filasGrupo.filter(f => f.plan === 'activo').length
                    const nAct2 = filasGrupo.filter(f => f.plan === 'activo2').length
                    return (
                      <tr key={idx} style={{ borderTop: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td style={{ padding: '8px 12px', fontSize: '12px', maxWidth: '200px' }}>{m.grupo}</td>
                        <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                          <select value={m.clienteId || ''} onChange={e => {
                            const cliId = e.target.value
                            const cli = clientesDB.find((c: any) => c.id === cliId)
                            setMapeos(prev => prev.map((mp, i) => i === idx ? { ...mp, clienteId: cliId || null, clienteNombre: cli?.nombre || null } : mp))
                          }} style={{ padding: '4px 8px', border: `1px solid ${m.clienteId ? TEAL_MID : '#fca5a5'}`, borderRadius: '6px', fontSize: '12px', maxWidth: '200px' }}>
                            <option value="">— Sin match —</option>
                            {clientesDB.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', color: '#666' }}>
                          {nArch > 0 && <span style={{ marginRight: '6px' }}>📦 {nArch} arch.</span>}
                          {nAct  > 0 && <span style={{ marginRight: '6px', color: TEAL }}>✓ {nAct} activo</span>}
                          {nAct2 > 0 && <span style={{ color: '#7c3aed' }}>✓ {nAct2} activo 2</span>}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          {m.clienteId ? badge('✓ Mapeado', '#166534', '#dcfce7') : badge('Sin match', '#991b1b', '#fee2e2')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {btn('← Volver', () => setPaso('subir'), false, '#94a3b8')}
              {btn(cargando ? 'Procesando...' : 'Ver previsualización →', generarPreview, cargando || !profesorId)}
            </div>
          </div>
        )}

        {/* PASO 3: Preview */}
        {paso === 'preview' && (
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: '#f1f5f9', borderRadius: '10px', padding: '12px 18px', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Clientes</p>
                <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#374151' }}>{grupos.length}</p>
              </div>
              <div style={{ background: '#fff7ed', borderRadius: '10px', padding: '12px 18px', border: '1px solid #fed7aa' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#92400e', fontWeight: '700', textTransform: 'uppercase' }}>📦 Contratos archivo</p>
                <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#92400e' }}>{grupos.filter(g => g.filasArchivo.length > 0).length}</p>
              </div>
              <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 18px', border: `1px solid ${TEAL_MID}` }}>
                <p style={{ margin: 0, fontSize: '11px', color: TEAL, fontWeight: '700', textTransform: 'uppercase' }}>✓ Contratos activos</p>
                <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: TEAL }}>
                  {grupos.filter(g => g.filasActivo.length > 0).length + grupos.filter(g => g.filasActivo2.length > 0).length}
                </p>
              </div>
              <div style={{ background: '#dcfce7', borderRadius: '10px', padding: '12px 18px', border: '1px solid #bbf7d0' }}>
                <p style={{ margin: 0, fontSize: '11px', color: '#166534', fontWeight: '700', textTransform: 'uppercase' }}>Total clases</p>
                <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#166534' }}>{filas.filter(f => mapeos.find(m => m.grupo === f.grupo)?.clienteId).length}</p>
              </div>
              {sinMatch > 0 && (
                <div style={{ background: '#fee2e2', borderRadius: '10px', padding: '12px 18px', border: '1px solid #fecaca' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: '#991b1b', fontWeight: '700', textTransform: 'uppercase' }}>Sin match</p>
                  <p style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: '800', color: '#991b1b' }}>{sinMatch}</p>
                </div>
              )}
            </div>

            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'auto', marginBottom: '16px', maxHeight: '420px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: TEAL_LIGHT, position: 'sticky', top: 0 }}>
                  <tr>
                    {['Cliente', 'Historial (archivo)', 'Plan activo', 'Plan activo 2'].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '11px', color: TEAL, fontWeight: '700' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: '600' }}>{g.clienteNombre}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#92400e' }}>
                        {g.filasArchivo.length > 0
                          ? <>{g.filasArchivo.length} clases · {g.filasArchivo.length} dadas</>
                          : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: TEAL }}>
                        {g.filasActivo.length > 0
                          ? <>{g.filasActivo.length} clases · {g.filasActivo.filter(f => !esInasistencia(f.obs) && !(f.numClase === '0' || f.numClase === '0.0' || /prueba|cortesia/i.test(f.obs || ''))).length} dadas</>
                          : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#7c3aed' }}>
                        {g.filasActivo2.length > 0
                          ? <>{g.filasActivo2.length} clases · {g.filasActivo2.filter(f => !esInasistencia(f.obs) && !(f.numClase === '0' || f.numClase === '0.0' || /prueba|cortesia/i.test(f.obs || ''))).length} dadas</>
                          : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {btn('← Volver', () => setPaso('mapear'), false, '#94a3b8')}
              {btn(cargando ? 'Importando...' : `✓ Importar`, importar, cargando || grupos.length === 0)}
            </div>
          </div>
        )}

        {/* PASO 4: Listo */}
        {paso === 'listo' && resultado && (
          <div style={{ maxWidth: '480px' }}>
            <div style={{ background: '#dcfce7', borderRadius: '16px', padding: '28px', border: '1px solid #bbf7d0', textAlign: 'center', marginBottom: '20px' }}>
              <p style={{ fontSize: '40px', margin: '0 0 8px' }}>✅</p>
              <h3 style={{ margin: '0 0 6px', color: '#166534', fontSize: '20px' }}>Importación completada</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#166534' }}>
                <strong>{resultado.insertadas}</strong> clases insertadas · <strong>{resultado.saltadas}</strong> saltadas
              </p>
            </div>
            <div style={{ background: TEAL_LIGHT, borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', border: `1px solid ${TEAL_MID}`, fontSize: '13px', color: '#374151' }}>
              <p style={{ margin: '0 0 6px', fontWeight: '700', color: TEAL }}>Próximos pasos:</p>
              <p style={{ margin: '2px 0' }}>1. Ve a <strong>Clientes</strong> y completa el campo <strong>Total clases</strong> en los planes activos importados</p>
              <p style={{ margin: '2px 0' }}>2. Verifica que el instrumento y la sede queden correctos</p>
            </div>
            {resultado.errores.length > 0 && (
              <div style={{ background: '#fff7ed', borderRadius: '12px', padding: '16px', border: '1px solid #fed7aa', marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '700', color: '#c2410c' }}>⚠ {resultado.errores.length} errores:</p>
                {resultado.errores.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: '12px', color: '#92400e' }}>{e}</p>)}
              </div>
            )}
            {btn('← Importar otro archivo', () => { setPaso('subir'); setFilas([]); setMapeos([]); setGrupos([]); setResultado(null); setError('') })}
          </div>
        )}

      </div>
    </div>
  )
}
