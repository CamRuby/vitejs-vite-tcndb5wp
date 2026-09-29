// src/utils/accionesPago.ts
// Fuente única de verdad para los PAGOS de planes.
// Cada acción llama a una función de la base de datos (Supabase), donde viven
// las reglas y el registro en Auditoría.

import { supabase } from '../supabase'

// Lista única de cuentas / métodos de pago
export const METODOS_PAGO = [
  'Ideal Chicó',
  'Ideal Rosales',
  'Bancolombia Ruby',
  'Davivienda Ruby',
  'Wompi',
  'Tarjeta Redeban',
  'Efectivo',
  'Ajuste (comisión pasarela)',
]

// Fecha de hoy en hora de Colombia (no en UTC)
export function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export type ResultadoPago = { ok: boolean; codigo: string; mensaje: string; pago_id?: string }

/**
 * Registra un pago de un plan.
 * Reglas (en la base de datos, función registrar_pago):
 *  - Solo admin y superadmin. Monto > 0, cuenta y fecha obligatorias.
 *  - Si el plan no tiene valor, exige valorPlan y lo asigna en el mismo paso.
 *  - Registra en Auditoría quién, cuánto, cuenta y fecha.
 */
export async function registrarPago(datos: {
  contratoId: string
  monto: number
  metodo: string
  fecha: string
  notas?: string
  valorPlan?: number | null
  via: 'inicio' | 'clientes' | 'reportes' | 'admin_movil'
}): Promise<ResultadoPago> {
  const { data, error } = await supabase.rpc('registrar_pago', {
    p_contrato_id: datos.contratoId,
    p_monto: datos.monto,
    p_metodo: datos.metodo,
    p_fecha: datos.fecha,
    p_notas: datos.notas || null,
    p_valor_plan: datos.valorPlan ?? null,
    p_via: datos.via,
  })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo registrar: ' + error.message }
  return data as ResultadoPago
}
