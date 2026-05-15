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
  editar_clase:               '📅 Editar clase',
  borrar_clase:               '🗑 Borrar clase',
  editar_honorario:           '💵 Editar honorario',
  crear_taller:               '🎸 Crear taller',
  sesion_taller_confirmada:   '✅ Confirmar sesión taller',
  sesion_taller_dada:         '✓ Sesión taller dada',
  sesion_taller_cancelada:    '✗ Sesión taller cancelada',
}

export default function Auditoria() {
  const [registros, setRegistros] = useState<any[]>([])
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
    setRegistros(data || [])
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
              {['Fecha y hora', 'Usuario', 'Acción', 'Entidad', 'Detalle'].map(h => (
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
                <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555' }}>{r.entidad || '—'}</td>
                <td style={{ padding: '11px 16px', fontSize: '12px', color: '#666', maxWidth: '300px' }}>
                  {r.detalle ? Object.entries(r.detalle).map(([k, v]) => (
                    <span key={k} style={{ display: 'inline-block', marginRight: '8px', marginBottom: '2px' }}>
                      <span style={{ color: '#aaa' }}>{k}:</span> {String(v)}
                    </span>
                  )) : '—'}
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
