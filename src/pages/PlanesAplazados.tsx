// src/pages/PlanesAplazados.tsx
// Inicio → Planes aplazados.
//   · Por contactar: llegó la fecha de regreso (o pasaron 14 días si fue "hasta nuevo aviso").
//   · En pausa: aún dentro del periodo.
// Acciones: Contactado (con nota) y Deshacer (las clases vuelven a programada). Auditado.

import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import SeccionInicio from './SeccionInicio'
import { hoyLocal } from '../utils/accionesPago'
import { marcarAplazamientoContactado, deshacerAplazamiento, fechaParaContactar } from '../utils/accionesAplazamiento'

const COLORES = { header: '#0e7490', headerBg: '#ecfeff', border: '#a5f3fc' }
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fechaCorta(f: string) {
  if (!f) return '—'
  const [y, m, d] = f.split('-').map(Number)
  return `${d} ${MESES_CORTO[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`
}

type Aplazamiento = { id: string; cliente: string; desde: string; hasta: string | null; motivo: string | null; clases: number; contactar: string }

export default function PlanesAplazados({ esMovil, onNavegar }: { esMovil: boolean; onNavegar: (s: string) => void }) {
  const [lista, setLista] = useState<Aplazamiento[]>([])
  const [cargando, setCargando] = useState(true)
  const [nota, setNota] = useState<{ id: string; texto: string } | null>(null)
  const [aviso, setAviso] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('aplazamientos')
      .select('id, desde, hasta, motivo, clases_aplazadas, clientes(nombre, nombres, apellidos)')
      .eq('estado', 'activo').order('desde')
    setLista((data || []).map((a: any) => {
      const cl = a.clientes
      return {
        id: a.id, desde: a.desde, hasta: a.hasta, motivo: a.motivo, clases: a.clases_aplazadas || 0,
        cliente: cl?.nombre || `${cl?.nombres || ''} ${cl?.apellidos || ''}`.trim() || '—',
        contactar: fechaParaContactar(a),
      }
    }))
    setCargando(false)
  }

  function avisar(m: string) { setAviso(m); setTimeout(() => setAviso(''), 2500) }

  async function contactado() {
    if (!nota) return
    setTrabajando(nota.id)
    const r = await marcarAplazamientoContactado(nota.id, nota.texto)
    setTrabajando(null)
    if (!r.ok) { avisar(r.mensaje); return }
    setNota(null); avisar(r.mensaje); cargar()
  }
  async function deshacer(a: Aplazamiento) {
    if (!window.confirm(`¿Deshacer el aplazamiento de ${a.cliente}? Sus clases aplazadas de hoy en adelante vuelven a "programada".`)) return
    setTrabajando(a.id)
    const r = await deshacerAplazamiento(a.id)
    setTrabajando(null)
    avisar(r.mensaje); if (r.ok) cargar()
  }

  const hoy = hoyLocal()
  const porContactar = lista.filter(a => a.contactar <= hoy).sort((a, b) => a.contactar.localeCompare(b.contactar))
  const enPausa = lista.filter(a => a.contactar > hoy).sort((a, b) => a.contactar.localeCompare(b.contactar))

  const fila = (a: Aplazamiento, urgente: boolean) => (
    <div key={a.id} style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'left', background: urgente ? '#fff7ed' : 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'baseline' }}>
        <span onClick={() => onNavegar('clientes')} style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', cursor: 'pointer' }}>{a.cliente}</span>
        <span style={{ fontSize: '12px', color: urgente ? '#c2410c' : '#6b7280', whiteSpace: 'nowrap', fontWeight: urgente ? 700 : 400 }}>
          {a.hasta ? `${fechaCorta(a.desde)} · regresa ${fechaCorta(a.hasta)}` : `desde ${fechaCorta(a.desde)} · sin fecha`}
        </span>
      </div>
      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
        {a.clases} clase{a.clases !== 1 ? 's' : ''} aplazada{a.clases !== 1 ? 's' : ''}{a.motivo ? ` · ${a.motivo}` : ''}
        {urgente && <b style={{ color: '#c2410c' }}> · contactar desde el {fechaCorta(a.contactar)}</b>}
      </p>
      {nota?.id === a.id ? (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
          <input autoFocus value={nota.texto} onChange={e => setNota({ id: a.id, texto: e.target.value })} placeholder="Nota (ej. vuelve el martes)"
            style={{ flex: 1, minWidth: '160px', padding: '6px 10px', border: `1px solid ${COLORES.border}`, borderRadius: '8px', fontSize: '13px' }} />
          <button disabled={trabajando === a.id} onClick={contactado}
            style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: COLORES.header, color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
          <button onClick={() => setNota(null)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#555', fontSize: '12px', cursor: 'pointer' }}>Cancelar</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
          <button disabled={trabajando === a.id} onClick={() => deshacer(a)}
            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#555', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Deshacer</button>
          <button disabled={trabajando === a.id} onClick={() => setNota({ id: a.id, texto: '' })}
            style={{ padding: '5px 10px', borderRadius: '8px', border: `1px solid ${COLORES.header}`, background: urgente ? COLORES.header : 'white', color: urgente ? 'white' : COLORES.header, fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            ✓ Contactado
          </button>
        </div>
      )}
    </div>
  )

  return (
    <SeccionInicio titulo="Planes aplazados" colores={COLORES} esMovil={esMovil}
      subtitulo={porContactar.length ? `${porContactar.length} por contactar` : undefined}
      cantidad={cargando ? null : lista.length}>
      {cargando ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Cargando...</p>
      ) : lista.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '24px 20px', fontSize: '13px', margin: 0 }}>Sin planes aplazados</p>
      ) : (
        <div style={{ maxHeight: esMovil ? 'none' : '420px', overflowY: 'auto' }}>
          {porContactar.length > 0 && <p style={{ margin: 0, padding: '8px 16px', fontSize: '11px', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' }}>Por contactar</p>}
          {porContactar.map(a => fila(a, true))}
          {enPausa.length > 0 && <p style={{ margin: 0, padding: '8px 16px', fontSize: '11px', fontWeight: 800, color: COLORES.header, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left', borderTop: porContactar.length ? '1px solid #e2e8f0' : 'none' }}>En pausa</p>}
          {enPausa.map(a => fila(a, false))}
        </div>
      )}
      {aviso && (
        <div style={{ position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: 1001, padding: '12px 18px', borderRadius: '12px',
          fontSize: '14px', fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,0.15)', background: '#dcfce7', color: '#166534' }}>{aviso}</div>
      )}
    </SeccionInicio>
  )
}
