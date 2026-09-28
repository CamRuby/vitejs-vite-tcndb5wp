// src/utils/accionesClase.ts
// Fuente única de verdad para las ACCIONES sobre una clase.
// Cada acción llama a una función de la base de datos (Supabase), que es
// donde viven las reglas. Así todas las apps (Inicio, Horarios, admin
// celular, profesores y WhatsApp) aplican exactamente la misma lógica.

import { supabase } from '../supabase'

export type ViaAccion = 'inicio' | 'horarios' | 'admin_movil' | 'profesor' | 'whatsapp'

export type ResultadoAccion = {
  ok: boolean
  codigo: string
  mensaje: string
}

/**
 * Confirma una clase programada.
 * Reglas (en la base de datos, función confirmar_clase):
 *  - Solo clases en estado "programada". Si ya está confirmada, no hace nada.
 *  - Bloquea si el plan ya está completo (tomadas + confirmadas + esta > total).
 *  - Suma 1 al contador de WhatsApp si el plan lo usa.
 *  - Guarda quién, desde dónde y cuándo; y registra en Auditoría.
 */
export async function confirmarClase(claseId: string, via: ViaAccion): Promise<ResultadoAccion> {
  const { data, error } = await supabase.rpc('confirmar_clase', { p_clase_id: claseId, p_via: via })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo confirmar: ' + error.message }
  return data as ResultadoAccion
}
