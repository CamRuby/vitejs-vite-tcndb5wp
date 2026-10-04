// src/utils/saldoPlan.ts
// Fuente única de la regla de la "p" roja y de "Planes sin pago".
// Un plan tiene saldo pendiente si empezó desde la fecha de corte y:
//   - no tiene valor definido (vacío o 0), o
//   - lo pagado es menor que el valor del plan.
// Excepción: planes marcados "cobro incluido en otro plan" (cobro_en_otro_plan) nunca tienen saldo.

import { supabase } from '../supabase'

// Planes anteriores a esta fecha no se revisan (pueden tener pagos no registrados en la app)
export const CORTE_PAGOS = '2026-06-01'

export function entraEnRevision(plan: { fecha_inicio?: string | null }): boolean {
  return (plan?.fecha_inicio || '') >= CORTE_PAGOS
}

export function tieneSaldo(plan: { fecha_inicio?: string | null; valor_plan?: any; cobro_en_otro_plan?: boolean | null }, pagado: number): boolean {
  if (plan?.cobro_en_otro_plan) return false
  if (!entraEnRevision(plan)) return false
  const valor = Number(plan.valor_plan || 0)
  return valor === 0 || pagado < valor
}

// Suma de pagos por plan. Consulta por lotes para no exceder límites con muchos planes.
export async function pagadoPorPlan(contratoIds: string[]): Promise<Record<string, number>> {
  const total: Record<string, number> = {}
  const ids = [...new Set(contratoIds.filter(Boolean))]
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100)
    const { data } = await supabase.from('pagos').select('contrato_id, monto').in('contrato_id', lote).limit(5000)
    ;(data || []).forEach((p: any) => { total[p.contrato_id] = (total[p.contrato_id] || 0) + Number(p.monto || 0) })
  }
  return total
}

export function formatPesos(n: number): string {
  return '$' + Math.round(n || 0).toLocaleString('es-CO')
}
