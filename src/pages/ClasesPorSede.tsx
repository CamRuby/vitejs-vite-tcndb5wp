// src/pages/ClasesPorSede.tsx
// Inicio → "Clases de hoy" por sede (Rosales, Chicó, Tunja).
// Celular: acordeón (todo cerrado al inicio). Computador: tres columnas abiertas.
// Se puede ver HOY y el SIGUIENTE DÍA HÁBIL (el siguiente día que tenga clases o talleres).
// Única acción: confirmar una clase programada (vía función única confirmar_clase).

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import { confirmarClase } from '../utils/accionesClase'
import { entraEnRevision, tieneSaldo, pagadoPorPlan } from '../utils/saldoPlan'

const TEAL          = '#1a8a8a'
const TEAL_LIGHT    = '#e8f5f5'
const TEAL_MID      = '#b2d8d8'
const TALLER_COLOR  = '#7c3aed'
const TALLER_BG     = '#f3e8ff'

// Orden fijo de sedes en pantalla
const ORDEN_SEDES = ['rosales', 'chico', 'tunja']

const DIA_NUM: Record<string, number> = {
  'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'jueves': 4, 'viernes': 5, 'sábado': 6
}
const DIAS_CORTO  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

type Fila = {
  id: string
  hora: string          // HH:MM
  titulo: string        // alumno o nombre del taller
  profesor: string
  estado: string        // programada | confirmada | dada | cancelada
  esTaller: boolean
  saldo: boolean        // plan con saldo pendiente o sin valor definido
  sedeId: string | null
}

function fechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function parseFecha(f: string): Date {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
function sumarDias(f: string, n: number): string {
  const d = parseFecha(f); d.setDate(d.getDate() + n); return fechaLocal(d)
}
function etiquetaFecha(f: string): string {
  const d = parseFecha(f)
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()} ${MESES_CORTO[d.getMonth()]}`
}
function normalizar(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}
function formatHora(hora: string) {
  if (!hora) return '—'
  const [h, m] = hora.substring(0, 5).split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}
function estiloEstado(estado: string): { label: string; bg: string; color: string } {
  if (estado === 'confirmada') return { label: 'Confirmada', bg: '#dcfce7', color: '#166534' }
  if (estado === 'dada')       return { label: 'Dada',       bg: '#fefce8', color: '#854d0e' }
  if (estado === 'cancelada')  return { label: 'Cancelada',  bg: '#fee2e2', color: '#991b1b' }
  return                              { label: 'Programada', bg: '#f1f5f9', color: '#64748b' }
}

// ¿El taller ocurre en esta fecha? (misma regla que Horarios)
function tallerOcurre(t: any, fecha: string, sesion: any | undefined): boolean {
  const tieneExcepcion = !!sesion && (!!sesion.hora || !!sesion.salon_id)
  const esNormal = t.fecha_fin_vacacional
    ? fecha >= t.fecha_unica && fecha <= t.fecha_fin_vacacional && ![0, 6].includes(parseFecha(fecha).getDay())
    : parseFecha(fecha).getDay() === DIA_NUM[t.dia_semana]
  return esNormal || tieneExcepcion
}

export default function ClasesPorSede() {
  const hoy = fechaLocal(new Date())

  const [esMovil, setEsMovil]         = useState(() => window.innerWidth < 768)
  const [sedes, setSedes]             = useState<any[]>([])
  const [salonSede, setSalonSede]     = useState<Record<string, string>>({})
  const [talleres, setTalleres]       = useState<any[]>([])
  const [base, setBase]               = useState(false)

  const [siguiente, setSiguiente]     = useState<string | null>(null)
  const [fecha, setFecha]             = useState(hoy)
  const [filas, setFilas]             = useState<Fila[]>([])
  const [cargando, setCargando]       = useState(true)
  const [abiertas, setAbiertas]       = useState<Set<string>>(new Set())

  const [aConfirmar, setAConfirmar]   = useState<Fila | null>(null)
  const [procesando, setProcesando]   = useState(false)
  const [aviso, setAviso]             = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => {
    const h = () => setEsMovil(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => { cargarBase() }, [])
  useEffect(() => { if (base) cargarDia(fecha) }, [base, fecha])
  useEffect(() => { if (base) buscarSiguienteHabil() }, [base])

  async function cargarBase() {
    const [{ data: s }, { data: sal }, { data: t }] = await Promise.all([
      supabase.from('sedes').select('id, nombre'),
      supabase.from('salones').select('id, sede_id'),
      supabase.from('talleres')
        .select('id, nombre, dia_semana, hora, fecha_unica, fecha_fin_vacacional, salon_id, profesores(nombre)')
        .neq('estado', 'archivado'),
    ])
    const ordenadas = [...(s || [])].sort((a: any, b: any) => {
      const ia = ORDEN_SEDES.findIndex(k => normalizar(a.nombre).includes(k))
      const ib = ORDEN_SEDES.findIndex(k => normalizar(b.nombre).includes(k))
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
    const mapa: Record<string, string> = {}
    ;(sal || []).forEach((x: any) => { mapa[x.id] = x.sede_id })
    setSedes(ordenadas)
    setSalonSede(mapa)
    setTalleres((t || []).filter((x: any) => x.hora))
    setBase(true)
  }

  // Siguiente día (después de hoy) que tenga al menos una clase no cancelada o un taller
  async function buscarSiguienteHabil() {
    const desde = sumarDias(hoy, 1)
    const hasta = sumarDias(hoy, 14)
    const [{ data: cl }, { data: ses }] = await Promise.all([
      supabase.from('clases').select('fecha')
        .gte('fecha', desde).lte('fecha', hasta)
        .neq('estado', 'cancelada').not('hora', 'is', null),
      supabase.from('taller_sesiones').select('taller_id, fecha, hora, salon_id')
        .gte('fecha', desde).lte('fecha', hasta),
    ])
    const conClases = new Set((cl || []).map((c: any) => c.fecha))
    const sesMap: Record<string, any> = {}
    ;(ses || []).forEach((x: any) => { sesMap[`${x.taller_id}-${x.fecha}`] = x })
    for (let i = 1; i <= 14; i++) {
      const f = sumarDias(hoy, i)
      if (conClases.has(f) || talleres.some(t => tallerOcurre(t, f, sesMap[`${t.id}-${f}`]))) {
        setSiguiente(f); return
      }
    }
    setSiguiente(desde)
  }

  async function cargarDia(f: string) {
    setCargando(true)
    const [{ data: cl }, { data: ses }] = await Promise.all([
      supabase.from('clases')
        .select('id, hora, estado, profesores(nombre), salones(sede_id), contratos(id, fecha_inicio, valor_plan, clientes(nombre, nombres, apellidos))')
        .eq('fecha', f).not('hora', 'is', null),
      supabase.from('taller_sesiones').select('taller_id, estado, hora, salon_id').eq('fecha', f),
    ])

    // Pagos de los planes que se revisan para la "p"
    const contratosRevisar = (cl || [])
      .map((c: any) => c.contratos)
      .filter((ct: any) => ct?.id && entraEnRevision(ct))
      .map((ct: any) => ct.id)
    const pagado = await pagadoPorPlan(contratosRevisar)

    const nuevas: Fila[] = (cl || []).map((c: any) => {
      const ct = c.contratos
      const cli = ct?.clientes
      return {
        id: c.id,
        hora: (c.hora || '').substring(0, 5),
        titulo: cli?.nombre || `${cli?.nombres || ''} ${cli?.apellidos || ''}`.trim() || '—',
        profesor: c.profesores?.nombre || '—',
        estado: c.estado,
        esTaller: false,
        saldo: !!ct?.id && tieneSaldo(ct, pagado[ct.id] || 0),
        sedeId: c.salones?.sede_id || null,
      }
    })

    const sesMap: Record<string, any> = {}
    ;(ses || []).forEach((x: any) => { sesMap[x.taller_id] = x })
    talleres.forEach((t: any) => {
      const s = sesMap[t.id]
      if (!tallerOcurre(t, f, s)) return
      const salon = (s?.salon_id) || t.salon_id
      nuevas.push({
        id: `taller-${t.id}`,
        hora: ((s?.hora) || t.hora || '').substring(0, 5),
        titulo: t.nombre,
        profesor: t.profesores?.nombre || '—',
        estado: s?.estado || 'programada',
        esTaller: true,
        saldo: false,
        sedeId: salonSede[salon] || null,
      })
    })

    nuevas.sort((a, b) => a.hora.localeCompare(b.hora) || a.titulo.localeCompare(b.titulo))
    setFilas(nuevas)
    setCargando(false)
  }

  async function ejecutarConfirmacion() {
    if (!aConfirmar) return
    setProcesando(true)
    const r = await confirmarClase(aConfirmar.id, 'inicio')
    setProcesando(false)
    setAConfirmar(null)
    setAviso({ ok: r.ok, texto: r.mensaje })
    setTimeout(() => setAviso(null), r.ok ? 2500 : 5000)
    await cargarDia(fecha)
  }

  function alternar(id: string) {
    setAbiertas(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  // ── Piezas visuales ──

  const cifra = (n: number, color: string, bg: string, titulo: string) => (
    <span title={titulo} style={{ minWidth: '22px', padding: '2px 7px', borderRadius: '10px', background: bg, color, fontSize: '12px', fontWeight: 700, textAlign: 'center' }}>{n}</span>
  )

  function encabezado(sede: any, lista: Fila[], abierta: boolean | null) {
    const activas = lista.filter(f => f.estado !== 'cancelada')
    const n = (e: string) => lista.filter(f => f.estado === e).length
    const canc = n('cancelada')
    return (
      <div onClick={abierta === null ? undefined : () => alternar(sede.id)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 16px',
          background: TEAL_LIGHT, cursor: abierta === null ? 'default' : 'pointer', borderBottom: abierta === false ? 'none' : `1px solid ${TEAL_MID}` }}>
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: TEAL }}>{sede.nombre}</p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: TEAL, opacity: 0.8 }}>
            {activas.length} clase{activas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          {cifra(n('programada'), '#64748b', '#f1f5f9', 'Programadas')}
          {cifra(n('confirmada'), '#166534', '#dcfce7', 'Confirmadas')}
          {cifra(n('dada'),       '#854d0e', '#fefce8', 'Dadas')}
          {canc > 0 && cifra(canc, '#991b1b', '#fee2e2', 'Canceladas')}
          {abierta !== null && (
            <span style={{ marginLeft: '6px', fontSize: '14px', color: TEAL, transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          )}
        </div>
      </div>
    )
  }

  function fila(f: Fila, i: number) {
    const est = estiloEstado(f.estado)
    const cancelada = f.estado === 'cancelada'
    return (
      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
        borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc', opacity: cancelada ? 0.6 : 1 }}>
        <span style={{ width: '64px', flexShrink: 0, fontSize: '13px', fontWeight: 700, color: '#1f2937', textAlign: 'left', whiteSpace: 'nowrap' }}>{formatHora(f.hora)}</span>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: f.esTaller ? TALLER_COLOR : '#1a1a1a', textDecoration: cancelada ? 'line-through' : 'none' }}>
            {f.esTaller && <span style={{ display: 'inline-block', padding: '0 6px', marginRight: '5px', borderRadius: '6px', background: TALLER_BG, fontSize: '10px', fontWeight: 700 }}>TALLER</span>}
            {f.titulo}
          </p>
          <p style={{ margin: '1px 0 0', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.profesor}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: est.bg, color: est.color, whiteSpace: 'nowrap' }}>{est.label}</span>
            <span title={f.saldo ? 'Plan con saldo pendiente' : undefined}
              style={{ width: '10px', fontSize: '13px', fontWeight: 800, color: '#dc2626', visibility: f.saldo ? 'visible' : 'hidden' }}>p</span>
          </div>
          {!f.esTaller && f.estado === 'programada' && (
            <button onClick={() => setAConfirmar(f)}
              style={{ padding: '4px 10px', borderRadius: '8px', border: `1px solid #16a34a`, background: 'white', color: '#166534', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              Confirmar
            </button>
          )}
        </div>
      </div>
    )
  }

  function cuerpo(lista: Fila[]) {
    if (cargando) return <p style={{ margin: 0, padding: '20px', color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>Cargando...</p>
    if (lista.length === 0) return <p style={{ margin: 0, padding: '20px', color: '#9ca3af', fontSize: '13px', textAlign: 'center' }}>Sin clases este día</p>
    return <div>{lista.map(fila)}</div>
  }

  const botonDia = (f: string, texto: string) => {
    const activo = fecha === f
    return (
      <button key={f} onClick={() => setFecha(f)}
        style={{ flex: esMovil ? 1 : 'none', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
          border: `1.5px solid ${activo ? TEAL : TEAL_MID}`, background: activo ? TEAL : 'white', color: activo ? 'white' : TEAL }}>
        {texto}
      </button>
    )
  }

  const porSede = (id: string) => filas.filter(f => f.sedeId === id)

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Selector de día */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {botonDia(hoy, `Hoy · ${etiquetaFecha(hoy)}`)}
        {siguiente && botonDia(siguiente, etiquetaFecha(siguiente))}
      </div>

      {esMovil ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sedes.map(s => {
            const abierta = abiertas.has(s.id)
            return (
              <div key={s.id} style={{ background: 'white', borderRadius: '14px', border: `1px solid ${TEAL_MID}`, overflow: 'hidden' }}>
                {encabezado(s, porSede(s.id), abierta)}
                {abierta && cuerpo(porSede(s.id))}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(sedes.length, 1)}, minmax(0, 1fr))`, gap: '16px' }}>
          {sedes.map(s => (
            <div key={s.id} style={{ background: 'white', borderRadius: '16px', border: `1px solid ${TEAL_MID}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {encabezado(s, porSede(s.id), null)}
              <div style={{ maxHeight: '520px', overflowY: 'auto' }}>{cuerpo(porSede(s.id))}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ventana ¿Seguro? */}
      {aConfirmar && (
        <div onClick={() => !procesando && setAConfirmar(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '360px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>¿Confirmar esta clase?</p>
            <p style={{ margin: '0 0 18px', fontSize: '14px', color: '#4b5563', lineHeight: 1.5 }}>
              {aConfirmar.titulo}<br />
              {etiquetaFecha(fecha)} · {formatHora(aConfirmar.hora)} · {aConfirmar.profesor}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button disabled={procesando} onClick={() => setAConfirmar(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Volver
              </button>
              <button disabled={procesando} onClick={ejecutarConfirmacion}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#16a34a', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: procesando ? 0.6 : 1 }}>
                {procesando ? 'Confirmando...' : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de resultado */}
      {aviso && (
        <div style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 1001, maxWidth: 'calc(100% - 32px)',
          padding: '12px 18px', borderRadius: '12px', fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          background: aviso.ok ? '#dcfce7' : '#fee2e2', color: aviso.ok ? '#166534' : '#991b1b' }}>
          {aviso.texto}
        </div>
      )}
    </div>
  )
}
