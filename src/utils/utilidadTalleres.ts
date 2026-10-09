// src/utils/utilidadTalleres.ts
// Fuente única del cálculo de UTILIDAD de talleres (Inicio → Talleres → Por taller).
// Reglas acordadas (oct 2026):
//  - Ingreso: el valor acordado de cada inscripción se reparte entre las fechas del calendario
//    del taller dentro de su periodo (inicio–fin). Cuenta aunque el inscrito no asista y aunque
//    la sesión no se dicte por falta de confirmaciones. (Festivos: pendiente, por ahora cuentan.)
//  - Honorarios: suma de los honorarios de las sesiones DADAS.
//  - Utilidad = ingreso − honorarios (se usa el valor acordado, no lo pagado).
//  - Recaudado: pagos recibidos (por fecha del pago). Solo informativo.

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, 'miércoles': 3, miercoles: 3, jueves: 4, viernes: 5, 'sábado': 6, sabado: 6,
}

export type TallerBase = { id: string; tipo?: string | null; fecha_unica?: string | null; dia_semana?: string | null }
export type InscripcionBase = { id: string; taller_id: string; fecha_inicio: string | null; fecha_fin: string | null; valor_plan: number | null }
export type SesionBase = { taller_id: string; fecha: string; estado: string; honorario_valor: number | null }
export type PagoBase = { inscripcion_id: string; fecha: string; monto: number }

export type FilaMes = { mes: string; sesiones: number; ingreso: number; recaudado: number; honorarios: number; utilidad: number }

function esVacacional(t: TallerBase) { return t.tipo === 'vacacional' || !!t.fecha_unica }

/** Fechas (YYYY-MM-DD) del calendario del taller entre dos fechas, incluidas. */
export function fechasDelTaller(t: TallerBase, desde: string, hasta: string): string[] {
  if (!desde || !hasta || hasta < desde) return []
  const vac = esVacacional(t)
  const dia = DIAS[(t.dia_semana || '').toLowerCase()]
  const out: string[] = []
  const d = new Date(desde + 'T12:00:00')
  const fin = new Date(hasta + 'T12:00:00')
  while (d <= fin) {
    const wd = d.getDay()
    const ok = vac ? (wd !== 0 && wd !== 6) : dia === undefined ? true : wd === dia
    if (ok) out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Tabla por mes de un taller. Para vacacionales devuelve una sola fila "total". */
export function utilidadPorMes(t: TallerBase, inscripciones: InscripcionBase[], sesiones: SesionBase[], pagos: PagoBase[]): FilaMes[] {
  const filas: Record<string, FilaMes> = {}
  const vac = esVacacional(t)
  const clave = (fecha: string) => vac ? 'total' : fecha.slice(0, 7)
  const fila = (k: string) => (filas[k] ||= { mes: k, sesiones: 0, ingreso: 0, recaudado: 0, honorarios: 0, utilidad: 0 })

  for (const i of inscripciones) {
    const valor = Number(i.valor_plan || 0)
    if (valor <= 0 || !i.fecha_inicio) continue
    const fechas = fechasDelTaller(t, i.fecha_inicio, i.fecha_fin || i.fecha_inicio)
    if (fechas.length === 0) { fila(clave(i.fecha_inicio)).ingreso += valor; continue }
    const parte = valor / fechas.length
    for (const f of fechas) fila(clave(f)).ingreso += parte
  }
  for (const s of sesiones) {
    if (s.estado !== 'dada') continue
    const f = fila(clave(s.fecha))
    f.sesiones += 1
    f.honorarios += Number(s.honorario_valor || 0)
  }
  for (const p of pagos) fila(clave(p.fecha)).recaudado += Number(p.monto || 0)

  return Object.values(filas)
    .map(f => ({ ...f, ingreso: Math.round(f.ingreso), utilidad: Math.round(f.ingreso) - f.honorarios }))
    .sort((a, b) => b.mes.localeCompare(a.mes))
}

export function totalFilas(filas: FilaMes[]): FilaMes {
  return filas.reduce((t, f) => ({
    mes: 'total', sesiones: t.sesiones + f.sesiones, ingreso: t.ingreso + f.ingreso, recaudado: t.recaudado + f.recaudado,
    honorarios: t.honorarios + f.honorarios, utilidad: t.utilidad + f.utilidad,
  }), { mes: 'total', sesiones: 0, ingreso: 0, recaudado: 0, honorarios: 0, utilidad: 0 })
}
