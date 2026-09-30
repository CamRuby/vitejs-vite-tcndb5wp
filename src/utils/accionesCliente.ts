// src/utils/accionesCliente.ts
// Fuente única de verdad para acciones sobre clientes y renovaciones.
// Cada acción llama a una función de la base de datos (Supabase), donde viven
// las reglas y el registro en Auditoría.

import { supabase } from '../supabase'

export type ResultadoAccion = { ok: boolean; codigo: string; mensaje: string; clases_eliminadas?: number }

/** Marca o desmarca la casilla "Gestionado" de un plan completado sin renovar. */
export async function marcarGestionRenovacion(contratoId: string, gestionado: boolean): Promise<ResultadoAccion> {
  const { data, error } = await supabase.rpc('marcar_gestion_renovacion', { p_contrato_id: contratoId, p_gestionado: gestionado })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo guardar: ' + error.message }
  return data as ResultadoAccion
}

/**
 * Desactiva un cliente que no va a renovar.
 * Reglas (función desactivar_cliente):
 *  - Bloquea si tiene otro plan activo con clases pendientes.
 *  - Elimina sus clases programadas desde hoy en adelante.
 *  - Archiva el plan y sus otros planes completados. Cliente queda "inactivo".
 *  - Todo queda en Auditoría, incluidas las clases eliminadas.
 */
export async function desactivarCliente(clienteId: string, contratoId: string): Promise<ResultadoAccion> {
  const { data, error } = await supabase.rpc('desactivar_cliente', { p_cliente_id: clienteId, p_contrato_id: contratoId })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo desactivar: ' + error.message }
  return data as ResultadoAccion
}
