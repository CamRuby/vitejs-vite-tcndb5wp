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

/**
 * Registra un pago de una inscripción a taller (función registrar_pago_taller).
 * Solo admin/superadmin. La inscripción debe tener valor. Queda en Auditoría.
 */
export async function registrarPagoTaller(datos: {
  inscripcionId: string; monto: number; metodo: string; fecha: string; notas?: string
}): Promise<ResultadoTaller> {
  const { data, error } = await supabase.rpc('registrar_pago_taller', {
    p_inscripcion_id: datos.inscripcionId, p_monto: datos.monto, p_metodo: datos.metodo,
    p_fecha: datos.fecha, p_notas: datos.notas || null,
  })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo registrar: ' + error.message }
  return data as ResultadoTaller
}

/** Pone o cambia el valor acordado de una inscripción, con su motivo. Auditado. */
export async function editarValorInscripcion(inscripcionId: string, valor: number, nota?: string): Promise<ResultadoTaller> {
  const { data, error } = await supabase.rpc('editar_valor_inscripcion_taller', {
    p_inscripcion_id: inscripcionId, p_valor: valor, p_nota: nota || null,
  })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo guardar: ' + error.message }
  return data as ResultadoTaller
}
