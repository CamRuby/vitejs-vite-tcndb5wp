import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'

const LABELS: Record<string, string> = {
  crear_cliente:              '👤 Nuevo cliente',
  editar_cliente:             '✏️ Editar cliente',
  crear_plan:                 '📋 Nuevo plan',
  editar_plan:                '✏️ Editar plan',
  cambiar_estado_plan:        '🔄 Cambiar estado plan',
  registrar_abono:            '💰 Abono plan',
  registrar_abono_taller:     '💰 Abono taller',
  archivar_inscripcion_taller:'📦 Archivar inscripción taller',
  crear_clase:                '➕ Crear clase',
  editar_clase:               '📅 Editar clase',
  cambiar_estado_clase:       '🔄 Cambiar estado clase',
  borrar_clase:               '🗑 Borrar clase',
  editar_honorario:           '💵 Editar honorario',
  crear_taller:               '🎸 Crear taller',
  crear_taller_vacacional:    '🎸 Crear taller vacacional',
  sesion_taller_confirmada:   '✅ Confirmar sesión taller',
  sesion_taller_dada:         '✓ Sesión taller dada',
  sesion_taller_cancelada:    '✗ Sesión taller cancelada',
  inicio_sesion:              '🔑 Inicio de sesión',
}

const FIELD_LABELS: Record<string, string> = {
  cliente: 'Cliente', cliente_id: 'Cliente',
  profesor: 'Profesor', profesor_id: 'Profesor',
  fecha: 'Fecha', hora: 'Hora',
  de: 'De', a: 'A', motivo: 'Motivo', estado: 'Estado', nombre: 'Nombre',
  monto: 'Monto', metodo: 'Método', alcance: 'Alcance', cantidad: 'Cantidad',
  desde: 'Desde', hasta: 'Hasta', obs_admin: 'Obs. admin', honorario_valor: 'Honorario',
}

function isUUID(s: string) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function resolverValor(k: string, v: any, nombres: Record<string, string>): string | null {
  if (v === null || v === undefined) return null
  const vs = String(v)
  // Si es un UUID, intentar resolver con el mapa de nombres
  if (isUUID(vs)) return nombres[vs] || null
  return vs
}

function renderDetalle(detalle: Record<string, any> | null, nombres: Record<string, string>): string {
  if (!detalle) return '—'
  const parts: string[] = []
  for (const [k, v] of Object.entries(detalle)) {
    const resolved = resolverValor(k, v, nombres)
    if (resolved === null) continue
    const label = FIELD_LABELS[k] || k
    parts.push(`${label}: ${resolved}`)
  }
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function resumenLegible(r: any, nombres: Record<string, string>): string {
  const d = r.detalle || {}

  const clienteRaw = d.cliente || d.cliente_id
  const profesorRaw = d.profesor || d.profesor_id

  const cliente = clienteRaw ? (isUUID(String(clienteRaw)) ? nombres[clienteRaw] || null : clienteRaw) : null
  const profesor = profesorRaw ? (isUUID(String(profesorRaw)) ? nombres[profesorRaw] || null : profesorRaw) : null
  const fecha = d.fecha || null
  const hora = d.hora || null
  const nombre = d.nombre && !isUUID(String(d.nombre)) ? d.nombre : null

  if (cliente || profesor) {
    const partes: string[] = []
    if (cliente) partes.push(cliente)
    if (profesor) partes.push(`(${profesor})`)
    if (fecha) partes.push(fecha + (hora ? ` ${hora}` : ''))
    if (d.de && d.a) partes.push(`${d.de} → ${d.a}`)
    else if (d.estado) partes.push(d.estado)
    return partes.join(' · ')
  }
  if (nombre) return nombre
  if (fecha) return fecha
  return '—'
}

export default function Auditoria() {
  const [registros, setRegistros] = useState<any[]>([])
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [cargando, setCargando]   = useState(true)
  const [filtroUser, setFiltroUser] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [pagina, setPagina] = useState(0)
  const POR_PAGINA = 50

  useEffect(() => { cargar() }, [filtroUser, filtroAccion, pagina])

  async function cargar() {
    setCargando(true)
    let q = supabase.from('auditoria').select('*', { count: 'exact' })
      .order('fecha', { ascending: false })
      .range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)
    if (filtroUser) q = q.ilike('usuario_email', `%${filtroUser}%`)
    if (filtroAccion) q = q.eq('accion', filtroAccion)
    const { data } = await q
    const rows = data || []
    setRegistros(rows)

    // Recolectar todos los UUIDs de profesor_id y cliente_id en detalle
    const profIds = new Set<string>()
    const clienteIds = new Set<string>()
    for (const r of rows) {
      const d = r.detalle || {}
      if (d.profesor_id && isUUID(d.profesor_id)) profIds.add(d.profesor_id)
      if (d.cliente_id && isUUID(d.cliente_id)) clienteIds.add(d.cliente_id)
    }

    const mapa: Record<string, string> = {}
    const [profRes, clienteRes] = await Promise.all([
      profIds.size > 0
        ? supabase.from('profesores').select('id, nombre').in('id', [...profIds])
        : Promise.resolve({ data: [] }),
      clienteIds.size > 0
        ? supabase.from('clientes').select('id, nombre').in('id', [...clienteIds])
        : Promise.resolve({ data: [] }),
    ])
    for (const p of profRes.data || []) mapa[p.id] = p.nombre
    for (const c of clienteRes.data || []) mapa[c.id] = c.nombre
    setNombres(mapa)
    setCargando(false)
  }

  function formatFecha(f: string) {
    const d = new Date(f)
    return `${d.toLocaleDateString('es-CO')} ${d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
  }

  const acciones = Object.keys(LABELS)

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: '#1a1a1a' }}>Auditoría</h1>
        <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>Registro de acciones realizadas en el portal</p>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          placeholder="Filtrar por usuario..."
          value={filtroUser}
          onChange={e => { setFiltroUser(e.target.value); setPagina(0) }}
          style={{ padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', minWidth: '220px' }}
        />
        <select value={filtroAccion} onChange={e => { setFiltroAccion(e.target.value); setPagina(0) }}
          style={{ padding: '9px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', minWidth: '200px', color: filtroAccion ? '#1a1a1a' : '#888' }}>
          <option value="">Todas las acciones</option>
          {acciones.map(a => <option key={a} value={a}>{LABELS[a]}</option>)}
        </select>
        {(filtroUser || filtroAccion) && (
          <button onClick={() => { setFiltroUser(''); setFiltroAccion(''); setPagina(0) }}
            style={{ padding: '9px 16px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '14px' }}>
            ✕ Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #eef2f7', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: TEAL_LIGHT }}>
            <tr>
              {['Fecha y hora', 'Usuario', 'Acción', 'Resumen', 'Detalle'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '700' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Cargando...</td></tr>
            )}
            {!cargando && registros.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Sin registros</td></tr>
            )}
            {registros.map((r, i) => (
              <tr key={r.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                <td style={{ padding: '11px 16px', fontSize: '13px', color: '#888', whiteSpace: 'nowrap' }}>{formatFecha(r.fecha)}</td>
                <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: '500' }}>{r.usuario_email || '—'}</td>
                <td style={{ padding: '11px 16px', fontSize: '13px' }}>
                  <span style={{ padding: '3px 10px', background: TEAL_LIGHT, color: TEAL, borderRadius: '20px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {LABELS[r.accion] || r.accion}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: '600', color: '#1a1a1a' }}>
                  {resumenLegible(r, nombres)}
                </td>
                <td style={{ padding: '11px 16px', fontSize: '11px', color: '#888', maxWidth: '260px' }}>
                  {renderDetalle(r.detalle, nombres)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
        <button onClick={() => setPagina(p => Math.max(0, p-1))} disabled={pagina === 0}
          style={{ padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: pagina === 0 ? 'not-allowed' : 'pointer', color: pagina === 0 ? '#ccc' : '#555', fontSize: '14px' }}>
          ← Anterior
        </button>
        <span style={{ padding: '8px 16px', fontSize: '14px', color: '#888' }}>Página {pagina + 1}</span>
        <button onClick={() => setPagina(p => p+1)} disabled={registros.length < POR_PAGINA}
          style={{ padding: '8px 18px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: registros.length < POR_PAGINA ? 'not-allowed' : 'pointer', color: registros.length < POR_PAGINA ? '#ccc' : '#555', fontSize: '14px' }}>
          Siguiente →
        </button>
      </div>
    </div>
  )
}
