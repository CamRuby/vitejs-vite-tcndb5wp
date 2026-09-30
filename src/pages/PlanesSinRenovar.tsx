// src/pages/PlanesSinRenovar.tsx
// Inicio → Planes completados sin renovar, por sede (Rosales, Chicó, Tunja).
// Entran: planes "completado" y planes "activo" que ya consumieron todas sus clases,
// de clientes que no están inactivos. Todas las fechas (sin corte).
// Orden: última clase dada más reciente arriba.
// Casilla "Gestionado" (con filtro para mostrar u ocultar gestionados).
// Botón "Desactivar cliente" (no aparece si el cliente tiene otro plan activo).

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import SeccionInicio from './SeccionInicio'
import { formatPesos } from '../utils/saldoPlan'
import { hoyLocal } from '../utils/accionesPago'
import { marcarGestionRenovacion, desactivarCliente } from '../utils/accionesCliente'

const COLORES = { header: '#0f766e', headerBg: '#f0fdfa', border: '#99f6e4' }
const ORDEN_SEDES = ['rosales', 'chico', 'tunja']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const SELECT_PLAN = 'id, cliente_id, sede_id, total_clases, clases_tomadas, duracion_min, valor_plan, estado, renovacion_gestionada, renovacion_gestionada_en, clientes(nombre, nombres, apellidos, estado), instrumentos(nombre), profesores(nombre)'

type Plan = {
  id: string; clienteId: string; sedeId: string; cliente: string; instrumento: string; profesor: string
  ultima: string | null; total: number; tomadas: number; duracion: number | null; valor: number
  gestionado: boolean; gestionadoEn: string | null; otroActivo: boolean
}

function normalizar(s: string) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function num(n: number) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '') }
function fechaCorta(f: string | null) {
  if (!f) return '—'
  const [y, m, d] = f.substring(0, 10).split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`
}
function consumido(p: any) {
  const total = Number(p.total_clases || 0)
  return total > 0 && Number(Number(p.clases_tomadas || 0).toFixed(4)) >= Number(total.toFixed(4))
}

async function traerPlanes(estado: string): Promise<any[]> {
  const todos: any[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.from('contratos').select(SELECT_PLAN).eq('estado', estado).range(desde, desde + 999)
    todos.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return todos
}

export default function PlanesSinRenovar({ esMovil }: { esMovil: boolean }) {
  const [sedes, setSedes]           = useState<{ id: string; nombre: string }[]>([])
  const [planes, setPlanes]         = useState<Plan[]>([])
  const [sedeSel, setSedeSel]       = useState('')
  const [verGestionados, setVerGestionados] = useState(false)
  const [cargando, setCargando]     = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  const [aDesactivar, setADesactivar] = useState<Plan | null>(null)
  const [clasesFuturas, setClasesFuturas] = useState<number | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [errorModal, setErrorModal] = useState('')
  const [aviso, setAviso]           = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => { cargar() }, [])

  function mostrarAviso(ok: boolean, texto: string) {
    setAviso({ ok, texto }); setTimeout(() => setAviso(null), ok ? 3000 : 5000)
  }

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true)
    const [{ data: s }, completados, activos] = await Promise.all([
      supabase.from('sedes').select('id, nombre'),
      traerPlanes('completado'),
      traerPlanes('activo'),
    ])

    // Clientes con algún plan activo que aún tiene clases pendientes
    const conActivo = new Set(activos.filter(p => !consumido(p)).map(p => p.cliente_id))

    const candidatos = [...completados, ...activos.filter(consumido)]
      .filter(p => p.clientes?.estado !== 'inactivo')

    // Fecha de la última clase dada por plan (por lotes)
    const ultima: Record<string, string> = {}
    const ids = candidatos.map(p => p.id)
    for (let i = 0; i < ids.length; i += 40) {
      const { data } = await supabase.from('clases').select('contrato_id, fecha')
        .in('contrato_id', ids.slice(i, i + 40)).eq('estado', 'dada').limit(5000)
      ;(data || []).forEach((c: any) => { if (!ultima[c.contrato_id] || c.fecha > ultima[c.contrato_id]) ultima[c.contrato_id] = c.fecha })
    }

    const lista: Plan[] = candidatos.map(p => {
      const cl = p.clientes
      return {
        id: p.id,
        clienteId: p.cliente_id,
        sedeId: p.sede_id || 'sin-sede',
        cliente: cl?.nombre || `${cl?.nombres || ''} ${cl?.apellidos || ''}`.trim() || '—',
        instrumento: p.instrumentos?.nombre || '—',
        profesor: p.profesores?.nombre || '—',
        ultima: ultima[p.id] || null,
        total: Number(p.total_clases || 0),
        tomadas: Number(p.clases_tomadas || 0),
        duracion: p.duracion_min || null,
        valor: Number(p.valor_plan || 0),
        gestionado: !!p.renovacion_gestionada,
        gestionadoEn: p.renovacion_gestionada_en || null,
        otroActivo: conActivo.has(p.cliente_id),
      }
    }).sort((a, b) => (b.ultima || '').localeCompare(a.ultima || ''))

    const ordenadas = [...(s || [])].sort((a: any, b: any) => {
      const ia = ORDEN_SEDES.findIndex(k => normalizar(a.nombre).includes(k))
      const ib = ORDEN_SEDES.findIndex(k => normalizar(b.nombre).includes(k))
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    if (lista.some(p => p.sedeId === 'sin-sede')) ordenadas.push({ id: 'sin-sede', nombre: 'Sin sede' })
    setSedes(ordenadas)
    setPlanes(lista)
    setSedeSel(prev => prev || ordenadas[0]?.id || '')
    setCargando(false)
  }

  async function alternarGestion(p: Plan) {
    setGuardandoId(p.id)
    const nuevo = !p.gestionado
    const r = await marcarGestionRenovacion(p.id, nuevo)
    setGuardandoId(null)
    if (!r.ok) { mostrarAviso(false, r.mensaje); return }
    setPlanes(prev => prev.map(x => x.id === p.id ? { ...x, gestionado: nuevo, gestionadoEn: nuevo ? new Date().toISOString() : null } : x))
  }

  async function abrirDesactivar(p: Plan) {
    setADesactivar(p); setClasesFuturas(null); setErrorModal('')
    const { count, error } = await supabase.from('clases')
      .select('id, contratos!inner(cliente_id)', { count: 'exact', head: true })
      .eq('contratos.cliente_id', p.clienteId)
      .eq('estado', 'programada')
      .gte('fecha', hoyLocal())
    setClasesFuturas(error ? -1 : (count ?? 0))
  }

  async function ejecutarDesactivar() {
    if (!aDesactivar) return
    setProcesando(true); setErrorModal('')
    const r = await desactivarCliente(aDesactivar.clienteId, aDesactivar.id)
    setProcesando(false)
    if (!r.ok) { setErrorModal(r.mensaje); return }
    setADesactivar(null)
    mostrarAviso(true, r.mensaje)
    await cargar(true)
  }

  const visibles = planes.filter(p => verGestionados || !p.gestionado)
  const deSede = visibles.filter(p => p.sedeId === sedeSel)
  const nGestionados = planes.filter(p => p.gestionado).length
  const pendientes = planes.length - nGestionados

  const casilla = (p: Plan) => (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: p.gestionado ? '#0f766e' : '#64748b', whiteSpace: 'nowrap' }}>
      <input type="checkbox" checked={p.gestionado} disabled={guardandoId === p.id} onChange={() => alternarGestion(p)}
        style={{ width: '18px', height: '18px', accentColor: '#0f766e', cursor: 'pointer', margin: 0 }} />
      {esMovil && (p.gestionado ? `Gestionado ${p.gestionadoEn ? fechaCorta(p.gestionadoEn) : ''}` : 'Gestionado')}
    </label>
  )
  const botonDesactivar = (p: Plan) => p.otroActivo ? null : (
    <button onClick={() => abrirDesactivar(p)}
      style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      Desactivar cliente
    </button>
  )
  const etiquetaOtro = (p: Plan) => p.otroActivo ? (
    <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', marginLeft: '6px', whiteSpace: 'nowrap' }}>
      Tiene otro plan activo
    </span>
  ) : null
  const valorTxt = (p: Plan) => p.valor === 0 ? <span style={{ color: '#94a3b8' }}>Sin valor</span> : formatPesos(p.valor)

  return (
    <SeccionInicio titulo="Planes completados sin renovar" colores={COLORES} esMovil={esMovil} anchoCompleto
      cantidad={cargando ? null : pendientes}>
      {cargando ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Cargando...</p>
      ) : (
        <div>
          {/* Sedes */}
          <div style={{ display: 'flex', gap: '8px', padding: '12px 16px 8px', flexWrap: 'wrap' }}>
            {sedes.map(s => {
              const activo = s.id === sedeSel
              const n = visibles.filter(p => p.sedeId === s.id).length
              return (
                <button key={s.id} onClick={() => setSedeSel(s.id)}
                  style={{ flex: esMovil ? 1 : 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${activo ? COLORES.header : COLORES.border}`, background: activo ? COLORES.header : 'white', color: activo ? 'white' : COLORES.header }}>
                  {s.nombre} · {n}
                </button>
              )
            })}
          </div>

          {/* Filtro gestionados */}
          <div style={{ padding: '0 16px 12px', textAlign: 'left' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
              <input type="checkbox" checked={verGestionados} onChange={e => setVerGestionados(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#0f766e', margin: 0 }} />
              Mostrar gestionados ({nGestionados})
            </label>
          </div>

          {deSede.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '20px', fontSize: '13px', margin: 0, borderTop: '1px solid #f1f5f9' }}>✓ Sin planes pendientes de renovar</p>
          ) : esMovil ? (
            <div>
              {deSede.map((p, i) => (
                <div key={p.id} style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', background: p.gestionado ? '#f8fafc' : i % 2 === 0 ? 'white' : '#fafbfc', textAlign: 'left', opacity: p.gestionado ? 0.75 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.cliente}{etiquetaOtro(p)}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fechaCorta(p.ultima)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>{p.instrumento} · {p.profesor}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>Clases {num(p.tomadas)}/{num(p.total)} · {p.duracion || '—'} min · {valorTxt(p)}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', gap: '8px' }}>
                    {casilla(p)}
                    {botonDesactivar(p)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0 }}>
                    {['Cliente', 'Última clase', 'Instrumento', 'Profesor', 'Clases', 'Duración', 'Valor', 'Gestionado', ''].map((h, i) => (
                      <th key={h + i} style={{ padding: '8px 12px', textAlign: i >= 4 && i <= 6 ? 'right' : i === 7 ? 'center' : 'left', fontWeight: 700, background: '#f8fafc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deSede.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9', background: p.gestionado ? '#f8fafc' : i % 2 === 0 ? 'white' : '#fafbfc', opacity: p.gestionado ? 0.75 : 1 }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a1a1a' }}>{p.cliente}{etiquetaOtro(p)}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', whiteSpace: 'nowrap' }}>{fechaCorta(p.ultima)}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563' }}>{p.instrumento}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563' }}>{p.profesor}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', textAlign: 'right', whiteSpace: 'nowrap' }}>{num(p.tomadas)}/{num(p.total)}</td>
                      <td style={{ padding: '8px 12px', color: '#4b5563', textAlign: 'right', whiteSpace: 'nowrap' }}>{p.duracion || '—'} min</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{valorTxt(p)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }} title={p.gestionadoEn ? `Gestionado ${fechaCorta(p.gestionadoEn)}` : undefined}>{casilla(p)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right' }}>{botonDesactivar(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Ventana: desactivar cliente */}
      {aDesactivar && (
        <div onClick={() => !procesando && setADesactivar(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '380px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>¿Desactivar a {aDesactivar.cliente}?</p>
            <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '13px', color: '#4b5563', lineHeight: 1.6 }}>
              <li>El cliente quedará <b>Inactivo</b>.</li>
              <li>Se archivará este plan ({aDesactivar.instrumento}) y sus otros planes completados.</li>
              <li>
                {clasesFuturas === null ? 'Revisando clases futuras...'
                  : clasesFuturas === -1 ? 'Se eliminarán sus clases futuras programadas, si tiene.'
                  : clasesFuturas === 0 ? 'No tiene clases futuras programadas.'
                  : <>Se eliminarán <b>{clasesFuturas} clase{clasesFuturas !== 1 ? 's' : ''} futura{clasesFuturas !== 1 ? 's' : ''}</b> programada{clasesFuturas !== 1 ? 's' : ''}, liberando esos horarios.</>}
              </li>
              <li>Queda registrado en Auditoría. Puedes reactivarlo desde Clientes.</li>
            </ul>
            {errorModal && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>{errorModal}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button disabled={procesando} onClick={() => setADesactivar(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
              <button disabled={procesando || clasesFuturas === null} onClick={ejecutarDesactivar}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#475569', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: procesando || clasesFuturas === null ? 0.6 : 1 }}>
                {procesando ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {aviso && (
        <div style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 1001, maxWidth: 'calc(100% - 32px)', padding: '12px 18px', borderRadius: '12px',
          fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', background: aviso.ok ? '#dcfce7' : '#fee2e2', color: aviso.ok ? '#166534' : '#991b1b' }}>
          {aviso.texto}
        </div>
      )}
    </SeccionInicio>
  )
}
