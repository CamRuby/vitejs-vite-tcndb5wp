// src/pages/TalleresSinPago.tsx
// Inicio → Talleres sin pago, por sede (Rosales, Chicó, Tunja).
// Entran: inscripciones a talleres desde la fecha de corte (1 jun 2026), en cualquier estado,
// sin valor o con lo pagado menor al valor acordado. Orden: de la más antigua a la más nueva.
// Acciones: Poner/Editar valor (con motivo) y Registrar pago. Ambas auditadas.
// Al tocar una fila se despliegan sus pagos.

import { useState, useEffect, Fragment } from 'react'
import { supabase } from '../supabase'
import SeccionInicio from './SeccionInicio'
import { CORTE_PAGOS, formatPesos } from '../utils/saldoPlan'
import { ModalValorInscripcion, ModalPagoTaller, type InscripcionResumen } from './ModalesTaller'

const COLORES = { header: '#6d28d9', headerBg: '#f5f3ff', border: '#ddd6fe' }
const ORDEN_SEDES = ['rosales', 'chico', 'tunja']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

type Fila = InscripcionResumen & { clienteId: string; sedeId: string; inicio: string; fin: string; estado: string }

function normalizar(s: string) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function fechaCorta(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`
}

export default function TalleresSinPago({ esMovil }: { esMovil: boolean }) {
  const [sedes, setSedes]       = useState<{ id: string; nombre: string }[]>([])
  const [filas, setFilas]       = useState<Fila[]>([])
  const [sedeSel, setSedeSel]   = useState('')
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto]   = useState<string | null>(null)
  const [pagos, setPagos]       = useState<Record<string, any[]>>({})
  const [aPagar, setAPagar]     = useState<Fila | null>(null)
  const [aValorar, setAValorar] = useState<Fila | null>(null)
  const [aviso, setAviso]       = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar(silencioso = false) {
    if (!silencioso) setCargando(true)
    const { data: s } = await supabase.from('sedes').select('id, nombre')
    const todas: any[] = []
    for (let desde = 0; ; desde += 1000) {
      const { data } = await supabase.from('taller_inscripciones')
        .select('id, cliente_id, fecha_inicio, fecha_fin, num_sesiones, valor_plan, valor_nota, total_pagado, estado, talleres(nombre, tipo, fecha_unica, salones(sede_id)), clientes(nombre, nombres, apellidos)')
        .gte('fecha_inicio', CORTE_PAGOS)
        .order('fecha_inicio', { ascending: true })
        .range(desde, desde + 999)
      todas.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    const lista: Fila[] = todas
      .map((i: any) => {
        const cl = i.clientes
        return {
          id: i.id,
          clienteId: i.cliente_id,
          cliente: cl?.nombre || `${cl?.nombres || ''} ${cl?.apellidos || ''}`.trim() || '—',
          taller: i.talleres?.nombre || '—',
          esVacacional: i.talleres?.tipo === 'vacacional' || !!i.talleres?.fecha_unica,
          sedeId: i.talleres?.salones?.sede_id || 'sin-sede',
          inicio: i.fecha_inicio || '',
          fin: i.fecha_fin || '',
          numSesiones: Number(i.num_sesiones || 4),
          valor: Number(i.valor_plan || 0),
          pagado: Number(i.total_pagado || 0),
          nota: i.valor_nota || null,
          estado: i.estado,
        }
      })
      .filter(f => f.valor <= 0 || f.pagado < f.valor)
    const ordenadas = [...(s || [])].sort((a: any, b: any) => {
      const ia = ORDEN_SEDES.findIndex(k => normalizar(a.nombre).includes(k))
      const ib = ORDEN_SEDES.findIndex(k => normalizar(b.nombre).includes(k))
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    }).filter((x: any) => lista.some(f => f.sedeId === x.id) || ORDEN_SEDES.some(k => normalizar(x.nombre).includes(k)))
    if (lista.some(f => f.sedeId === 'sin-sede')) ordenadas.push({ id: 'sin-sede', nombre: 'Sin sede' })
    setSedes(ordenadas)
    setFilas(lista)
    setPagos({})
    setSedeSel(prev => prev || ordenadas.find(x => lista.some(f => f.sedeId === x.id))?.id || ordenadas[0]?.id || '')
    setCargando(false)
  }

  async function alternar(id: string) {
    if (abierto === id) { setAbierto(null); return }
    setAbierto(id)
    if (!pagos[id]) {
      const { data } = await supabase.from('pagos').select('id, fecha, monto, metodo, notas').eq('inscripcion_id', id).order('fecha')
      setPagos(p => ({ ...p, [id]: data || [] }))
    }
  }

  function listo(mensaje: string) {
    setAPagar(null); setAValorar(null)
    setAviso(mensaje); setTimeout(() => setAviso(''), 2500)
    cargar(true)
  }

  const deSede = filas.filter(f => f.sedeId === sedeSel)
  const adeudado = deSede.reduce((t, f) => t + Math.max(f.valor - f.pagado, 0), 0)
  const sinValor = deSede.filter(f => f.valor <= 0).length

  const etiquetaEstado = (e: string) => e === 'activo' ? null : (
    <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#64748b', marginLeft: '6px' }}>
      {e === 'completado' ? 'Completado' : e === 'archivado' ? 'Archivado' : e}
    </span>
  )
  const valorTxt = (f: Fila) => f.valor <= 0 ? <span style={{ color: '#dc2626', fontWeight: 700 }}>Sin valor</span> : formatPesos(f.valor)
  const boton = (texto: string, onClick: () => void, principal = false) => (
    <button onClick={e => { e.stopPropagation(); onClick() }}
      style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${COLORES.header}`, background: principal ? COLORES.header : 'white',
        color: principal ? 'white' : COLORES.header, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {texto}
    </button>
  )
  const acciones = (f: Fila) => (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
      {f.valor <= 0
        ? boton('Poner valor', () => setAValorar(f), true)
        : <>{boton('Editar valor', () => setAValorar(f))}{boton('Registrar pago', () => setAPagar(f), true)}</>}
    </div>
  )
  const detalle = (f: Fila) => (
    <div style={{ padding: '10px 16px', background: '#faf5ff', borderTop: '1px solid #ede9fe', textAlign: 'left', fontSize: '12px', color: '#4b5563' }}>
      {f.nota && <p style={{ margin: '0 0 6px' }}>📝 {f.nota}</p>}
      {!pagos[f.id] ? <p style={{ margin: 0 }}>Cargando pagos…</p>
        : pagos[f.id].length === 0 ? <p style={{ margin: 0, fontStyle: 'italic' }}>Sin pagos registrados</p>
        : pagos[f.id].map(p => (
          <p key={p.id} style={{ margin: '2px 0' }}>{fechaCorta(p.fecha)} · <b>{formatPesos(Number(p.monto))}</b> · {p.metodo || '—'}{p.notas ? ` · ${p.notas}` : ''}</p>
        ))}
    </div>
  )

  return (
    <SeccionInicio titulo="Talleres sin pago" colores={COLORES} esMovil={esMovil} anchoCompleto
      cantidad={cargando ? null : filas.length}>
      {cargando ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Cargando...</p>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', flexWrap: 'wrap' }}>
            {sedes.map(s => {
              const activo = s.id === sedeSel
              const n = filas.filter(f => f.sedeId === s.id).length
              return (
                <button key={s.id} onClick={() => setSedeSel(s.id)}
                  style={{ flex: esMovil ? 1 : 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    border: `1.5px solid ${activo ? COLORES.header : COLORES.border}`, background: activo ? COLORES.header : 'white', color: activo ? 'white' : COLORES.header }}>
                  {s.nombre} · {n}
                </button>
              )
            })}
          </div>
          <div style={{ padding: '0 16px 12px', textAlign: 'left', fontSize: '13px', color: '#4b5563' }}>
            Total adeudado: <b style={{ color: COLORES.header }}>{formatPesos(adeudado)}</b>
            {sinValor > 0 && <span> · {sinValor} inscripci{sinValor !== 1 ? 'ones' : 'ón'} sin valor</span>}
          </div>

          {deSede.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '20px', fontSize: '13px', margin: 0, borderTop: '1px solid #f1f5f9' }}>✓ Sin talleres pendientes de pago</p>
          ) : esMovil ? (
            <div>
              {deSede.map((f, i) => (
                <div key={f.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <div onClick={() => alternar(f.id)}
                    style={{ padding: '10px 16px', background: abierto === f.id ? COLORES.headerBg : i % 2 === 0 ? 'white' : '#fafbfc', textAlign: 'left', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.cliente}{etiquetaEstado(f.estado)}</span>
                      <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fechaCorta(f.inicio)} – {fechaCorta(f.fin)}</span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>{f.taller} · {f.esVacacional ? 'vacacional' : `${f.numSesiones} clases`}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#1f2937' }}>{formatPesos(f.pagado)} de {valorTxt(f)}</span>
                      {acciones(f)}
                    </div>
                  </div>
                  {abierto === f.id && detalle(f)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', position: 'sticky', top: 0 }}>
                    {['Cliente', 'Taller', 'Periodo', 'Clases', 'Valor', 'Pagado', 'Saldo', ''].map((h, i) => (
                      <th key={h || i} style={{ padding: '8px 12px', textAlign: i >= 3 ? 'right' : 'left', fontWeight: 700, background: '#f8fafc' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deSede.map((f, i) => (
                    <Fragment key={f.id}>
                      <tr onClick={() => alternar(f.id)} title="Ver pagos"
                        style={{ borderTop: '1px solid #f1f5f9', background: abierto === f.id ? COLORES.headerBg : i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1a1a1a' }}>{f.cliente}{etiquetaEstado(f.estado)}</td>
                        <td style={{ padding: '8px 12px', color: '#4b5563' }}>{f.taller}{f.nota ? ' 📝' : ''}</td>
                        <td style={{ padding: '8px 12px', color: '#4b5563', whiteSpace: 'nowrap' }}>{fechaCorta(f.inicio)} – {fechaCorta(f.fin)}</td>
                        <td style={{ padding: '8px 12px', color: '#4b5563', textAlign: 'right' }}>{f.esVacacional ? 'Vac.' : f.numSesiones}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{valorTxt(f)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', color: f.pagado === 0 ? '#dc2626' : '#1f2937', fontWeight: 600 }}>{formatPesos(f.pagado)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: COLORES.header }}>{f.valor > 0 ? formatPesos(f.valor - f.pagado) : '—'}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right' }}>{acciones(f)}</td>
                      </tr>
                      {abierto === f.id && <tr><td colSpan={8} style={{ padding: 0 }}>{detalle(f)}</td></tr>}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {aValorar && <ModalValorInscripcion ins={aValorar} color={COLORES.header} onCerrar={() => setAValorar(null)} onGuardado={listo} />}
      {aPagar && <ModalPagoTaller ins={aPagar} color={COLORES.header} onCerrar={() => setAPagar(null)} onGuardado={listo} />}

      {aviso && (
        <div style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 1001, padding: '12px 18px', borderRadius: '12px',
          fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', background: '#dcfce7', color: '#166534' }}>
          {aviso}
        </div>
      )}
    </SeccionInicio>
  )
}
