// src/utils/accionesTaller.ts
// Acciones únicas sobre talleres. Las reglas viven en la base de datos (Supabase):
//  - Honorario de cada sesión: se calcula solo al marcarla "dada" y al cambiar asistencias
//    o profesor (función calcular_honorario_taller). Si se edita a mano, se respeta.
//  - Total pagado y saldo de cada inscripción: siempre = suma real de sus pagos.

import { supabase } from '../supabase'

export type ResultadoTaller = { ok: boolean; codigo: string; mensaje: string }

/** Elimina una inscripción solo si no tiene pagos ni sesiones tomadas. Auditado. */
export async function eliminarInscripcionTaller(inscripcionId: string): Promise<ResultadoTaller> {
  const { data, error } = await supabase.rpc('eliminar_inscripcion_taller', { p_inscripcion_id: inscripcionId })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo eliminar: ' + error.message }
  return data as ResultadoTaller
}
