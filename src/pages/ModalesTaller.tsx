// src/pages/ModalesTaller.tsx
// Ventanas compartidas para inscripciones a talleres (Inicio y Clientes):
//  - ModalValorInscripcion: poner o cambiar el valor acordado (con motivo).
//  - ModalPagoTaller: registrar un pago.
// Ambas usan las funciones únicas de utils/accionesTaller (auditadas).

import { useState } from 'react'
import { formatPesos } from '../utils/saldoPlan'
import { METODOS_PAGO, hoyLocal } from '../utils/accionesPago'
import { registrarPagoTaller, editarValorInscripcion } from '../utils/accionesTaller'
import { precioTallerMensual } from '../utils/preciosTaller'

export type InscripcionResumen = {
  id: string; cliente: string; taller: string; esVacacional: boolean
  numSesiones: number; valor: number; pagado: number; nota?: string | null
}

const fondo = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }
const caja = { background: 'white', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '380px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 10px 30px rgba(0,0,0,0.2)', textAlign: 'left' as const }
const campo = { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box' as const, background: 'white' }
const etiqueta = { display: 'block', margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' as const }

function Botones({ guardando, onCancelar, onGuardar, texto, color }: { guardando: boolean; onCancelar: () => void; onGuardar: () => void; texto: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '10px' }}>
      <button disabled={guardando} onClick={onCancelar}
        style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
        Cancelar
      </button>
      <button disabled={guardando} onClick={onGuardar}
        style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: color, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: guardando ? 0.6 : 1 }}>
        {guardando ? 'Guardando...' : texto}
      </button>
    </div>
  )
}

export function ModalValorInscripcion({ ins, color = '#7c3aed', onCerrar, onGuardado }: {
  ins: InscripcionResumen; color?: string; onCerrar: () => void; onGuardado: (mensaje: string) => void
}) {
  const lista = ins.esVacacional ? 0 : precioTallerMensual(ins.numSesiones)
  const [valor, setValor] = useState(ins.valor > 0 ? String(ins.valor) : lista > 0 ? String(lista) : '')
  const [nota, setNota] = useState(ins.nota || '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const v = Number(valor || 0)
  const conDescuento = lista > 0 && v > 0 && v !== lista

  async function guardar() {
    if (!(v > 0)) { setError('Ingresa un valor mayor a 0.'); return }
    setGuardando(true); setError('')
    const r = await editarValorInscripcion(ins.id, v, nota)
    setGuardando(false)
    if (!r.ok) { setError(r.mensaje); return }
    onGuardado(r.mensaje)
  }

  return (
    <div onClick={() => !guardando && onCerrar()} style={fondo}>
      <div onClick={e => e.stopPropagation()} style={caja}>
        <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>{ins.valor > 0 ? 'Editar valor' : 'Poner valor'}</p>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
          {ins.cliente} · {ins.taller}<br />
          {ins.esVacacional ? 'Taller vacacional' : `${ins.numSesiones} clases · precio de lista ${formatPesos(lista)}`}
          {ins.pagado > 0 && <> · pagado {formatPesos(ins.pagado)}</>}
        </p>
        <div style={{ marginBottom: '12px' }}>
          <label style={etiqueta}>Valor acordado</label>
          <input type="number" inputMode="numeric" min="0" value={valor} onChange={e => setValor(e.target.value)} style={campo} />
          {v > 0 && <p style={{ margin: '3px 0 0', fontSize: '12px', color: conDescuento ? '#b45309' : '#64748b' }}>
            {formatPesos(v)}{conDescuento ? ` · distinto al precio de lista (${formatPesos(lista)})` : ''}
          </p>}
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={etiqueta}>Motivo (opcional)</label>
          <input type="text" value={nota} placeholder="Ej. Descuento hermanos, antigüedad…" onChange={e => setNota(e.target.value)} style={campo} />
        </div>
        {error && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>{error}</p>}
        <Botones guardando={guardando} onCancelar={onCerrar} onGuardar={guardar} texto="Guardar valor" color={color} />
      </div>
    </div>
  )
}

export function ModalPagoTaller({ ins, color = '#7c3aed', onCerrar, onGuardado }: {
  ins: InscripcionResumen; color?: string; onCerrar: () => void; onGuardado: (mensaje: string) => void
}) {
  const saldo = Math.max(ins.valor - ins.pagado, 0)
  const [form, setForm] = useState({ monto: saldo > 0 ? String(saldo) : '', metodo: '', fecha: hoyLocal(), notas: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const monto = Number(form.monto || 0)

  async function guardar() {
    if (!(monto > 0)) { setError('Ingresa un monto mayor a 0.'); return }
    if (!form.metodo) { setError('Selecciona la cuenta del pago.'); return }
    if (!form.fecha) { setError('Selecciona la fecha del pago.'); return }
    setGuardando(true); setError('')
    const r = await registrarPagoTaller({ inscripcionId: ins.id, monto, metodo: form.metodo, fecha: form.fecha, notas: form.notas })
    setGuardando(false)
    if (!r.ok) { setError(r.mensaje); return }
    onGuardado(r.mensaje)
  }

  return (
    <div onClick={() => !guardando && onCerrar()} style={fondo}>
      <div onClick={e => e.stopPropagation()} style={caja}>
        <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: 700, color: '#1a1a1a' }}>Registrar pago</p>
        <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#4b5563', lineHeight: 1.5 }}>
          {ins.cliente} · {ins.taller}<br />
          Valor {formatPesos(ins.valor)} · Pagado {formatPesos(ins.pagado)} · <b>Saldo {formatPesos(saldo)}</b>
        </p>
        <div style={{ marginBottom: '12px' }}>
          <label style={etiqueta}>Monto</label>
          <input type="number" inputMode="numeric" min="0" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={campo} />
          {monto > 0 && <p style={{ margin: '3px 0 0', fontSize: '12px', color: monto > saldo ? '#b45309' : '#64748b' }}>
            {formatPesos(monto)}{monto > saldo ? ' · supera el saldo pendiente' : ''}
          </p>}
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={etiqueta}>Cuenta</label>
          <select value={form.metodo} onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))} style={campo}>
            <option value="" disabled>Selecciona la cuenta...</option>
            {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <label style={etiqueta}>Fecha del pago</label>
          <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={campo} />
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={etiqueta}>Notas (opcional)</label>
          <input type="text" value={form.notas} placeholder="Ej. Pago conjunto hermanas" onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={campo} />
        </div>
        {error && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>{error}</p>}
        <Botones guardando={guardando} onCancelar={onCerrar} onGuardar={guardar} texto="Registrar pago" color={color} />
      </div>
    </div>
  )
}
