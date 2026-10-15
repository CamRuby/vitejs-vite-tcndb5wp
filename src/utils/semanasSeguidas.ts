// src/utils/semanasSeguidas.ts
// Fuente única del conteo "semanas seguidas en el mismo horario" (Horarios, etiqueta rosada ↻).
// Regla acordada (oct 2026):
//  - Por ESTUDIANTE (no por plan): si renueva y sigue igual, la cuenta continúa.
//  - Mismo día de la semana y misma hora de inicio (no importan profesor ni salón).
//  - Una semana cuenta si ese día/hora el estudiante tenía una clase en cualquier estado
//    (dada, confirmada, inasistencia, cancelada por la academia…). Si esa semana no la tenía
//    (se reprogramó a otra hora o no hubo clase), la cuenta se corta.
//  - Máximo 52 semanas hacia atrás.

export const MAX_SEMANAS = 52

export type ClaseSlot = { clienteId: string; fecha: string; hora: string }

const hhmm = (h: string) => (h || '').slice(0, 5)
function restarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00')
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

/** Fecha más antigua que hay que consultar para calcular el conteo desde `desde`. */
export function fechaMinimaHistorial(desde: string): string {
  return restarDias(desde, 7 * MAX_SEMANAS)
}

/** Semanas seguidas (contando la actual) para una clase, dado el historial del estudiante. */
export function semanasSeguidas(clase: ClaseSlot, historial: Set<string>): number {
  let n = 1
  let f = clase.fecha
  while (n <= MAX_SEMANAS) {
    f = restarDias(f, 7)
    if (!historial.has(`${clase.clienteId}|${f}|${hhmm(clase.hora)}`)) break
    n++
  }
  return n
}

export function claveSlot(clienteId: string, fecha: string, hora: string) {
  return `${clienteId}|${fecha}|${hhmm(hora)}`
}
