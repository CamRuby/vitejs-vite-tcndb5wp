// src/pages/TalleresPorCliente.tsx
// Inicio → Talleres → "Por cliente": se busca un cliente y se ve todo su historial de talleres
// desde el 1 jun 2026: inscripciones (valor, pagado, saldo), sesiones con su asistencia y pagos.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { CORTE_PAGOS, formatPesos } from '../utils/saldoPlan'
import { fechasDelTaller } from '../utils/utilidadTalleres'
import { ModalValorInscripcion, ModalPagoTaller, type InscripcionResumen } from './ModalesTaller'

const C = { header: '#6d28d9', headerBg: '#f5f3ff', border: '#ddd6fe' }
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`
}
function nombreCliente(cl: any) { return cl?.nombre || `${cl?.nombres || ''} ${cl?.apellidos || ''}`.trim() || '—' }
function sinTildes(s: string) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }

type Ins = {
  id: string; tallerId: string; taller: string; tallerObj: any; inicio: string; fin: string; numSesiones: number
  valor: number; pagado: number; nota: string | null; estado: string; esVacacional: boolean
}

export default function TalleresPorCliente({ esMovil }: { esMovil: boolean }) {
  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [sel, setSel] = useState<{ id: string; nombre: string } | null>(null)
  const [ins, setIns] = useState<Ins[]>([])
  const [pagos, setPagos] = useState<Record<string, any[]>>({})
  const [asis, setAsis] = useState<Record<string, Record<string, boolean>>>({})   // inscripción → fecha → asistió
  const [dadas, setDadas] = useState<Record<string, Set<string>>>({})              // taller → fechas dadas
  const [cargando, setCargando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [aPagar, setAPagar] = useState<InscripcionResumen | null>(null)
  const [aValorar, setAValorar] = useState<InscripcionResumen | null>(null)

  useEffect(() => {
    (async () => {
      const mapa: Record<string, string> = {}
      for (let desde = 0; ; desde += 1000) {
        const { data } = await supabase.from('taller_inscripciones')
          .select('cliente_id, clientes(nombre, nombres, apellidos)')
          .gte('fecha_inicio', CORTE_PAGOS).range(desde, desde + 999)
        ;(data || []).forEach((r: any) => { if (r.cliente_id) mapa[r.cliente_id] = nombreCliente(r.clientes) })
        if (!data || data.length < 1000) break
      }
      setClientes(Object.entries(mapa).map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    })()
  }, [])

  async function cargarCliente(c: { id: string; nombre: string }) {
    setSel(c); setBusqueda(''); setCargando(true); setAbierta(null)
    const { data } = await supabase.from('taller_inscripciones')
      .select('id, taller_id, fecha_inicio, fecha_fin, num_sesiones, valor_plan, valor_nota, total_pagado, estado, talleres(nombre, tipo, fecha_unica, dia_semana)')
      .eq('cliente_id', c.id).gte('fecha_inicio', CORTE_PAGOS)
      .order('fecha_inicio', { ascending: false })
    const lista: Ins[] = (data || []).map((i: any) => ({
      id: i.id, tallerId: i.taller_id, taller: i.talleres?.nombre || '—', tallerObj: i.talleres || {},
      inicio: i.fecha_inicio || '', fin: i.fecha_fin || '', numSesiones: Number(i.num_sesiones || 4),
      valor: Number(i.valor_plan || 0), pagado: Number(i.total_pagado || 0), nota: i.valor_nota || null, estado: i.estado,
      esVacacional: i.talleres?.tipo === 'vacacional' || !!i.talleres?.fecha_unica,
    }))
    const ids = lista.map(i => i.id)
    const talleres = [...new Set(lista.map(i => i.tallerId))]
    const minF = lista.reduce((m, i) => (!m || i.inicio < m ? i.inicio : m), '')
    const maxF = lista.reduce((m, i) => ((i.fin || i.inicio) > m ? (i.fin || i.inicio) : m), '')
    const [pg, as, se] = await Promise.all([
      ids.length ? supabase.from('pagos').select('id, inscripcion_id, fecha, monto, metodo, notas').in('inscripcion_id', ids).order('fecha') : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from('taller_asistencias').select('inscripcion_id, asistio, taller_sesiones(fecha)').in('inscripcion_id', ids) : Promise.resolve({ data: [] as any[] }),
      talleres.length ? supabase.from('taller_sesiones').select('taller_id, fecha').eq('estado', 'dada').in('taller_id', talleres).gte('fecha', minF).lte('fecha', maxF) : Promise.resolve({ data: [] as any[] }),
    ])
    const mp: Record<string, any[]> = {}
    ;(pg.data || []).forEach((p: any) => { (mp[p.inscripcion_id] ||= []).push(p) })
    const ma: Record<string, Record<string, boolean>> = {}
    ;(as.data || []).forEach((a: any) => { const f = a.taller_sesiones?.fecha; if (f) (ma[a.inscripcion_id] ||= {})[f] = !!a.asistio })
    const md: Record<string, Set<string>> = {}
    ;(se.data || []).forEach((s: any) => { (md[s.taller_id] ||= new Set()).add(s.fecha) })
    setIns(lista); setPagos(mp); setAsis(ma); setDadas(md); setCargando(false)
  }

  const resumen = (i: Ins): InscripcionResumen => ({
    id: i.id, cliente: sel?.nombre || '—', taller: i.taller, esVacacional: i.esVacacional,
    numSesiones: i.numSesiones, valor: i.valor, pagado: i.pagado, nota: i.nota,
  })
  const listo = () => { setAPagar(null); setAValorar(null); if (sel) cargarCliente(sel) }

  const coincidencias = busqueda.trim().length >= 2
    ? clientes.filter(c => sinTildes(c.nombre).includes(sinTildes(busqueda.trim()))).slice(0, 8) : []
  const tot = ins.reduce((t, i) => ({ valor: t.valor + i.valor, pagado: t.pagado + i.pagado }), { valor: 0, pagado: 0 })

  const boton = (txt: string, fn: () => void, principal = false) => (
    <button onClick={e => { e.stopPropagation(); fn() }}
      style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${C.header}`, background: principal ? C.header : 'white',
        color: principal ? 'white' : C.header, fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{txt}</button>
  )

  return (
    <div style={{ padding: '12px 16px 16px', textAlign: 'left' }}>
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder={`Buscar cliente (${clientes.length} con talleres)…`}
          style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: '10px', fontSize: '14px', boxSizing: 'border-box' }} />
        {coincidencias.length > 0 && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: 'white', border: `1px solid ${C.border}`, borderRadius: '10px', marginTop: '4px', zIndex: 5, boxShadow: '0 6px 20px rgba(0,0,0,0.08)' }}>
            {coincidencias.map(c => (
              <div key={c.id} onClick={() => cargarCliente(c)}
                style={{ padding: '9px 12px', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}>{c.nombre}</div>
            ))}
          </div>
        )}
      </div>

      {!sel ? (
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', margin: '12px 0' }}>Escribe al menos 2 letras del nombre para buscar.</p>
      ) : cargando ? (
        <p style={{ textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Cargando…</p>
      ) : (
        <div>
          <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: '#1a1a1a' }}>{sel.nombre}</p>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#4b5563', marginBottom: '12px' }}>
            <span>Acordado <b>{formatPesos(tot.valor)}</b></span>
            <span>Pagado <b style={{ color: '#166534' }}>{formatPesos(tot.pagado)}</b></span>
            <span>Saldo <b style={{ color: tot.valor - tot.pagado > 0 ? '#991b1b' : '#166534' }}>{formatPesos(Math.max(tot.valor - tot.pagado, 0))}</b></span>
            <span>{ins.length} inscripci{ins.length !== 1 ? 'ones' : 'ón'}</span>
          </div>
          {ins.length === 0 && <p style={{ color: '#94a3b8', fontSize: '13px' }}>Sin inscripciones desde el 1 de junio.</p>}
          {ins.map(i => {
            const fechas = fechasDelTaller(i.tallerObj, i.inicio, i.fin || i.inicio)
            const hoy = new Date().toISOString().slice(0, 10)
            const a = asis[i.id] || {}
            const asistidas = Object.values(a).filter(Boolean).length
            const saldo = i.valor - i.pagado
            const abierto = abierta === i.id
            return (
              <div key={i.id} style={{ border: `1px solid ${abierto ? C.header : C.border}`, borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>
                <div onClick={() => setAbierta(abierto ? null : i.id)} style={{ padding: '10px 12px', cursor: 'pointer', background: abierto ? C.headerBg : 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{i.taller}
                      <span style={{ marginLeft: '6px', padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>{i.estado}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{fechaCorta(i.inicio)} – {fechaCorta(i.fin)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#4b5563' }}>
                      Asistió {asistidas} de {i.esVacacional ? fechas.length : i.numSesiones} ·{' '}
                      {i.valor > 0 ? <>{formatPesos(i.pagado)} de {formatPesos(i.valor)}{saldo > 0 && <b style={{ color: '#991b1b' }}> · debe {formatPesos(saldo)}</b>}</>
                        : <b style={{ color: '#dc2626' }}>Sin valor</b>}
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {i.valor <= 0 ? boton('Poner valor', () => setAValorar(resumen(i)), true) : <>
                        {boton('Editar valor', () => setAValorar(resumen(i)))}
                        {saldo > 0 && boton('Registrar pago', () => setAPagar(resumen(i)), true)}
                      </>}
                    </div>
                  </div>
                </div>
                {abierto && (
                  <div style={{ padding: '10px 12px', background: '#fafafa', borderTop: `1px solid ${C.border}`, display: 'grid', gridTemplateColumns: esMovil ? '1fr' : '1fr 1fr', gap: '12px', fontSize: '12px', color: '#4b5563' }}>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#374151' }}>Sesiones</p>
                      {fechas.length === 0 && <p style={{ margin: 0 }}>—</p>}
                      {fechas.map(f => {
                        const dada = dadas[i.tallerId]?.has(f)
                        const st = a[f] === true ? ['✓ Asistió', '#166534'] : a[f] === false ? ['✗ No asistió', '#991b1b']
                          : f > hoy ? ['Programada', '#94a3b8'] : dada ? ['— Sin registro', '#64748b'] : ['No registrada', '#b45309']
                        return <p key={f} style={{ margin: '2px 0' }}>{fechaCorta(f)} · <span style={{ color: st[1], fontWeight: 600 }}>{st[0]}</span></p>
                      })}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#374151' }}>Pagos</p>
                      {i.nota && <p style={{ margin: '0 0 4px' }}>📝 {i.nota}</p>}
                      {(pagos[i.id] || []).length === 0 ? <p style={{ margin: 0, fontStyle: 'italic' }}>Sin pagos registrados</p>
                        : pagos[i.id].map(p => <p key={p.id} style={{ margin: '2px 0' }}>{fechaCorta(p.fecha)} · <b>{formatPesos(Number(p.monto))}</b> · {p.metodo || '—'}{p.notas ? ` · ${p.notas}` : ''}</p>)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {aValorar && <ModalValorInscripcion ins={aValorar} color={C.header} onCerrar={() => setAValorar(null)} onGuardado={listo} />}
      {aPagar && <ModalPagoTaller ins={aPagar} color={C.header} onCerrar={() => setAPagar(null)} onGuardado={listo} />}
    </div>
  )
}
