import { useState, useEffect } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const TEAL = '#1a8a8a'
const TEAL_LIGHT = '#e8f5f5'
const TEAL_MID = '#b2d8d8'

export default function Profesores() {
  const [busqueda, setBusqueda] = useState('')
  const [profesores, setProfesores] = useState([])
  const [profesorSeleccionado, setProfesorSeleccionado] = useState(null)
  const [clases, setClases] = useState([])
  const [clientes, setClientes] = useState([])
  const [honorarios, setHonorarios] = useState({ total: 0, rosales: 0, chico: 0, tunja: 0, desglose: [] })
  const [cargando, setCargando] = useState(false)
  const [verDesglose, setVerDesglose] = useState(false)
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    if (busqueda.length >= 2) buscarProfesores()
    else setProfesores([])
  }, [busqueda])

  useEffect(() => {
    if (profesorSeleccionado) cargarDatos(profesorSeleccionado)
  }, [mesSeleccionado])

  async function buscarProfesores() {
    setCargando(true)
    const { data } = await supabase
      .from('profesores')
      .select('id, nombre, telefono, email')
      .ilike('nombre', `%${busqueda}%`)
      .order('nombre')
    setProfesores(data || [])
    setCargando(false)
  }

  async function cargarDatos(p) {
    setCargando(true)
    const fechaInicio = `${mesSeleccionado}-01`
    const [anio, mes] = mesSeleccionado.split('-')
    const ultimoDia = new Date(parseInt(anio), parseInt(mes), 0).getDate()
    const fechaFin = `${mesSeleccionado}-${ultimoDia}`

    const { data: clasesData } = await supabase
      .from('clases')
      .select(`
        id, fecha, duracion_min, numero_en_plan,
        modalidad, estado,
        contratos (
          instrumentos (nombre),
          clientes (nombre),
          sedes (nombre)
        ),
        salones (nombre,
          sedes (nombre)
        )
      `)
      .eq('profesor_id', p.id)
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin)
      .order('fecha', { ascending: false })
    setClases(clasesData || [])

    const clientesUnicos = {}
    ;(clasesData || []).forEach(c => {
      const cliente = c.contratos?.clientes
      if (cliente && !clientesUnicos[cliente.nombre]) {
        clientesUnicos[cliente.nombre] = {
          nombre: cliente.nombre,
          instrumento: c.contratos?.instrumentos?.nombre
        }
      }
    })
    setClientes(Object.values(clientesUnicos))

    const anioNum = parseInt(anio)
    const { data: tarifasData } = await supabase
      .from('tarifas')
      .select('duracion_min, modalidad, sede, valor')
      .eq('anio', anioNum)

    const getTarifa = (duracion, modalidad, sede) => {
      if (!tarifasData) return 0
      const sedePrincipal = sede?.toLowerCase().includes('tunja') ? 'Tunja'
        : sede?.toLowerCase().includes('chicó') || sede?.toLowerCase().includes('chico') ? 'Chicó'
        : 'Rosales'
      const tarifa = tarifasData.find(t =>
        t.duracion_min === duracion &&
        t.modalidad === modalidad &&
        t.sede === sedePrincipal
      )
      return tarifa?.valor || 0
    }

    let total = 0, rosales = 0, chico = 0, tunja = 0
    const desglose = []
    ;(clasesData || []).forEach(c => {
      const dur = c.duracion_min
      const mod = c.modalidad
      const sede = c.salones?.sedes?.nombre || c.contratos?.sedes?.nombre || ''
      const tarifa = getTarifa(dur, mod, sede)
      total += tarifa
      const sedeNorm = sede.toLowerCase()
      if (sedeNorm.includes('rosales')) rosales += tarifa
      else if (sedeNorm.includes('chicó') || sedeNorm.includes('chico')) chico += tarifa
      else if (sedeNorm.includes('tunja')) tunja += tarifa
      desglose.push({
        fecha: c.fecha,
        cliente: c.contratos?.clientes?.nombre || '—',
        duracion: dur,
        modalidad: mod,
        sede: sede || '—',
        tarifa
      })
    })
    setHonorarios({ total, rosales, chico, tunja, desglose })
    setCargando(false)
  }

  async function seleccionarProfesor(p) {
    setProfesorSeleccionado(p)
    await cargarDatos(p)
  }

  function exportarExcel() {
    const datos = honorarios.desglose.map((d: any) => ({
      Fecha: d.fecha,
      Cliente: d.cliente,
      'Duración (min)': d.duracion,
      Modalidad: d.modalidad,
      Sede: d.sede,
      Tarifa: d.tarifa
    }))
    datos.push({
      Fecha: '',
      Cliente: '',
      'Duración (min)': '',
      Modalidad: '',
      Sede: 'TOTAL',
      Tarifa: honorarios.total
    })
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Honorarios')
    XLSX.writeFile(wb, `Honorarios_${profesorSeleccionado.nombre}_${mesSeleccionado}.xlsx`)
  }

  function exportarPDF() {
    const doc = new jsPDF()
    doc.setFontSize(16)
    doc.text('Desglose de Honorarios', 14, 20)
    doc.setFontSize(12)
    doc.text(`Profesor: ${profesorSeleccionado.nombre}`, 14, 30)
    doc.text(`Mes: ${mesSeleccionado}`, 14, 38)
    doc.text(`Total: $${honorarios.total.toLocaleString()}`, 14, 46)

    autoTable(doc, {
      startY: 54,
      head: [['Fecha', 'Cliente', 'Duración', 'Modalidad', 'Sede', 'Tarifa']],
      body: honorarios.desglose.map((d: any) => [
        d.fecha, d.cliente, `${d.duracion} min`, d.modalidad, d.sede, `$${d.tarifa.toLocaleString()}`
      ]),
      foot: [['', '', '', '', 'Total', `$${honorarios.total.toLocaleString()}`]],
      headStyles: { fillColor: [26, 138, 138] },
      footStyles: { fillColor: [232, 245, 245], textColor: [26, 138, 138], fontStyle: 'bold' }
    })

    doc.save(`Honorarios_${profesorSeleccionado.nombre}_${mesSeleccionado}.pdf`)
  }

  return (
    <div style={{ padding: '32px', maxWidth: '960px' }}>

      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ margin: 0, fontSize: '26px', color: '#1a1a1a' }}>Profesores</h2>
        <p style={{ margin: '4px 0 0', color: '#666', fontSize: '14px' }}>Consulta clases, clientes y honorarios</p>
      </div>

      {!profesorSeleccionado && (
        <>
          <div style={{ position: 'relative' as const, marginBottom: '20px' }}>
            <input
              placeholder="Buscar profesor por nombre..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '10px 12px 10px 44px',
                border: `1px solid ${TEAL_MID}`, borderRadius: '8px',
                fontSize: '16px', boxSizing: 'border-box' as const,
                boxShadow: '0 1px 6px rgba(0,0,0,0.06)', outline: 'none'
              }}
            />
            <span style={{
              position: 'absolute' as const, left: '14px', top: '50%',
              transform: 'translateY(-50%)', color: '#aaa', fontSize: '18px'
            }}>🔍</span>
          </div>

          {cargando && <div style={{ textAlign: 'center' as const, padding: '32px', color: '#666' }}>Buscando...</div>}

          {profesores.map(p => (
            <div key={p.id} onClick={() => seleccionarProfesor(p)} style={{
              background: 'white', borderRadius: '12px', padding: '16px 20px',
              marginBottom: '8px', cursor: 'pointer',
              border: '1px solid #eef2f7',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = TEAL_MID)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#eef2f7')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: TEAL_LIGHT, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '16px', fontWeight: '600', color: TEAL
                }}>
                  {p.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '15px', color: '#1a1a1a' }}>{p.nombre}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#888' }}>
                    {p.telefono || '—'} · {p.email || '—'}
                  </p>
                </div>
              </div>
              <span style={{ color: '#ccc', fontSize: '18px' }}>›</span>
            </div>
          ))}

          {busqueda.length >= 2 && profesores.length === 0 && !cargando && (
            <div style={{ textAlign: 'center' as const, padding: '48px', color: '#888' }}>
              <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🔍</p>
              <p style={{ margin: 0 }}>No se encontraron profesores</p>
            </div>
          )}
          {busqueda.length < 2 && (
            <div style={{ textAlign: 'center' as const, padding: '48px', color: '#aaa' }}>
              <p style={{ fontSize: '40px', margin: '0 0 8px' }}>🎵</p>
              <p style={{ margin: 0, fontSize: '15px' }}>Escribe al menos 2 letras para buscar</p>
            </div>
          )}
        </>
      )}

      {profesorSeleccionado && (
        <div>
          <button onClick={() => { setProfesorSeleccionado(null); setBusqueda('') }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: TEAL, fontSize: '14px', marginBottom: '20px', padding: 0, fontWeight: '500'
          }}>
            ← Volver a la lista
          </button>

          <div style={{
            background: 'white', borderRadius: '16px', overflow: 'hidden',
            boxShadow: '0 1px 8px rgba(0,0,0,0.08)', marginBottom: '24px'
          }}>
            <div style={{ background: TEAL, padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: '700', color: 'white'
                }}>
                  {profesorSeleccionado.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: '22px' }}>{profesorSeleccionado.nombre}</h3>
                  <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '14px' }}>
                    📱 {profesorSeleccionado.telefono || '—'} · ✉️ {profesorSeleccionado.email || '—'}
                  </p>
                </div>
              </div>
              <input
                type="month"
                value={mesSeleccionado}
                onChange={e => setMesSeleccionado(e.target.value)}
                style={{
                  padding: '8px 12px', border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '8px', fontSize: '14px',
                  background: 'rgba(255,255,255,0.15)', color: 'white'
                }}
              />
            </div>
          </div>

          <h3 style={{ margin: '0 0 14px', fontSize: '18px', color: '#1a1a1a' }}>Honorarios del mes</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '28px' }}>
            {[
              { label: 'Total', valor: honorarios.total, destacado: true, clickable: true },
              { label: 'Rosales', valor: honorarios.rosales },
              { label: 'Chicó', valor: honorarios.chico },
              { label: 'Tunja', valor: honorarios.tunja },
            ].map(h => (
              <div key={h.label}
                onClick={() => h.clickable && setVerDesglose(true)}
                style={{
                  background: h.destacado ? TEAL : 'white',
                  borderRadius: '12px', padding: '16px',
                  border: `1px solid ${h.destacado ? TEAL : '#eef2f7'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  textAlign: 'center' as const,
                  cursor: h.clickable ? 'pointer' : 'default'
                }}>
                <p style={{ margin: '0 0 6px', fontSize: '13px', color: h.destacado ? 'rgba(255,255,255,0.8)' : '#999' }}>{h.label}</p>
                <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: h.destacado ? 'white' : TEAL }}>
                  ${h.valor.toLocaleString()}
                </p>
                {h.clickable && <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Ver desglose →</p>}
              </div>
            ))}
          </div>

          <h3 style={{ margin: '0 0 14px', fontSize: '18px', color: '#1a1a1a' }}>
            Clientes este mes <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({clientes.length})</span>
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '8px', marginBottom: '28px' }}>
            {clientes.length === 0 && <p style={{ color: '#888' }}>Sin clientes este mes</p>}
            {clientes.map((c: any) => (
              <span key={c.nombre} style={{
                padding: '7px 14px', background: TEAL_LIGHT, color: TEAL,
                borderRadius: '20px', fontSize: '13px', fontWeight: '500'
              }}>
                {c.nombre} · {c.instrumento || '—'}
              </span>
            ))}
          </div>

          <h3 style={{ margin: '0 0 14px', fontSize: '18px', color: '#1a1a1a' }}>
            Clases del mes <span style={{ color: '#aaa', fontWeight: '400', fontSize: '15px' }}>({clases.length})</span>
          </h3>
          {cargando && <div style={{ textAlign: 'center' as const, padding: '32px', color: '#666' }}>Cargando...</div>}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #eef2f7', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: TEAL_LIGHT }}>
                  {['Fecha', 'Cliente', 'Instrumento', 'Duración', 'Modalidad', 'Sede'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: '13px', color: TEAL, fontWeight: '600' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clases.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center' as const, color: '#888' }}>Sin clases este mes</td></tr>
                )}
                {clases.map((c, i) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f8fafc', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.fecha}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.contratos?.clientes?.nombre || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.contratos?.instrumentos?.nombre || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{c.duracion_min} min</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px',
                        background: c.modalidad === 'domicilio' ? '#fef3c7' : c.modalidad === 'virtual' ? '#eff6ff' : TEAL_LIGHT,
                        color: c.modalidad === 'domicilio' ? '#92400e' : c.modalidad === 'virtual' ? '#1d4ed8' : TEAL
                      }}>
                        {c.modalidad}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                      {c.salones?.sedes?.nombre || c.contratos?.sedes?.nombre || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {verDesglose && (
        <div style={{
          position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '90%', maxWidth: '700px',
            maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' as const
          }}>
            <div style={{ background: TEAL, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: 'white' }}>Desglose de honorarios</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={exportarExcel} style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '14px'
                }}>📊 Excel</button>
                <button onClick={exportarPDF} style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '14px'
                }}>📄 PDF</button>
                <button onClick={() => setVerDesglose(false)} style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                  borderRadius: '8px', padding: '6px 14px', cursor: 'pointer', fontSize: '14px'
                }}>Cerrar</button>
              </div>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: TEAL_LIGHT }}>
                    {['Fecha', 'Cliente', 'Duración', 'Modalidad', 'Sede', 'Tarifa'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left' as const, fontSize: '13px', color: TEAL, fontWeight: '600' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {honorarios.desglose.map((d: any, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ padding: '11px 16px', fontSize: '14px' }}>{d.fecha}</td>
                      <td style={{ padding: '11px 16px', fontSize: '14px' }}>{d.cliente}</td>
                      <td style={{ padding: '11px 16px', fontSize: '14px' }}>{d.duracion} min</td>
                      <td style={{ padding: '11px 16px', fontSize: '14px' }}>{d.modalidad}</td>
                      <td style={{ padding: '11px 16px', fontSize: '14px' }}>{d.sede}</td>
                      <td style={{ padding: '11px 16px', fontSize: '14px', fontWeight: '600', color: TEAL }}>${d.tarifa.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: TEAL_LIGHT }}>
                    <td colSpan={5} style={{ padding: '12px 16px', fontWeight: '600', color: TEAL }}>Total</td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', fontSize: '16px', color: TEAL }}>${honorarios.total.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}