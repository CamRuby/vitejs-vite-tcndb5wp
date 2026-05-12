import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'
const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Nequi', 'Daviplata', 'Tarjeta BOLD']

const estiloInput = {
  width: '100%', padding: '10px 12px',
  border: `1px solid ${TEAL_MID}`,
  borderRadius: '8px', fontSize: '15px',
  boxSizing: 'border-box' as const, marginTop: '6px',
  outline: 'none'
}
const labelStyle = { fontWeight: '500' as const, fontSize: '13px', color: '#555' }
const CLASES_PRESET = [4, 8, 16, 20, 40, 80]

const VISTAS = [
  { value: 'activos',   label: '✅ Todos los planes activos' },
  { value: 'talleres',  label: '🎸 Todos los talleres' },
  { value: 'todos',     label: '👥 Todos los clientes (A–Z)' },
]

function colorEstadoPlan(e: string) {
  if (e === 'completado') return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
  if (e === 'aplazado')   return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  if (e === 'archivado')  return { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
  return { bg: TEAL_LIGHT, color: TEAL, border: TEAL_MID }
}

function calcularEstadoPago(valorPlan: number | null, pagos: any[]) {
  const totalPagado = (pagos || []).reduce((s, p) => s + Number(p.monto), 0)
  const saldo = valorPlan !== null ? valorPlan - totalPagado : null
  let estado = 'Sin valor'
  if (valorPlan !== null) {
    if (totalPagado === 0) estado = 'Sin pagar'
    else if (totalPagado >= valorPlan) estado = 'Pagado'
    else estado = 'Parcial'
  }
  return { totalPagado, saldo, estado }
}

function colorEstadoPago(estado: string) {
  if (estado === 'Pagado')    return { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
  if (estado === 'Parcial')   return { bg: '#fef3c7', color: '#92400e', border: '#fde68a' }
  if (estado === 'Sin pagar') return { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' }
  return { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
}

function estaVencida(inscripcion: any): boolean {
  if (!inscripcion?.mes || inscripcion.estado !== 'activo') return false
  const hoy = new Date()
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  return inscripcion.mes < mesActual
}

function opcionesMesTaller(): { valor: string; etiqueta: string }[] {
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const opciones = []
  const hoy = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    opciones.push({ valor, etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}` })
  }
  return opciones
}

function FormCliente({ modo, form, setForm, cargando, onGuardar, onVolver }) {
  const inp = (label: string, key: string, type = 'text', span = false) => (
    <div key={key} style={span ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={estiloInput} />
    </div>
  )
  const sec = (title: string) => (
    <div style={{ gridColumn: '1 / -1', borderTop: `2px solid ${TEAL_MID}`, paddingTop: '14px', marginTop: '4px' }}>
      <p style={{ margin: 0, fontWeight: '700', fontSize: '12px', color: TEAL, textTransform: 'uppercase' as const, letterSpacing: '0.5px' }}>{title}</p>
    </div>
  )
  return (
    <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)' }}>
      <div style={{ background: TEAL, padding: '20px 28px' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: '14px', padding: 0, marginBottom: '8px' }}>← Volver</button>
        <h3 style={{ margin: 0, color: 'white', fontSize: '20px' }}>{modo === 'nuevo' ? 'Nuevo cliente' : 'Editar cliente'}</h3>
      </div>
      <div style={{ padding: '28px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ ...labelStyle, margin: 0 }}>Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}
              style={{ padding: '8px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px',
                background: form.estado === 'activo' ? '#dcfce7' : '#fee2e2',
                color: form.estado === 'activo' ? '#166534' : '#991b1b', fontWeight: '600' }}>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {sec('Datos personales')}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr', gap: '12px' }}>
            {inp('Nombres *', 'nombres')}
            {inp('Apellidos *', 'apellidos')}
            {inp('N° Identificación', 'numero_identificacion')}
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '140px 1fr 2fr 140px', gap: '12px' }}>
            {(() => {
              const key = 'fecha_nacimiento'
              return (
                <div key={key}>
                  <label style={labelStyle}>Fecha de nacimiento</label>
                  <input type="date" value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value || '' })} style={estiloInput} />
                </div>
              )
            })()}
            {inp('Ocupación', 'ocupacion')}
            {inp('Dirección', 'direccion')}
            {inp('Ciudad', 'ciudad')}
          </div>
          {sec('Contacto')}
          <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {inp('Teléfono', 'telefono')}
            {inp('Correo electrónico', 'email', 'email')}
            {inp('Grupo WhatsApp', 'grupo_whatsapp')}
          </div>
          {sec('Contacto de emergencia')}
          {inp('Nombre del contacto', 'contacto_emergencia_nombre')}
          {inp('Teléfono del contacto', 'contacto_emergencia_telefono')}
          {sec('Condiciones')}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={!!form.menor_de_edad} onChange={e => setForm({ ...form, menor_de_edad: e.target.checked })} />
              ¿El estudiante es menor de edad?
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={!!form.discapacidad_fisica} onChange={e => setForm({ ...form, discapacidad_fisica: e.target.checked })} />
              ¿Presenta discapacidad física?
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Condición especial de aprendizaje</label>
            <input value={form.condicion_aprendizaje || ''} onChange={e => setForm({ ...form, condicion_aprendizaje: e.target.value })} placeholder="Describir si aplica" style={estiloInput} />
          </div>
          <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px' }}>
              <input type="checkbox" checked={!!form.inasistencia_perdonada}
                onChange={e => setForm({ ...form, inasistencia_perdonada: e.target.checked })} />
              <span>
                <strong>Inasistencia perdonada</strong>
                <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>El cliente ya usó su inasistencia perdonada</span>
              </span>
            </label>
          </div>
          {form.menor_de_edad && (<>
            {sec('Datos del acudiente')}
            {inp('Nombres del acudiente', 'acudiente_nombres')}
            {inp('Apellidos del acudiente', 'acudiente_apellidos')}
            {inp('Teléfono del acudiente', 'acudiente_telefono')}
            {inp('Documento del acudiente', 'acudiente_documento')}
          </>)}
        </div>
        <div style={{ marginTop: '28px', display: 'flex', gap: '12px' }}>
          <button onClick={onGuardar} disabled={cargando} style={{ padding: '11px 28px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
            {cargando ? 'Guardando...' : 'Guardar'}
          </button>
          <button onClick={onVolver} style={{ padding: '11px 28px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function ModalPlan({ plan, profesores, instrumentos, sedes, onGuardar, onCerrar, esRenovacion = false }) {
  const esNuevo = !plan?.id || esRenovacion
  const [fp, setFp] = useState({
    instrumento_id: plan?.instrumento_id || '',
    profesor_id:    plan?.profesor_id    || '',
    sede_id:        plan?.sede_id        || '',
    total_clases:   plan?.total_clases   || 4,
    valor_plan:     plan?.valor_plan     || '',
    duracion_min:   plan?.duracion_min   || 60,
    fecha_inicio:   esRenovacion ? new Date().toISOString().split('T')[0] : (plan?.fecha_inicio || new Date().toISOString().split('T')[0]),
    estado:         esRenovacion ? 'activo' : (plan?.estado || 'activo'),
    clases_tomadas: esNuevo ? 0 : (plan?.clases_tomadas || 0),
    // ── campo para migración: registrar si ya se usó el perdón de inasistencia ──
  })
  const [clasesManual, setClasesManual] = useState(!CLASES_PRESET.includes(plan?.total_clases || 4))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    if (!fp.instrumento_id) { setError('Selecciona un instrumento'); return }
    if (!fp.profesor_id)    { setError('Selecciona un profesor'); return }
    if (!fp.sede_id)        { setError('Selecciona una sede'); return }
    if (!fp.total_clases || Number(fp.total_clases) < 1) { setError('Ingresa el número de clases'); return }
    setGuardando(true); setError('')
    const payload: any = {
      tipo_plan: 'regular', instrumento_id: fp.instrumento_id, profesor_id: fp.profesor_id,
      sede_id: fp.sede_id, total_clases: Number(fp.total_clases),
      clases_tomadas: esNuevo ? 0 : parseFloat(String(fp.clases_tomadas)),
      valor_plan: fp.valor_plan !== '' ? Number(fp.valor_plan) : null,
      duracion_min: Number(fp.duracion_min), fecha_inicio: fp.fecha_inicio, estado: fp.estado,
    }
    // Solo incluir el campo de perdón al editar (no en planes nuevos)
    await onGuardar(payload, esRenovacion ? undefined : plan?.id)
    setGuardando(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ background: esRenovacion ? '#0f766e' : TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>{esRenovacion ? '🔄 Renovar plan' : esNuevo ? 'Crear plan' : 'Editar plan'}</h3>
            {esRenovacion && <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>Características heredadas del plan anterior</p>}
          </div>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '24px', maxHeight: '78vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Instrumento *</label>
              <select value={fp.instrumento_id} onChange={e => setFp({ ...fp, instrumento_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {instrumentos.map((i: any) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Profesor *</label>
              <select value={fp.profesor_id} onChange={e => setFp({ ...fp, profesor_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {profesores.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Sede *</label>
              <select value={fp.sede_id} onChange={e => setFp({ ...fp, sede_id: e.target.value })} style={estiloInput}>
                <option value="">— Seleccionar —</option>
                {sedes.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Número de clases *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                {CLASES_PRESET.map(n => (
                  <button key={n} type="button" onClick={() => { setFp({ ...fp, total_clases: n }); setClasesManual(false) }}
                    style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', border: `2px solid ${!clasesManual && fp.total_clases === n ? TEAL : TEAL_MID}`, background: !clasesManual && fp.total_clases === n ? TEAL : 'white', color: !clasesManual && fp.total_clases === n ? 'white' : '#333' }}>{n}</button>
                ))}
                <button type="button" onClick={() => setClasesManual(true)} style={{ padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', border: `2px solid ${clasesManual ? TEAL : TEAL_MID}`, background: clasesManual ? TEAL : 'white', color: clasesManual ? 'white' : '#666' }}>Otro</button>
              </div>
              {clasesManual && (
                <input type="number" min={1} placeholder="Ingresa el número" value={fp.total_clases} onChange={e => setFp({ ...fp, total_clases: e.target.value })} style={{ ...estiloInput, marginTop: '10px' }} autoFocus />
              )}
            </div>
            <div>
              <label style={labelStyle}>Duración por clase</label>
              <select value={fp.duracion_min} onChange={e => setFp({ ...fp, duracion_min: e.target.value })} style={estiloInput}>
                {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Valor del plan ($)</label>
              <input type="number" min={0} value={fp.valor_plan} onChange={e => setFp({ ...fp, valor_plan: e.target.value })} style={estiloInput} />
            </div>
            <div>
              <label style={labelStyle}>Fecha de inicio</label>
              <input type="date" value={fp.fecha_inicio} onChange={e => setFp({ ...fp, fecha_inicio: e.target.value })} style={estiloInput} />
            </div>
            {!esNuevo && (
              <div>
                <label style={labelStyle}>Clases tomadas</label>
                <input type="number" min={0} step={0.25} value={fp.clases_tomadas} onChange={e => setFp({ ...fp, clases_tomadas: e.target.value })} style={estiloInput} />
              </div>
            )}

          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '13px', marginTop: '12px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={guardar} disabled={guardando} style={{ flex: 1, padding: '11px', background: esRenovacion ? '#0f766e' : TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
              {guardando ? 'Guardando...' : esRenovacion ? 'Crear renovación' : esNuevo ? 'Crear plan' : 'Guardar cambios'}
            </button>
            <button onClick={onCerrar} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalHistorialPlanes({ planes, onCerrar }) {
  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '95%', maxWidth: '900px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>📋 Historial de planes ({planes.length})</h3>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
              <tr>{['#', 'Instrumento', 'Sede', 'Profesor', 'Clases', 'Duración', 'Valor', 'Fecha inicio', 'Estado'].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {planes.length === 0 && <tr><td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#aaa' }}>Sin planes</td></tr>}
              {planes.map((p: any, i) => {
                const est = colorEstadoPlan(p.estado || 'activo')
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                    <td style={{ ...tdS, color: '#aaa' }}>{planes.length - i}</td>
                    <td style={{ ...tdS, fontWeight: '500' }}>{p.instrumentos?.nombre || '—'}</td>
                    <td style={tdS}>{p.sedes?.nombre || '—'}</td>
                    <td style={tdS}>{p.profesores?.nombre || '—'}</td>
                    <td style={{ ...tdS, textAlign: 'center' }}>{p.clases_tomadas}/{p.total_clases}</td>
                    <td style={{ ...tdS, textAlign: 'center' }}>{p.duracion_min} min</td>
                    <td style={tdS}>{p.valor_plan ? `$${Number(p.valor_plan).toLocaleString()}` : '—'}</td>
                    <td style={{ ...tdS, color: '#888' }}>{p.fecha_inicio || '—'}</td>
                    <td style={tdS}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: est.bg, color: est.color }}>{p.estado || 'activo'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TablaPlanesVista({ planes, onVerCliente }) {
  const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
          <tr>{['Cliente', 'Instrumento', 'Sede', 'Clases', 'Duración', 'Valor', 'Inicio', 'Estado'].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {planes.filter((p: any) => p.clientes?.nombre).length === 0 && <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Sin registros</td></tr>}
          {planes.filter((p: any) => p.clientes?.nombre).map((p: any, i) => {
            const est = colorEstadoPlan(p.estado || 'activo')
            return (
              <tr key={p.id} onClick={() => onVerCliente(p.cliente_id)}
                style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}>
                <td style={{ ...tdS, fontWeight: '600', color: TEAL }}>{p.clientes?.nombre || '—'}</td>
                <td style={tdS}>{p.instrumentos?.nombre || '—'}</td>
                <td style={tdS}>{p.sedes?.nombre || '—'}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{p.clases_tomadas}/{p.total_clases}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>{p.duracion_min} min</td>
                <td style={tdS}>{p.valor_plan ? `$${Number(p.valor_plan).toLocaleString()}` : '—'}</td>
                <td style={{ ...tdS, color: '#888' }}>{p.fecha_inicio || '—'}</td>
                <td style={tdS}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: est.bg, color: est.color }}>{p.estado || 'activo'}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ModalAbono({ plan, pagos, onRegistrar, onAnular, onCerrar, guardando, error }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ monto: '', metodo: 'Efectivo', fecha: hoy, notas: '' })
  const [anulando, setAnulando] = useState<string | null>(null)
  const { totalPagado, saldo, estado } = calcularEstadoPago(plan?.valor_plan ?? null, pagos)
  const cPago = colorEstadoPago(estado)

  async function handleAnular(pagoId: string) {
    setAnulando(pagoId)
    await onAnular(pagoId, plan.id)
    setAnulando(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div style={{ background: TEAL, padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>💰 Registrar abono</h3>
            <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.85)', fontSize: '13px' }}>{plan?.instrumentos?.nombre || '—'}</p>
          </div>
          <button onClick={onCerrar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '16px 24px', background: '#fafbfc', borderBottom: '1px solid #eef2f7' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              {[
                { label: 'Valor del plan', valor: plan?.valor_plan ? `$${Number(plan.valor_plan).toLocaleString()}` : '—', color: '#333' },
                { label: 'Total pagado', valor: `$${totalPagado.toLocaleString()}`, color: '#166534' },
                { label: 'Saldo pendiente', valor: saldo !== null ? `$${Math.max(saldo, 0).toLocaleString()}` : '—', color: saldo && saldo > 0 ? '#991b1b' : '#166534' },
              ].map(d => (
                <div key={d.label} style={{ background: 'white', borderRadius: '8px', padding: '10px 12px', border: '1px solid #eef2f7', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 3px', fontSize: '11px', color: '#999', fontWeight: '600' }}>{d.label}</p>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: d.color }}>{d.valor}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ padding: '4px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: cPago.bg, color: cPago.color, border: `1px solid ${cPago.border}` }}>{estado}</span>
            </div>
          </div>
          {pagos.length > 0 && (
            <div style={{ padding: '12px 24px', borderBottom: '1px solid #eef2f7' }}>
              <p style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abonos registrados</p>
              {pagos.map((pg: any) => (
                <div key={pg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#fafbfc', borderRadius: '8px', marginBottom: '5px', border: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#333', fontWeight: '500' }}>{pg.fecha}</span>
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: '#888' }}>{pg.metodo}</span>
                    {pg.notas && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#aaa' }}>· {pg.notas}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: TEAL }}>${Number(pg.monto).toLocaleString()}</span>
                    <button onClick={() => handleAnular(pg.id)} disabled={anulando === pg.id}
                      style={{ padding: '3px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>
                      {anulando === pg.id ? '...' : 'Anular'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '16px 24px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '600', color: '#555' }}>Nuevo abono</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>Monto ($) *</label>
                <input type="number" min={1} value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })}
                  placeholder={saldo !== null && saldo > 0 ? `Saldo: $${saldo.toLocaleString()}` : '0'}
                  style={estiloInput} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} style={estiloInput} />
              </div>
              <div>
                <label style={labelStyle}>Método de pago</label>
                <select value={form.metodo} onChange={e => setForm({ ...form, metodo: e.target.value })} style={estiloInput}>
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Notas (opcional)</label>
                <input type="text" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Ej: referencia transferencia" style={estiloInput} />
              </div>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => onRegistrar(form)} disabled={guardando}
                style={{ flex: 1, padding: '11px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>
                {guardando ? 'Guardando...' : '✓ Registrar abono'}
              </button>
              <button onClick={onCerrar} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Clientes({ onReset }: { onReset?: () => void } = {}) {
  const [busqueda, setBusqueda] = useState('')
  const [clientes, setClientes] = useState<any[]>([])
  const [vistaActual, setVistaActual] = useState('activos')
  const [datosVista, setDatosVista] = useState<any[]>([])
  const [cargandoVista, setCargandoVista] = useState(false)
  const [clienteSeleccionado, setClienteSeleccionado] = useState<any>(null)
  const [planes, setPlanes] = useState<any[]>([])
  const [clases, setClases] = useState<any[]>([])
  const [inscripcionesTalleres, setInscripcionesTalleres] = useState<any[]>([])
  const [sesionesPorInscripcion, setSesionesPorInscripcion] = useState<Record<string, any[]>>({})
  const [inscripcionExpandida, setInscripcionExpandida] = useState<string | null>(null)
  const [modalHistorialTalleres, setModalHistorialTalleres] = useState(false)
  const [modo, setModo] = useState('lista')
  const [cargando, setCargando] = useState(false)
  const [form, setForm] = useState({
    nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo',
    nombres: '', apellidos: '', fecha_nacimiento: '', numero_identificacion: '', ocupacion: '',
    direccion: '', ciudad: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '',
    menor_de_edad: false, acudiente_nombres: '', acudiente_apellidos: '',
    acudiente_telefono: '', acudiente_documento: '', discapacidad_fisica: false, condicion_aprendizaje: '',
    inasistencia_perdonada: false
  })
  const [profesores, setProfesores] = useState<any[]>([])
  const [instrumentos, setInstrumentos] = useState<any[]>([])
  const [sedes, setSedes] = useState<any[]>([])
  const [modalPlan, setModalPlan] = useState<any>(null)
  const [modalTaller, setModalTaller] = useState(false)
  const [talleres, setTalleres] = useState<any[]>([])
  const [tallerSeleccionado, setTallerSeleccionado] = useState('')
  const [tallerValorPagado, setTallerValorPagado] = useState('')
  const [mesTaller, setMesTaller] = useState('')
  const [tallerGuardando, setTallerGuardando] = useState(false)
  const [tallerError, setTallerError] = useState('')
  const [esRenovacion, setEsRenovacion] = useState(false)
  const [modalHistorial, setModalHistorial] = useState(false)
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  const [errorBorrar, setErrorBorrar] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [expandirFicha, setExpandirFicha] = useState(false)
  const [filtroSede, setFiltroSede] = useState('')
  const [filtroProfesor, setFiltroProfesor] = useState('')
  const [profesoresFiltro, setProfesoresFiltro] = useState<any[]>([])
  // ── Historial por plan: qué planes están expandidos ──
  const [planesExpandidos, setPlanesExpandidos] = useState<Set<string>>(new Set())

  const [pagosPlanes, setPagosPlanes] = useState<Record<string, any[]>>({})
  const [pagosActivosTotales, setPagosActivosTotales] = useState<Record<string, number>>({})
  const [modalAbono, setModalAbono] = useState<any>(null)
  const [abonoGuardando, setAbonoGuardando] = useState(false)
  const [abonoError, setAbonoError] = useState('')

  useEffect(() => {
    cargarBase()
    supabase.from('sedes').select('id, nombre').order('nombre').then(({ data }) => setSedes(data || []))
    supabase.from('profesores').select('id, nombre').order('nombre').then(({ data }) => setProfesoresFiltro(data || []))
  }, [])
  useEffect(() => { if (modo === 'lista' && instrumentos.length > 0) cargarVista(vistaActual) }, [vistaActual, instrumentos])
  useEffect(() => { if (busqueda.length >= 2) buscarClientes(); else setClientes([]) }, [busqueda])

  async function cargarBase() {
    const [{ data: ins }, { data: sed }, { data: pro }] = await Promise.all([
      supabase.from('instrumentos').select('id, nombre').order('nombre'),
      supabase.from('sedes').select('id, nombre').order('nombre'),
      supabase.from('profesores').select('id, nombre').order('nombre'),
    ])
    setInstrumentos(ins || []); setSedes(sed || []); setProfesores(pro || [])
    cargarVista('clientes')
  }

  async function cargarVista(vista: string) {
    setCargandoVista(true)
    if (vista === 'todos') {
      const { data } = await supabase.from('clientes').select('id, nombre, nombres, apellidos, grupo_whatsapp, estado').order('nombre', { ascending: true })
      const clienteIds = (data || []).map((c: any) => c.id)
      let planesActivos: Record<string, boolean> = {}
      if (clienteIds.length > 0) {
        const { data: contratos } = await supabase.from('contratos').select('cliente_id').in('cliente_id', clienteIds).eq('estado', 'activo')
        ;(contratos || []).forEach((ct: any) => { planesActivos[ct.cliente_id] = true })
      }
      setDatosVista((data || []).map((c: any) => ({ ...c, tiene_plan_activo: !!planesActivos[c.id] })))
    } else if (vista === 'activos') {
      const planSelect2 = 'id, cliente_id, total_clases, clases_tomadas, duracion_min, valor_plan, fecha_inicio, estado, clientes(id, nombre, nombres, apellidos), instrumentos(nombre), profesores(nombre), sedes(id, nombre)'
      const { data } = await supabase.from('contratos').select(planSelect2).eq('estado', 'activo').order('clases_tomadas', { ascending: false })
      setDatosVista(data || [])
      const planIds = (data || []).map((p: any) => p.id)
      if (planIds.length > 0) {
        const { data: pgData } = await supabase.from('pagos').select('contrato_id, monto').in('contrato_id', planIds)
        const totales: Record<string, number> = {}
        ;(pgData || []).forEach((pg: any) => {
          totales[pg.contrato_id] = (totales[pg.contrato_id] || 0) + Number(pg.monto)
        })
        setPagosActivosTotales(totales)
      } else {
        setPagosActivosTotales({})
      }
    } else if (vista === 'talleres') {
      const { data } = await supabase
        .from('taller_inscripciones')
        .select('id, mes, valor_pagado, estado, taller_id, cliente_id, clientes(nombre, nombres, apellidos), talleres(nombre, valor_mensual, salones(sedes(nombre)))')
        .neq('estado', 'archivado')
        .order('taller_id', { ascending: true })
      setDatosVista(data || [])
    }
    setCargandoVista(false)
  }

  async function buscarClientes() {
    setCargando(true)
    const { data } = await supabase.from('clientes').select('id, nombre, nombres, apellidos, telefono, email, grupo_whatsapp, estado, created_at, fecha_nacimiento, numero_identificacion, ocupacion, direccion, ciudad, contacto_emergencia_nombre, contacto_emergencia_telefono, menor_de_edad, acudiente_nombres, acudiente_apellidos, acudiente_telefono, acudiente_documento, discapacidad_fisica, condicion_aprendizaje').ilike('nombre', `%${busqueda}%`).order('nombre').limit(20)
    setClientes(data || []); setCargando(false)
  }

  async function cargarDatosCliente(c: any) {
    const { data: talleresData } = await supabase.from('taller_inscripciones').select('id, mes, valor_pagado, estado, taller_id, talleres(nombre, dia_semana, hora, duracion_min, salones(nombre, sedes(nombre)))').eq('cliente_id', c.id).order('mes', { ascending: false })
    setInscripcionesTalleres(talleresData || [])

    const { data: planesData } = await supabase.from('contratos').select('id, total_clases, clases_tomadas, valor_plan, tipo_plan, estado, fecha_inicio, duracion_min, instrumento_id, profesor_id, sede_id, instrumento_id, instrumentos(nombre), profesores(nombre), sedes(nombre)').eq('cliente_id', c.id).order('fecha_inicio', { ascending: false })

    setPlanes(planesData || [])

    const planIds = (planesData || []).map((p: any) => p.id)
    if (planIds.length > 0) {
      const { data: pgData } = await supabase.from('pagos').select('*').in('contrato_id', planIds).order('fecha', { ascending: false })
      const map: Record<string, any[]> = {}
      ;(pgData || []).forEach((pg: any) => {
        if (!map[pg.contrato_id]) map[pg.contrato_id] = []
        map[pg.contrato_id].push(pg)
      })
      setPagosPlanes(map)
    } else {
      setPagosPlanes({})
    }

    const { data: ctList } = await supabase.from('contratos').select('id').eq('cliente_id', c.id)
    const ids = (ctList || []).map((ct: any) => ct.id)
    if (ids.length > 0) {
      // ── Historial por plan: orden ascendente, incluye contrato_id ──
      let clasesData: any[] = []
      try {
        const { data: cd } = await supabase
          .from('clases')
          .select('id, fecha, hora, duracion_min, estado, inasistencia_perdonada, es_cortesia, cancelado_por_academia, observaciones, observaciones_admin, contrato_id, profesores(nombre), salones(sedes(nombre)), contratos(instrumentos(nombre))')
          .in('contrato_id', ids)
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true })
        clasesData = cd || []
      } catch {
        const { data: cd } = await supabase
          .from('clases')
          .select('id, fecha, hora, duracion_min, numero_en_plan, estado, contrato_id, profesores(nombre), salones(sedes(nombre)), contratos(instrumentos(nombre))')
          .in('contrato_id', ids)
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true })
        clasesData = (cd || []).map((c: any) => ({ ...c, inasistencia_perdonada: false, es_cortesia: false, cancelado_por_academia: false, observaciones: null, observaciones_admin: null }))
      }
      setClases(clasesData)
    } else { setClases([]) }
  }

  async function seleccionarClientePorId(clienteId: string) {
    const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).single()
    if (data) seleccionarCliente(data)
  }

  async function seleccionarCliente(c: any) {
    const { data: completo } = await supabase.from('clientes').select('*').eq('id', c.id).single()
    const cliente = completo || c
    setClienteSeleccionado(cliente)
    setForm({
      nombre: cliente.nombre || '', telefono: cliente.telefono || '', email: cliente.email || '',
      grupo_whatsapp: cliente.grupo_whatsapp || '', estado: cliente.estado || 'activo',
      nombres: cliente.nombres || '', apellidos: cliente.apellidos || '',
      fecha_nacimiento: cliente.fecha_nacimiento || '', numero_identificacion: cliente.numero_identificacion || '',
      ocupacion: cliente.ocupacion || '', direccion: cliente.direccion || '', ciudad: cliente.ciudad || '',
      contacto_emergencia_nombre: cliente.contacto_emergencia_nombre || '',
      contacto_emergencia_telefono: cliente.contacto_emergencia_telefono || '',
      menor_de_edad: cliente.menor_de_edad || false, acudiente_nombres: cliente.acudiente_nombres || '',
      acudiente_apellidos: cliente.acudiente_apellidos || '', acudiente_telefono: cliente.acudiente_telefono || '',
      acudiente_documento: cliente.acudiente_documento || '', discapacidad_fisica: cliente.discapacidad_fisica || false,
      condicion_aprendizaje: cliente.condicion_aprendizaje || '',
      inasistencia_perdonada: cliente.inasistencia_perdonada || false
    })
    await cargarDatosCliente(cliente)
    setConfirmarBorrar(false); setErrorBorrar(''); setExpandirFicha(false)
    setPlanesExpandidos(new Set())
    setModo('ver')
  }

  function nuevoCliente() {
    setClienteSeleccionado(null)
    setForm({ nombre: '', telefono: '', email: '', grupo_whatsapp: '', estado: 'activo', nombres: '', apellidos: '', fecha_nacimiento: '', numero_identificacion: '', ocupacion: '', direccion: '', ciudad: '', contacto_emergencia_nombre: '', contacto_emergencia_telefono: '', menor_de_edad: false, acudiente_nombres: '', acudiente_apellidos: '', acudiente_telefono: '', acudiente_documento: '', discapacidad_fisica: false, condicion_aprendizaje: '' })
    setConfirmarBorrar(false); setErrorBorrar(''); setModo('nuevo')
  }

  async function guardar() {
    if (!form.nombres.trim()) return alert('El nombre es obligatorio')
    setCargando(true)
    const payload = { ...form, nombre: `${form.nombres.trim()} ${form.apellidos.trim()}`.trim(), fecha_nacimiento: form.fecha_nacimiento && form.fecha_nacimiento.trim() !== '' ? form.fecha_nacimiento : null, inasistencia_perdonada: form.inasistencia_perdonada || false }
    if (modo === 'nuevo') {
      const { data, error } = await supabase.from('clientes').insert(payload).select().single()
      if (!error && data) { setClienteSeleccionado(data); await cargarDatosCliente(data); setModo('ver'); cargarVista(vistaActual) }
      else if (error) alert('Error al crear cliente: ' + error.message)
    } else {
      const { error } = await supabase.from('clientes').update(payload).eq('id', clienteSeleccionado.id)
      if (!error) { setClienteSeleccionado({ ...clienteSeleccionado, ...form }); setModo('ver') }
      else alert('Error al actualizar: ' + error.message)
    }
    setCargando(false)
  }

  async function intentarBorrarCliente() {
    setBorrando(true); setErrorBorrar('')
    const { data: ctList } = await supabase.from('contratos').select('id').eq('cliente_id', clienteSeleccionado.id)
    const ids = (ctList || []).map((ct: any) => ct.id)
    if (ids.length > 0) {
      const hoy = new Date().toISOString().split('T')[0]
      const { data: pendientes } = await supabase.from('clases').select('id').in('contrato_id', ids).in('estado', ['programada', 'confirmada']).gte('fecha', hoy)
      if (pendientes && pendientes.length > 0) { setErrorBorrar(`Este cliente tiene ${pendientes.length} clase(s) programada(s). Bórralas primero desde Horarios.`); setBorrando(false); return }
    }
    const clienteId = clienteSeleccionado.id
    if (ids.length > 0) {
      const { data: inscrip } = await supabase.from('taller_inscripciones').select('id').eq('cliente_id', clienteId)
      const inscripIds = (inscrip || []).map((i: any) => i.id)
      if (inscripIds.length > 0) await supabase.from('taller_asistencias').delete().in('inscripcion_id', inscripIds)
      await supabase.from('taller_inscripciones').delete().eq('cliente_id', clienteId)
      await supabase.from('pagos').delete().in('contrato_id', ids)
      await supabase.from('clases').delete().in('contrato_id', ids)
      await supabase.from('contratos').delete().eq('cliente_id', clienteId)
    }
    const { error } = await supabase.from('clientes').delete().eq('id', clienteId)
    if (error) { setErrorBorrar('Error al borrar: ' + error.message); setBorrando(false); return }
    cargarVista(vistaActual); setModo('lista'); setBusqueda(''); setClientes([]); setBorrando(false)
  }

  async function cambiarEstadoPlan(planId: string, nuevoEstado: string) {
    setPlanes(prev => prev.map(p => p.id === planId ? { ...p, estado: nuevoEstado } : p))
    if (nuevoEstado === 'archivado') {
      const hoy = new Date().toISOString().split('T')[0]
      await supabase.from('clases').delete().eq('contrato_id', planId).eq('estado', 'programada').gte('fecha', hoy)
    }
    const { error } = await supabase.from('contratos').update({ estado: nuevoEstado }).eq('id', planId)
    if (error) { alert('Error: ' + error.message); await cargarDatosCliente(clienteSeleccionado) }
    cargarVista(vistaActual)
  }

  async function cargarSesionesInscripcion(inscripcionId: string, tallerId: string) {
    if (sesionesPorInscripcion[inscripcionId]) { setInscripcionExpandida(prev => prev === inscripcionId ? null : inscripcionId); return }
    const { data: sesiones } = await supabase.from('taller_sesiones').select('id, fecha, estado').eq('taller_id', tallerId).eq('estado', 'dada').order('fecha', { ascending: false })
    if (!sesiones || sesiones.length === 0) { setSesionesPorInscripcion(prev => ({ ...prev, [inscripcionId]: [] })); setInscripcionExpandida(inscripcionId); return }
    const sesionIds = sesiones.map((s: any) => s.id)
    const { data: asistencias } = await supabase.from('taller_asistencias').select('id, sesion_id, asistio').eq('inscripcion_id', inscripcionId).in('sesion_id', sesionIds)
    const asistenciaMap: Record<string, any> = {}
    ;(asistencias || []).forEach((a: any) => { asistenciaMap[a.sesion_id] = a })
    setSesionesPorInscripcion(prev => ({ ...prev, [inscripcionId]: sesiones.map((s: any) => ({ ...s, asistencia: asistenciaMap[s.id] || null })) }))
    setInscripcionExpandida(inscripcionId)
  }

  async function toggleAsistencia(inscripcionId: string, sesion: any, asistio: boolean) {
    if (sesion.asistencia) await supabase.from('taller_asistencias').update({ asistio }).eq('id', sesion.asistencia.id)
    else await supabase.from('taller_asistencias').insert({ sesion_id: sesion.id, inscripcion_id: inscripcionId, asistio })
    setSesionesPorInscripcion(prev => ({ ...prev, [inscripcionId]: (prev[inscripcionId] || []).map((s: any) => s.id === sesion.id ? { ...s, asistencia: { ...(s.asistencia || {}), asistio } } : s) }))
  }

  async function cambiarEstadoInscripcion(inscripcionId: string, nuevoEstado: string) {
    setInscripcionesTalleres(prev => prev.map(i => i.id === inscripcionId ? { ...i, estado: nuevoEstado } : i))
    const { error } = await supabase.from('taller_inscripciones').update({ estado: nuevoEstado }).eq('id', inscripcionId)
    if (error) { alert('Error: ' + error.message); await cargarDatosCliente(clienteSeleccionado) }
  }

  async function renovarInscripcionTaller(inscripcion: any) {
    const hoy = new Date()
    const mesDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    const { error } = await supabase.from('taller_inscripciones').insert({
      taller_id: inscripcion.taller_id, cliente_id: clienteSeleccionado.id,
      mes: mesDefault, valor_pagado: inscripcion.valor_pagado, estado: 'activo'
    })
    if (error) { alert('Error al renovar: ' + error.message); return }
    await supabase.from('taller_inscripciones').update({ estado: 'archivado' }).eq('id', inscripcion.id)
    await cargarDatosCliente(clienteSeleccionado)
  }

  async function abrirModalTaller() {
    const { data } = await supabase
      .from('talleres')
      .select('id, nombre, dia_semana, hora, duracion_min, valor_mensual, profesores(nombre), salones(nombre, sedes(nombre))')
      .neq('estado', 'archivado')
      .order('nombre')
    const hoy = new Date()
    const mesDefault = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    setTalleres(data || [])
    setTallerSeleccionado('')
    setTallerValorPagado('')
    setTallerError('')
    setMesTaller(mesDefault)
    setModalTaller(true)
  }

  async function inscribirEnTaller() {
    if (!tallerSeleccionado) { setTallerError('Selecciona un taller'); return }
    if (!mesTaller) { setTallerError('Selecciona el mes'); return }
    setTallerGuardando(true); setTallerError('')
    const { data: yaInscrito } = await supabase
      .from('taller_inscripciones').select('id')
      .eq('taller_id', tallerSeleccionado)
      .eq('cliente_id', clienteSeleccionado.id)
      .eq('estado', 'activo')
      .eq('mes', mesTaller)
    if (yaInscrito && yaInscrito.length > 0) {
      setTallerError('Este cliente ya está inscrito en ese taller ese mes.')
      setTallerGuardando(false); return
    }
    const taller = talleres.find((t: any) => t.id === tallerSeleccionado)
    const { error } = await supabase.from('taller_inscripciones').insert({
      taller_id: tallerSeleccionado, cliente_id: clienteSeleccionado.id, mes: mesTaller,
      valor_pagado: tallerValorPagado !== '' ? Number(tallerValorPagado) : (taller?.valor_mensual || null),
      estado: 'activo'
    })
    if (error) { setTallerError('Error: ' + error.message); setTallerGuardando(false); return }
    setModalTaller(false); setTallerGuardando(false)
    await cargarDatosCliente(clienteSeleccionado)
  }

  async function guardarPlan(payload: any, planId?: string) {
    const registro = { ...payload, cliente_id: clienteSeleccionado.id }
    if (planId) {
      const { error } = await supabase.from('contratos').update(registro).eq('id', planId)
      if (error) { alert('Error al actualizar plan: ' + error.message); return }
    } else {
      const { data: nuevoPlan, error } = await supabase.from('contratos').insert(registro).select().single()
      if (error) { alert('Error al crear plan: ' + error.message); return }
      if (esRenovacion && modalPlan?.id && nuevoPlan) {
        const hoy = new Date().toISOString().split('T')[0]
        const updateClases: any = { contrato_id: nuevoPlan.id }
        if (Number(payload.duracion_min) !== Number(modalPlan.duracion_min)) updateClases.duracion_min = payload.duracion_min
        await supabase.from('clases').update(updateClases).eq('contrato_id', modalPlan.id).eq('estado', 'programada').gte('fecha', hoy)
        await supabase.from('contratos').update({ estado: 'archivado' }).eq('id', modalPlan.id)
      }
    }
    setModalPlan(null); setEsRenovacion(false)
    await cargarDatosCliente(clienteSeleccionado)
    cargarVista(vistaActual)
  }

  async function registrarAbono(formAbono: { monto: string; metodo: string; fecha: string; notas: string }) {
    if (!formAbono.monto || Number(formAbono.monto) <= 0) { setAbonoError('Ingresa un monto válido'); return }
    if (!formAbono.fecha) { setAbonoError('Selecciona una fecha'); return }
    setAbonoGuardando(true); setAbonoError('')
    const { error } = await supabase.from('pagos').insert({
      contrato_id: modalAbono.id,
      monto: Number(formAbono.monto),
      fecha: formAbono.fecha,
      metodo: formAbono.metodo,
      notas: formAbono.notas || null
    })
    if (error) { setAbonoError('Error: ' + error.message); setAbonoGuardando(false); return }
    setModalAbono(null); setAbonoGuardando(false)
    await cargarDatosCliente(clienteSeleccionado)
    if (vistaActual === 'activos') cargarVista('activos')
  }

  async function anularAbono(pagoId: string, contratoId: string) {
    const { error } = await supabase.from('pagos').delete().eq('id', pagoId)
    if (error) { alert('Error al anular: ' + error.message); return }
    setPagosPlanes(prev => ({
      ...prev,
      [contratoId]: (prev[contratoId] || []).filter((p: any) => p.id !== pagoId)
    }))
    if (vistaActual === 'activos') cargarVista('activos')
  }

  // ── Perdonar inasistencia: descuenta del conteo y marca la clase ──
  async function perdonarInasistencia(claseId: string, contratoId: string) {
    await supabase.from('clases').update({ inasistencia_perdonada: true }).eq('id', claseId)
    const plan = planes.find((p: any) => p.id === contratoId)
    if (plan) {
      const nuevasCT = Math.max((plan.clases_tomadas || 0) - 1, 0)
      await supabase.from('contratos').update({
        clases_tomadas: nuevasCT,
        inasistencia_perdonada_usada: true
      }).eq('id', contratoId)
    }
    await cargarDatosCliente(clienteSeleccionado)
    cargarVista(vistaActual)
  }

  // ── Modal de cortesía ──
  const [modalCortesia, setModalCortesia] = useState<{ claseId: string; contratoId: string; clase: any } | null>(null)
  const [justificacionCortesia, setJustificacionCortesia] = useState('')
  const [guardandoCortesia, setGuardandoCortesia] = useState(false)

  // ── Marcar clase como cortesía: requiere justificación guardada en observaciones_admin ──
  async function marcarCortesia(claseId: string, contratoId: string, justificacion: string) {
    // Quitar numero_en_plan a la clase cortesía
    await supabase.from('clases').update({
      es_cortesia: true,
      numero_en_plan: null,
      observaciones_admin: justificacion.trim() || null
    }).eq('id', claseId)
    const plan = planes.find((p: any) => p.id === contratoId)
    if (plan) {
      const nuevasCT = Math.max((plan.clases_tomadas || 0) - 1, 0)
      await supabase.from('contratos').update({ clases_tomadas: nuevasCT }).eq('id', contratoId)
      // Recalcular numero_en_plan de TODAS las clases del contrato (dadas reales + pendientes)
      const { data: todasClases } = await supabase.from('clases')
        .select('id, estado, es_cortesia, cancelado_por_academia, inasistencia_perdonada')
        .eq('contrato_id', contratoId)
        .order('fecha').order('hora')
      if (todasClases && todasClases.length > 0) {
        let conteo = 0
        const updates: { id: string; numero: number | null }[] = todasClases.map((cl: any) => {
          const cuenta = (cl.estado === 'dada' && !cl.es_cortesia) ||
                         (cl.estado === 'cancelada' && !cl.cancelado_por_academia && !cl.inasistencia_perdonada)
          if (cuenta) conteo++
          const esFutura = cl.estado === 'programada' || cl.estado === 'confirmada'
          return { id: cl.id, numero: cuenta ? conteo : esFutura ? (conteo + 1) : null }
        })
        // Actualizar en lotes: primero nulls, luego valores
        const toNull = updates.filter(u => u.numero === null).map(u => u.id)
        if (toNull.length > 0) await supabase.from('clases').update({ numero_en_plan: null }).in('id', toNull)
        const conNumero = updates.filter(u => u.numero !== null)
        for (const u of conNumero) {
          await supabase.from('clases').update({ numero_en_plan: u.numero }).eq('id', u.id)
        }
      }
    }
    setModalCortesia(null)
    setJustificacionCortesia('')
    setGuardandoCortesia(false)
    await cargarDatosCliente(clienteSeleccionado)
    cargarVista(vistaActual)
  }

  function formatFechaCorta(iso: string) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
  }

  const porcentaje = (p: any) => Math.min((p.clases_tomadas / p.total_clases) * 100, 100)
  const colorBarra = (p: any) => {
    if (p.estado === 'completado') return '#166534'
    if (p.estado === 'aplazado')   return '#92400e'
    const pct = porcentaje(p)
    if (pct >= 100) return '#ef4444'
    if (pct >= 75)  return '#f59e0b'
    return TEAL
  }

  const thStyle: React.CSSProperties = { padding: '6px 7px', textAlign: 'left', fontSize: '11px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
  const tdStyle: React.CSSProperties = { padding: '6px 7px', fontSize: '12px', color: '#333', whiteSpace: 'nowrap' }
  const planesActivos = planes.filter(p => (p.estado || 'activo') !== 'archivado')
  const planesArchivados = planes.filter(p => p.estado === 'archivado')

  return (
    <div style={{ padding: '16px 12px', height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 }}>
        <div style={{ textAlign: 'left' }}>
          <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a' }}>Clientes</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Busca, crea y gestiona clientes</p>
        </div>
        <button onClick={nuevoCliente} style={{ padding: '11px 22px', background: TEAL, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>+ Nuevo cliente</button>
      </div>

      {modo === 'lista' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input placeholder="Buscar cliente por nombre..." value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus
                style={{ ...estiloInput, marginTop: 0, paddingLeft: '44px', fontSize: '15px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }} />
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '18px' }}>🔍</span>
            </div>
            {busqueda.length < 2 && (
              <select value={vistaActual} onChange={e => setVistaActual(e.target.value)}
                style={{ padding: '10px 14px', border: `2px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '14px', fontWeight: '500', color: '#333', background: 'white', cursor: 'pointer', minWidth: '300px' }}>
                {VISTAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            )}
          </div>

          {busqueda.length >= 2 && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cargando && <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>Buscando...</div>}
              {clientes.map((c: any) => (
                <div key={c.id} onClick={() => seleccionarCliente(c)} style={{ background: 'white', borderRadius: '12px', padding: '14px 20px', marginBottom: '8px', cursor: 'pointer', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = TEAL_MID)} onMouseLeave={e => (e.currentTarget.style.borderColor = '#eef2f7')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: TEAL_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: '600', color: TEAL }}>{c.nombre.charAt(0).toUpperCase()}</div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#1a1a1a' }}>{c.nombre}</p>
                      <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#888' }}>{c.telefono || '—'} · {c.grupo_whatsapp || '—'}</p>
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: c.estado === 'activo' ? TEAL_LIGHT : '#fee2e2', color: c.estado === 'activo' ? TEAL : '#991b1b' }}>{c.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
                </div>
              ))}
              {clientes.length === 0 && !cargando && (
                <div style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                  <p style={{ fontSize: '28px', margin: '0 0 8px' }}>🔍</p>
                  <p style={{ margin: 0 }}>No se encontraron clientes</p>
                </div>
              )}
            </div>
          )}

          {busqueda.length < 2 && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              {cargandoVista && <div style={{ textAlign: 'center', padding: '32px', color: '#666' }}>Cargando...</div>}

              {!cargandoVista && vistaActual === 'todos' && (
                <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
                      <tr><th style={{...thStyle, width: '40px'}}>#</th>{['Nombre', 'Apellido', 'Grupo WhatsApp', 'Plan activo', 'Estado'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {datosVista.length === 0 && <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Sin clientes</td></tr>}
                      {datosVista.map((c: any, i) => (
                        <tr key={c.id} onClick={() => seleccionarCliente(c)} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)} onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#fafbfc')}>
                          <td style={{ ...tdStyle, color: '#aaa', textAlign: 'left' }}>{i + 1}</td>
                          <td style={{ ...tdStyle, fontWeight: '600', color: TEAL, textAlign: 'left' }}>{c.nombres || c.nombre}</td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>{c.apellidos || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>{c.grupo_whatsapp || '—'}</td>
                          <td style={{ ...tdStyle, textAlign: 'left' }}>{c.tiene_plan_activo ? <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>✓ Sí</span> : <span style={{ background: '#f1f5f9', color: '#94a3b8', padding: '2px 10px', borderRadius: '20px', fontSize: '12px' }}>No</span>}</td>
                          <td style={tdStyle}><span style={{ background: c.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: c.estado === 'activo' ? '#166534' : '#991b1b', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{c.estado === 'activo' ? 'Activo' : 'Inactivo'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!cargandoVista && vistaActual === 'activos' && (() => {
                let datos = [...datosVista]
                if (filtroSede) datos = datos.filter((p: any) => p.sedes?.id === filtroSede)
                if (filtroProfesor) datos = datos.filter((p: any) => p.profesores?.id === filtroProfesor)
                datos.sort((a: any, b: any) => ((a.total_clases || 0) - (a.clases_tomadas || 0)) - ((b.total_clases || 0) - (b.clases_tomadas || 0)))
                return (
                  <div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select value={filtroSede} onChange={e => setFiltroSede(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px', background: 'white' }}>
                        <option value="">Todas las sedes</option>
                        {sedes.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                      <select value={filtroProfesor} onChange={e => setFiltroProfesor(e.target.value)} style={{ padding: '7px 12px', border: `1px solid ${TEAL_MID}`, borderRadius: '8px', fontSize: '13px', background: 'white' }}>
                        <option value="">Todos los profesores</option>
                        {profesoresFiltro.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                      </select>
                      <span style={{ marginLeft: 'auto', fontSize: '13px', color: '#666' }}>{datos.length} planes</span>
                    </div>
                    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                      <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
                          <tr>
                              <th style={{ ...thStyle, textAlign: 'center' }}>#</th>
                              <th style={{ ...thStyle }}>Cliente</th>
                              {['Instrumento', 'Profesor', 'Sede', 'Min', 'Total', 'Tomadas', 'Rest.', 'Valor', 'Pagado', 'Saldo'].map(h => <th key={h} style={{ ...thStyle, textAlign: ['Min','Total','Tomadas','Rest.','Valor','Pagado','Saldo'].includes(h) ? 'center' : 'left' }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                          {datos.length === 0 && <tr><td colSpan={12} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Sin planes activos</td></tr>}
                          {datos.map((p: any, i) => {
                            const tomadas = p.clases_tomadas || 0, total = p.total_clases || 0, restantes = total - tomadas
                            const nombreCliente = p.clientes?.nombres ? `${p.clientes.nombres} ${p.clientes.apellidos || ''}`.trim() : p.clientes?.nombre || '—'
                            const colorFila = restantes === 0 ? '#fefce8' : restantes <= 2 ? '#fff7ed' : i % 2 === 0 ? 'white' : '#fafbfc'
                            const totalPagado = pagosActivosTotales[p.id] || 0
                            const valorPlan = p.valor_plan ? Number(p.valor_plan) : null
                            const saldoPlan = valorPlan !== null ? valorPlan - totalPagado : null
                            const estPagoReal = valorPlan === null ? 'Sin valor' : totalPagado === 0 ? 'Sin pagar' : totalPagado >= valorPlan ? 'Pagado' : 'Parcial'
                            const cPago = colorEstadoPago(estPagoReal)
                            return (
                              <tr key={p.id} onClick={() => seleccionarClientePorId(p.cliente_id)} style={{ borderTop: '1px solid #f8fafc', background: colorFila, cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)} onMouseLeave={e => (e.currentTarget.style.background = colorFila)}>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#aaa' }}>{i + 1}</td>
                                <td style={{ ...tdStyle, textAlign: 'left', fontWeight: '600', color: TEAL, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreCliente}</td>
                                <td style={{ ...tdStyle, textAlign: 'left', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.instrumentos?.nombre || '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'left', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.profesores?.nombre || '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'left' }}>{p.sedes?.nombre || '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{p.duracion_min || '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{total}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{tomadas}</td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontWeight: '700', color: restantes === 0 ? '#854d0e' : restantes <= 2 ? '#c2410c' : '#166534' }}>{restantes === 0 ? '✓ Completo' : restantes}</span></td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{valorPlan ? `$${valorPlan.toLocaleString()}` : '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: '#166534', fontWeight: '500' }}>{totalPagado > 0 ? `$${totalPagado.toLocaleString()}` : '—'}</td>
                                <td style={{ ...tdStyle, textAlign: 'center', color: saldoPlan && saldoPlan > 0 ? '#991b1b' : '#166534', fontWeight: '500' }}>{saldoPlan !== null ? (saldoPlan > 0 ? `$${saldoPlan.toLocaleString()}` : '✓') : '—'}</td>

                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}

              {!cargandoVista && vistaActual === 'talleres' && (() => {
                const hoy = new Date().toISOString().split('T')[0].substring(0, 7) + '-01'
                const grupos: Record<string, any[]> = {}
                datosVista.forEach((ins: any) => {
                  const nombre = ins.talleres?.nombre || '—'
                  if (!grupos[nombre]) grupos[nombre] = []
                  grupos[nombre].push(ins)
                })
                const gruposOrdenados = Object.keys(grupos).sort()
                const thS: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }
                const tdS: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap' }
                return (
                  <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: TEAL_LIGHT, zIndex: 1 }}>
                        <tr>{['Cliente', 'Taller', 'Sede', 'Fecha inicio', 'Fecha fin', 'Valor mensual', 'Valor pagado', 'Estado'].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {gruposOrdenados.length === 0 && <tr><td colSpan={8} style={{ padding: '32px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Sin inscripciones activas</td></tr>}
                        {gruposOrdenados.map(nombreTaller => {
                          const inscrips = grupos[nombreTaller].slice().sort((a: any, b: any) => {
                            const nA = a.clientes?.nombres || a.clientes?.nombre || ''
                            const nB = b.clientes?.nombres || b.clientes?.nombre || ''
                            return nA.localeCompare(nB, 'es')
                          })
                          return inscrips.map((ins: any, i) => {
                            const nombreCliente = ins.clientes?.nombres
                              ? `${ins.clientes.nombres} ${ins.clientes.apellidos || ''}`.trim()
                              : ins.clientes?.nombre || '—'
                            const fechaIni = ins.mes ? ins.mes.substring(0, 10) : '—'
                            const fechaFinLabel = ins.mes ? (() => {
                              const d = new Date(ins.mes + 'T12:00:00')
                              const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                              return fin.toISOString().split('T')[0]
                            })() : '—'
                            const vencida = ins.mes ? ins.mes < hoy : false
                            const bgFila = vencida ? '#fff0ee' : i % 2 === 0 ? 'white' : '#fafbfc'
                            const colorEstBadge = ins.estado === 'activo'
                              ? { bg: '#f3e8ff', color: '#7c3aed' }
                              : ins.estado === 'completado'
                              ? { bg: '#dcfce7', color: '#166534' }
                              : { bg: '#f1f5f9', color: '#64748b' }
                            return (
                              <tr key={ins.id}
                                onClick={() => seleccionarClientePorId(ins.cliente_id)}
                                style={{ borderTop: i === 0 ? `2px solid ${TEAL_MID}` : '1px solid #f8fafc', background: bgFila, cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = TEAL_LIGHT)}
                                onMouseLeave={e => (e.currentTarget.style.background = bgFila)}>
                                <td style={{ ...tdS, fontWeight: '600', color: TEAL }}>{nombreCliente}</td>
                                <td style={{ ...tdS, fontWeight: i === 0 ? '700' : '400', color: i === 0 ? '#1a1a1a' : '#555' }}>{nombreTaller}</td>
                                <td style={tdS}>{ins.talleres?.salones?.sedes?.nombre || '—'}</td>
                                <td style={{ ...tdS, color: '#888' }}>{fechaIni}</td>
                                <td style={{ ...tdS, color: vencida ? '#dc2626' : '#888', fontWeight: vencida ? '600' : '400' }}>{fechaFinLabel} {vencida ? '⚠️' : ''}</td>
                                <td style={tdS}>{ins.talleres?.valor_mensual ? `$${Number(ins.talleres.valor_mensual).toLocaleString()}` : '—'}</td>
                                <td style={{ ...tdS, color: '#166534', fontWeight: '500' }}>{ins.valor_pagado ? `$${Number(ins.valor_pagado).toLocaleString()}` : '—'}</td>
                                <td style={tdS}><span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: colorEstBadge.bg, color: colorEstBadge.color }}>{ins.estado}</span></td>
                              </tr>
                            )
                          })
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      )}

      {modo === 'nuevo' && <FormCliente modo={modo} form={form} setForm={setForm} cargando={cargando} onGuardar={guardar} onVolver={() => setModo('lista')} />}
      {modo === 'editar' && <FormCliente modo={modo} form={form} setForm={setForm} cargando={cargando} onGuardar={guardar} onVolver={() => setModo('ver')} />}

      {modo === 'ver' && clienteSeleccionado && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <button onClick={() => { setModo('lista'); setBusqueda(''); setClientes([]) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEAL, fontSize: '14px', marginBottom: '20px', padding: 0, fontWeight: '500' }}>← Volver a la lista</button>

          {/* Ficha cliente */}
          <div style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
            <div style={{ background: TEAL, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: 'white' }}>{form.nombre.charAt(0).toUpperCase()}</div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '22px' }}>{form.nombre}</h3>
                  <span style={{ display: 'inline-block', marginTop: '6px', padding: '3px 12px', borderRadius: '20px', fontSize: '12px', background: form.estado === 'activo' ? 'rgba(255,255,255,0.25)' : 'rgba(239,68,68,0.4)', color: 'white', fontWeight: '500' }}>{form.estado === 'activo' ? '● Activo' : '● Inactivo'}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setModo('editar')} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Editar</button>
                <button onClick={() => { setConfirmarBorrar(true); setErrorBorrar('') }} style={{ padding: '8px 18px', background: 'rgba(220,38,38,0.3)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Borrar</button>
              </div>
            </div>
            <div style={{ padding: '14px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              {[{ icon: '📱', label: 'Teléfono', valor: form.telefono }, { icon: '✉️', label: 'Correo', valor: form.email }, { icon: '💬', label: 'Grupo WhatsApp', valor: form.grupo_whatsapp }].map(d => (
                <div key={d.label}><p style={{ margin: '0 0 3px', fontSize: '12px', color: '#999', fontWeight: '600' }}>{d.icon} {d.label}</p><p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{d.valor || '—'}</p></div>
              ))}
            </div>
            <div style={{ borderTop: '1px solid #eef2f7' }}>
              <button onClick={() => setExpandirFicha(prev => !prev)} style={{ width: '100%', padding: '7px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: TEAL, fontWeight: '500' }}>{expandirFicha ? '▲ Ocultar datos completos' : '▼ Ver datos completos'}</button>
            </div>
            {expandirFicha && (
              <div style={{ padding: '14px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: '#fafbfc', borderTop: '1px solid #eef2f7' }}>
                {[{ icon: '🎂', label: 'Fecha de nacimiento', valor: form.fecha_nacimiento }, { icon: '🪪', label: 'Identificación', valor: form.numero_identificacion }, { icon: '💼', label: 'Ocupación', valor: form.ocupacion }, { icon: '📍', label: 'Dirección', valor: form.direccion }, { icon: '🏙️', label: 'Ciudad', valor: form.ciudad }, { icon: '🚨', label: 'Contacto emergencia', valor: form.contacto_emergencia_nombre ? `${form.contacto_emergencia_nombre} · ${form.contacto_emergencia_telefono}` : null }].map(d => (
                  <div key={d.label}><p style={{ margin: '0 0 3px', fontSize: '12px', color: '#999', fontWeight: '600' }}>{d.icon} {d.label}</p><p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{d.valor || '—'}</p></div>
                ))}
                {form.menor_de_edad && (
                  <div style={{ gridColumn: '1 / -1', background: TEAL_LIGHT, borderRadius: '8px', padding: '10px 14px' }}>
                    <p style={{ margin: '0 0 3px', fontSize: '12px', color: TEAL, fontWeight: '600' }}>👨‍👩‍👦 Acudiente</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#333' }}>{form.acudiente_nombres} {form.acudiente_apellidos} · {form.acudiente_telefono}{form.acudiente_documento ? ` · Doc: ${form.acudiente_documento}` : ''}</p>
                  </div>
                )}
                {(form.discapacidad_fisica || form.condicion_aprendizaje) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    {form.discapacidad_fisica && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#dc2626' }}>⚠️ Presenta discapacidad física</p>}
                    {form.condicion_aprendizaje && <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>📚 {form.condicion_aprendizaje}</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          {confirmarBorrar && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
              <p style={{ margin: '0 0 6px', fontSize: '16px', color: '#991b1b', fontWeight: '700' }}>¿Borrar a {form.nombre}?</p>
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#666' }}>Esta acción no se puede deshacer.</p>
              {errorBorrar && <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#dc2626', fontWeight: '500', background: '#fee2e2', padding: '10px 14px', borderRadius: '8px' }}>⚠️ {errorBorrar}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={intentarBorrarCliente} disabled={borrando} style={{ padding: '9px 22px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>{borrando ? 'Verificando...' : 'Sí, borrar cliente'}</button>
                <button onClick={() => { setConfirmarBorrar(false); setErrorBorrar('') }} style={{ padding: '9px 22px', background: 'white', color: '#333', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Planes */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>Planes activos <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({planesActivos.length})</span></h3>
              {planesArchivados.length > 0 && <button onClick={() => setModalHistorial(true)} style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>📋 Ver historial ({planesArchivados.length} archivados)</button>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { setEsRenovacion(false); setModalPlan({}) }} style={{ padding: '8px 18px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Crear plan</button>
              <button onClick={abrirModalTaller} style={{ padding: '8px 18px', background: 'white', color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}>+ Asignar a taller</button>
            </div>
          </div>

          {planesActivos.length === 0 && <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#888', marginBottom: '24px' }}>Sin planes activos o aplazados</div>}

          {planesActivos.map((p: any) => {
            const est = colorEstadoPlan(p.estado || 'activo')
            const pagosPlan = pagosPlanes[p.id] || []
            const { totalPagado, saldo, estado: estPago } = calcularEstadoPago(p.valor_plan ?? null, pagosPlan)
            const cPago = colorEstadoPago(estPago)

            // ── Historial de clases de este plan ──
            // Calcular conteo en orden cronológico (ascendente)
            const clasesDelPlanAsc = clases
              .filter((c: any) => c.contrato_id === p.id)
              .sort((a: any, b: any) => `${a.fecha}T${a.hora||'00:00'}`.localeCompare(`${b.fecha}T${b.hora||'00:00'}`))

            // Duración del plan para calcular fracciones
            const durPlan = p.duracion_min || 60
            let conteoClases = 0  // acumulado fraccionario
            const clasesConConteo = clasesDelPlanAsc.map((c: any) => {
              // dada (no cortesía) + cancelada por inasistencia cliente (no academia) sin perdonar = suma al plan
              const esInasistenciaCliente = c.estado === 'cancelada' && !c.cancelado_por_academia
              const cuentaEnPlan = (c.estado === 'dada' && !c.es_cortesia) || (esInasistenciaCliente && !c.inasistencia_perdonada)
              if (cuentaEnPlan) {
                const fraccion = parseFloat(((c.duracion_min || durPlan) / durPlan).toFixed(4))
                conteoClases = parseFloat((conteoClases + fraccion).toFixed(4))
              }
              return { ...c, numeroConteo: cuentaEnPlan ? conteoClases : null }
            })

            // Invertir para mostrar: lo más reciente arriba
            const clasesDelPlan = clasesConConteo.slice().reverse()

            const estaExpandido = planesExpandidos.has(p.id)

            return (
              <div key={p.id} style={{ background: 'white', borderRadius: '18px', padding: '20px 24px', border: `1px solid ${est.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>{p.instrumentos?.nombre || '—'}</p>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', background: est.bg, color: est.color, fontWeight: '600' }}>{p.estado || 'activo'}</span>

                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>👤 {p.profesores?.nombre || '—'} · 🏫 {p.sedes?.nombre || '—'}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>📅 {p.fecha_inicio || '—'} · {p.duracion_min} min/clase</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <p style={{ margin: 0, fontSize: '26px', fontWeight: '700', color: colorBarra(p) }}>{Math.max(conteoClases, parseFloat((p.clases_tomadas||0).toString()))}<span style={{ fontSize: '14px', color: '#aaa', fontWeight: '400' }}>/{p.total_clases}</span></p>
                    <button onClick={() => { setEsRenovacion(false); setModalPlan(p) }} style={{ padding: '5px 14px', background: TEAL_LIGHT, color: TEAL, border: `1px solid ${TEAL_MID}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Editar</button>
                  </div>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ height: '8px', borderRadius: '6px', width: `${Math.min((Math.max(conteoClases, parseFloat((p.clases_tomadas||0).toString()))/p.total_clases)*100,100)}%`, background: colorBarra(p), transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>{parseFloat((p.total_clases - Math.max(conteoClases, parseFloat((p.clases_tomadas||0).toString()))).toFixed(2))} clases restantes</span>
                  <span style={{ fontSize: '14px', color: '#555', fontWeight: '500' }}>{p.valor_plan ? `$${Number(p.valor_plan).toLocaleString()}` : '—'}</span>
                </div>

                {/* Sección de pagos */}
                <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '12px 14px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#555', fontWeight: '600' }}>TOTAL PAGADO</p>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#166534' }}>${totalPagado.toLocaleString()}</p>
                    </div>
                    {saldo !== null && (
                      <div>
                        <p style={{ margin: '0 0 2px', fontSize: '11px', color: '#555', fontWeight: '600' }}>SALDO PENDIENTE</p>
                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: saldo > 0 ? '#991b1b' : '#166534' }}>{saldo > 0 ? `$${saldo.toLocaleString()}` : '✓ Al día'}</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: cPago.bg, color: cPago.color, border: `1px solid ${cPago.border}` }}>{estPago}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setModalAbono(p); setAbonoError('') }}
                    style={{ padding: '7px 16px', background: TEAL, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    + Registrar abono
                  </button>
                </div>

                {/* ── Historial de clases del plan ── */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '4px' }}>
                  <button
                    onClick={() => setPlanesExpandidos(prev => {
                      const next = new Set(prev)
                      next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                      return next
                    })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: TEAL, fontWeight: '500', padding: '0', marginBottom: estaExpandido ? '10px' : '0' }}>
                    {estaExpandido ? '▲ Ocultar historial' : `▼ Ver historial del plan (${clasesDelPlan.length} clases)`}
                  </button>

                  {estaExpandido && (
                    <div style={{ background: '#fafbfc', borderRadius: '10px', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                      {clasesDelPlan.length === 0 ? (
                        <p style={{ margin: 0, padding: '16px', textAlign: 'center', color: '#aaa', fontSize: '13px' }}>Sin clases registradas en este plan aún</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: TEAL_LIGHT }}>
                              {['#', 'Fecha', 'Hora', 'Profesor', 'Sede', 'Estado', 'Resumen'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', color: TEAL, fontWeight: '600', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {clasesDelPlan.map((c: any, i) => {
                              const esPerdonada = c.estado === 'cancelada' && c.inasistencia_perdonada
                              const esCanceladaAcademia = c.estado === 'cancelada' && c.cancelado_por_academia
                              const esInasistencia = c.estado === 'cancelada' && !c.cancelado_por_academia && !c.inasistencia_perdonada
                              const esCortesia = c.es_cortesia
                              const estadoColor =
                                esCortesia        ? { bg: '#e0f2fe', color: '#0369a1' } :
                                c.estado === 'dada' ? { bg: '#fefce8', color: '#854d0e' } :
                                esInasistencia    ? { bg: '#fff7ed', color: '#c2410c' } :
                                esCanceladaAcademia ? { bg: '#f1f5f9', color: '#64748b' } :
                                c.estado === 'cancelada' ? { bg: '#fee2e2', color: '#991b1b' } :
                                c.estado === 'confirmada' ? { bg: '#dcfce7', color: '#166534' } :
                                                            { bg: TEAL_LIGHT, color: TEAL }
                              const etiquetaEstado =
                                esCortesia          ? '🎁 Cortesía' :
                                esInasistencia      ? 'Inasistencia' :
                                esCanceladaAcademia ? 'Cancelada (academia)' :
                                c.estado

                              const [hh, mm] = (c.hora || '00:00').substring(0, 5).split(':').map(Number)
                              const ampm = hh >= 12 ? 'pm' : 'am'
                              const h12 = hh % 12 || 12
                              const horaFmt = c.hora ? `${h12}:${String(mm).padStart(2, '0')} ${ampm}` : '—'

                              const sedeClase = c.salones?.sedes?.nombre || p.sedes?.nombre || '—'

                              return (
                                <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: '700', color: c.numeroConteo ? TEAL : '#d1d5db', textAlign: 'center', minWidth: '32px' }}>
                                    {c.numeroConteo || '—'}
                                  </td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#333', whiteSpace: 'nowrap', textAlign: 'center' }}>{c.fecha || '—'}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#555', whiteSpace: 'nowrap', textAlign: 'center' }}>{horaFmt}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#333', textAlign: 'center' }}>{c.profesores?.nombre || '—'}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#555', textAlign: 'center' }}>{sedeClase}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: estadoColor.bg, color: estadoColor.color, whiteSpace: 'nowrap' }}>
                                      {etiquetaEstado}
                                    </span>
                                  </td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                                      {/* Ícono de resumen */}
                                      {c.observaciones && <span title="Tiene resumen" style={{ fontSize: '14px' }}>📝</span>}
                                      {/* Ver — siempre visible, rojo si hay obs admin */}
                                      <button
                                        onClick={() => { setModalCortesia({ claseId: c.id, contratoId: p.id, clase: c }); setJustificacionCortesia('') }}
                                        style={{ padding: '3px 10px', background: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px',
                                          border: c.observaciones_admin ? '1.5px solid #dc2626' : `1px solid ${TEAL_MID}`,
                                          color: c.observaciones_admin ? '#dc2626' : TEAL,
                                          fontWeight: c.observaciones_admin ? '600' : '400' }}>
                                        Ver
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px solid #f1f5f9', marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12px', color: '#999' }}>Estado:</span>
                  {['activo', 'aplazado', 'completado'].map(est2 => {
                    const c2 = colorEstadoPlan(est2); const esActual = (p.estado || 'activo') === est2
                    return <button key={est2} onClick={() => !esActual && cambiarEstadoPlan(p.id, est2)} disabled={esActual} style={{ padding: '5px 14px', borderRadius: '8px', cursor: esActual ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', border: `1px solid ${esActual ? c2.border : '#e2e8f0'}`, background: esActual ? c2.bg : 'white', color: esActual ? c2.color : '#666' }}>{est2.charAt(0).toUpperCase() + est2.slice(1)}</button>
                  })}
                  {p.estado === 'completado' && (
                    <>
                      <button onClick={() => { setEsRenovacion(true); setModalPlan(p) }} style={{ marginLeft: '8px', padding: '5px 16px', background: '#0f766e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>🔄 Renovar plan</button>
                      <button onClick={() => cambiarEstadoPlan(p.id, 'archivado')} style={{ padding: '5px 16px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>📁 Archivar</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {/* Talleres */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '32px 0 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#1a1a1a' }}>Talleres activos <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({inscripcionesTalleres.filter((i: any) => i.estado !== 'archivado').length})</span></h3>
              {inscripcionesTalleres.filter((i: any) => i.estado === 'archivado').length > 0 && <button onClick={() => setModalHistorialTalleres(true)} style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>📁 Ver historial ({inscripcionesTalleres.filter((i: any) => i.estado === 'archivado').length} archivados)</button>}
            </div>
          </div>

          {inscripcionesTalleres.length === 0 && <div style={{ background: 'white', borderRadius: '12px', padding: '24px', textAlign: 'center', color: '#888', marginBottom: '24px' }}>Sin inscripciones a talleres</div>}

          {inscripcionesTalleres.filter((i: any) => i.estado !== 'archivado').map((ins: any) => {
            const esVencida = estaVencida(ins)
            const esActivo = ins.estado === 'activo' && !esVencida
            const esCompletado = ins.estado === 'completado'
            const fechaMes = ins.mes ? new Date(ins.mes + 'T12:00:00') : null
            const mesLabel = fechaMes ? `${fechaMes.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][fechaMes.getMonth()]} ${fechaMes.getFullYear()}` : '—'
            const colorEstado = esVencida
              ? { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }
              : esActivo ? { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' }
              : esCompletado ? { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
              : { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
            return (
              <div key={ins.id} style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', border: `1px solid ${colorEstado.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ margin: 0, fontWeight: '600', fontSize: '16px', color: '#1a1a1a' }}>🎸 {ins.talleres?.nombre || '—'}</p>
                      <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: colorEstado.bg, color: colorEstado.color }}>
                        {esVencida ? '⚠️ Vencida' : ins.estado}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 2px', fontSize: '13px', color: '#666' }}>🏫 {ins.talleres?.salones?.nombre} — {ins.talleres?.salones?.sedes?.nombre}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>📅 Desde: {mesLabel} · {ins.talleres?.dia_semana} {ins.talleres?.hora?.substring(0,5)} · {ins.talleres?.duracion_min} min</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: esVencida ? '#c2410c' : '#7c3aed' }}>${ins.valor_pagado ? Number(ins.valor_pagado).toLocaleString() : '—'}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#aaa' }}>valor pagado</p>
                  </div>
                </div>
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {esVencida ? (
                    <>
                      <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: '500' }}>Inscripción vencida — ¿qué deseas hacer?</span>
                      <button onClick={() => renovarInscripcionTaller(ins)} style={{ marginLeft: 'auto', padding: '5px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>🔄 Renovar al mes actual</button>
                      <button onClick={() => cambiarEstadoInscripcion(ins.id, 'archivado')} style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>📁 Finalizar</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '12px', color: '#999' }}>Estado:</span>
                      {['activo', 'completado'].map(est => {
                        const esActual = ins.estado === est
                        const c2 = est === 'activo' ? { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' } : { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' }
                        return <button key={est} onClick={() => !esActual && cambiarEstadoInscripcion(ins.id, est)} disabled={esActual} style={{ padding: '5px 14px', borderRadius: '8px', cursor: esActual ? 'default' : 'pointer', fontSize: '12px', fontWeight: '600', border: `1px solid ${esActual ? c2.border : '#e2e8f0'}`, background: esActual ? c2.bg : 'white', color: esActual ? c2.color : '#666' }}>{est.charAt(0).toUpperCase() + est.slice(1)}</button>
                      })}
                      <button onClick={() => cargarSesionesInscripcion(ins.id, ins.taller_id)} style={{ padding: '5px 14px', background: inscripcionExpandida === ins.id ? '#f3e8ff' : 'white', color: '#7c3aed', border: '1px solid #d8b4fe', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>{inscripcionExpandida === ins.id ? '▲ Ocultar sesiones' : '▼ Ver sesiones'}</button>
                      {esCompletado && (
                        <>
                          <button onClick={() => renovarInscripcionTaller(ins)} style={{ marginLeft: 'auto', padding: '5px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>🔄 Renovar</button>
                          <button onClick={() => cambiarEstadoInscripcion(ins.id, 'archivado')} style={{ padding: '5px 14px', background: '#f1f5f9', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>📁 Archivar</button>
                        </>
                      )}
                    </>
                  )}
                </div>
                {inscripcionExpandida === ins.id && (
                  <div style={{ marginTop: '12px', background: '#fafbfc', borderRadius: '10px', padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: '#555' }}>Sesiones registradas</p>
                    {!sesionesPorInscripcion[ins.id] || sesionesPorInscripcion[ins.id].length === 0 ? (
                      <p style={{ margin: 0, fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '12px 0' }}>Sin sesiones dadas aún</p>
                    ) : (
                      sesionesPorInscripcion[ins.id].map((sesion: any) => {
                        const asistio = sesion.asistencia?.asistio !== false
                        return (
                          <div key={sesion.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '8px', background: 'white', marginBottom: '6px', border: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '13px', color: '#555', fontWeight: '500' }}>{sesion.fecha}</span>
                              <span style={{ padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: asistio ? '#dcfce7' : '#fee2e2', color: asistio ? '#166534' : '#991b1b' }}>{asistio ? '✓ Asistió' : '✗ No asistió'}</span>
                            </div>
                            <button onClick={() => toggleAsistencia(ins.id, sesion, !asistio)} style={{ padding: '4px 12px', background: 'white', color: '#555', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>{asistio ? 'Marcar no asistió' : 'Marcar asistió'}</button>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal historial talleres */}
      {modalHistorialTalleres && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '95%', maxWidth: '700px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ background: '#7c3aed', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>📁 Historial de talleres archivados</h3>
              <button onClick={() => setModalHistorialTalleres(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f3e8ff', zIndex: 1 }}>
                  <tr>{['Taller', 'Sede / Salón', 'Día / Hora', 'Desde', 'Valor pagado'].map(h => <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {inscripcionesTalleres.filter((i: any) => i.estado === 'archivado').map((ins: any, idx) => {
                    const fechaMes = ins.mes ? new Date(ins.mes + 'T12:00:00') : null
                    const mesLabel = fechaMes ? `${fechaMes.getDate()}/${fechaMes.getMonth()+1}/${fechaMes.getFullYear()}` : '—'
                    return (
                      <tr key={ins.id} style={{ borderTop: '1px solid #f8fafc', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                        <td style={{ padding: '11px 16px', fontSize: '14px', fontWeight: '500', color: '#333' }}>🎸 {ins.talleres?.nombre || '—'}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555' }}>{ins.talleres?.salones?.nombre} — {ins.talleres?.salones?.sedes?.nombre}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555' }}>{ins.talleres?.dia_semana} {ins.talleres?.hora?.substring(0,5)}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#888' }}>{mesLabel}</td>
                        <td style={{ padding: '11px 16px', fontSize: '13px', color: '#555', fontWeight: '500' }}>${ins.valor_pagado ? Number(ins.valor_pagado).toLocaleString() : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal asignar a taller */}
      {modalTaller && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ background: '#7c3aed', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '17px' }}>🎸 Asignar a taller</h3>
                <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>{clienteSeleccionado?.nombre}</p>
              </div>
              <button onClick={() => setModalTaller(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Mes de inscripción *</label>
                <select value={mesTaller} onChange={e => setMesTaller(e.target.value)} style={estiloInput}>
                  {opcionesMesTaller().map(op => <option key={op.valor} value={op.valor}>{op.etiqueta}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Taller *</label>
                <select value={tallerSeleccionado} onChange={e => { setTallerSeleccionado(e.target.value); const t = talleres.find((x: any) => x.id === e.target.value); if (t?.valor_mensual) setTallerValorPagado(String(t.valor_mensual)); else setTallerValorPagado('') }} style={estiloInput}>
                  <option value="">— Seleccionar taller —</option>
                  {talleres.map((t: any) => <option key={t.id} value={t.id}>{t.nombre} · {t.salones?.nombre} ({t.salones?.sedes?.nombre}) · {t.dia_semana} {t.hora?.substring(0,5)}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Valor pagado ($)</label>
                <input type="number" min={0} value={tallerValorPagado} onChange={e => setTallerValorPagado(e.target.value)} placeholder="Se toma del taller si se deja vacío" style={estiloInput} />
              </div>
              {tallerError && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{tallerError}</p>}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={inscribirEnTaller} disabled={tallerGuardando} style={{ flex: 1, padding: '11px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '500' }}>{tallerGuardando ? 'Inscribiendo...' : 'Inscribir'}</button>
                <button onClick={() => setModalTaller(false)} style={{ padding: '11px 18px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalPlan !== null && (
        <ModalPlan plan={modalPlan} profesores={profesores} instrumentos={instrumentos} sedes={sedes}
          esRenovacion={esRenovacion} onGuardar={guardarPlan} onCerrar={() => { setModalPlan(null); setEsRenovacion(false) }} />
      )}

      {modalHistorial && <ModalHistorialPlanes planes={planesArchivados} onCerrar={() => setModalHistorial(false)} />}

      {/* ── Modal de clase: ver resumen + observaciones + opción cortesía ── */}
      {modalCortesia && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300 }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '90%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ background: TEAL, padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Detalle de la clase</h3>
                <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                  {modalCortesia.clase.fecha} · {(() => { const [h,m] = (modalCortesia.clase.hora||'00:00').substring(0,5).split(':').map(Number); const ampm = h>=12?'pm':'am'; return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}` })()}
                </p>
              </div>
              <button onClick={() => { setModalCortesia(null); setJustificacionCortesia('') }}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '8px', padding: '5px 11px', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '18px 22px' }}>
              {/* Info básica */}
              <div style={{ background: TEAL_LIGHT, borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#555', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span>👤 {modalCortesia.clase.profesores?.nombre || '—'}</span>
                <span>🏫 {modalCortesia.clase.salones?.sedes?.nombre || '—'}</span>
                <span>⏱ {modalCortesia.clase.duracion_min} min</span>
                {modalCortesia.clase.es_cortesia && <span style={{ color: '#0369a1', fontWeight: '700' }}>🎁 Cortesía</span>}
              </div>

              {/* Resumen del profesor */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#333' }}>Resumen de la clase</p>
                {modalCortesia.clase.observaciones
                  ? <div style={{ background: '#fafbfc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {modalCortesia.clase.observaciones}
                    </div>
                  : <p style={{ margin: 0, fontSize: '13px', color: '#aaa', fontStyle: 'italic', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Sin resumen registrado</p>
                }
              </div>

              {/* Observaciones administrativas / justificación cortesía */}
              <div style={{ marginBottom: modalCortesia.clase.es_cortesia ? '0' : '16px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#333' }}>
                  Observaciones administrativas
                  {modalCortesia.clase.observaciones_admin && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#dc2626', background: '#fee2e2', padding: '1px 7px', borderRadius: '10px', fontWeight: '600' }}>🔔 Tiene nota</span>}
                </p>
                {modalCortesia.clase.observaciones_admin
                  ? <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#333', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                      {modalCortesia.clase.observaciones_admin}
                    </div>
                  : <p style={{ margin: 0, fontSize: '13px', color: '#aaa', fontStyle: 'italic', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>Sin observaciones</p>
                }
              </div>

              {/* Sección dar cortesía — solo si la clase es dada y aún no es cortesía */}
              {modalCortesia.clase.estado === 'dada' && !modalCortesia.clase.es_cortesia && (
                <div style={{ background: '#e0f2fe', borderRadius: '12px', padding: '14px 16px', marginTop: '16px', border: '1px solid #bae6fd' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: '#0369a1' }}>🎁 Dar esta clase como cortesía</p>
                  <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#0c4a6e' }}>
                    La clase no sumará al plan del cliente. Justifica el motivo para tener registro histórico.
                  </p>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#0369a1', marginBottom: '6px' }}>
                    Motivo / justificación *
                  </label>
                  <textarea
                    value={justificacionCortesia}
                    onChange={e => setJustificacionCortesia(e.target.value)}
                    placeholder="Ej: El cliente cumplió años y la academia le obsequió esta clase..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #bae6fd', borderRadius: '8px', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box', background: 'white' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={async () => {
                        if (!justificacionCortesia.trim()) return
                        setGuardandoCortesia(true)
                        await marcarCortesia(modalCortesia.claseId, modalCortesia.contratoId, justificacionCortesia)
                      }}
                      disabled={!justificacionCortesia.trim() || guardandoCortesia}
                      style={{ flex: 1, padding: '9px', background: justificacionCortesia.trim() ? '#0369a1' : '#cbd5e1', color: 'white', border: 'none', borderRadius: '8px', cursor: justificacionCortesia.trim() ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600' }}>
                      {guardandoCortesia ? 'Guardando...' : '✓ Confirmar cortesía'}
                    </button>
                    <button onClick={() => { setModalCortesia(null); setJustificacionCortesia('') }}
                      style={{ padding: '9px 16px', background: 'white', color: '#555', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalAbono && (
        <ModalAbono
          plan={modalAbono}
          pagos={pagosPlanes[modalAbono.id] || []}
          onRegistrar={registrarAbono}
          onAnular={anularAbono}
          onCerrar={() => { setModalAbono(null); setAbonoError('') }}
          guardando={abonoGuardando}
          error={abonoError}
        />
      )}
    </div>
  )
}
