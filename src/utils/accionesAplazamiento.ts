// src/utils/accionesAplazamiento.ts
// Acciones únicas de "planes aplazados" (cliente que se ausenta unas semanas).
// Las reglas viven en la base de datos (funciones aplazar_clases, marcar_aplazamiento_contactado,
// deshacer_aplazamiento) y todo queda en Auditoría.
//  - Las clases programadas/confirmadas del periodo pasan a estado "aplazada": no se ven en Horarios
//    ni en la app del profesor, no cuentan en el plan y no generan honorario.
//  - Al terminar el periodo, las clases siguientes continúan solas.
//  - Sin fecha de regreso ("hasta nuevo aviso"): pasa a "Por contactar" a los 14 días.

import { supabase } from '../supabase'

export type ResultadoAplazamiento = { ok: boolean; codigo: string; mensaje: string; clases_aplazadas?: number }

export const DIAS_AVISO_SIN_FECHA = 14

export async function aplazarClases(clienteId: string, desde: string, hasta: string | null, motivo?: string): Promise<ResultadoAplazamiento> {
  const { data, error } = await supabase.rpc('aplazar_clases', {
    p_cliente_id: clienteId, p_desde: desde, p_hasta: hasta, p_motivo: motivo || null,
  })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo aplazar: ' + error.message }
  return data as ResultadoAplazamiento
}

export async function marcarAplazamientoContactado(id: string, nota?: string): Promise<ResultadoAplazamiento> {
  const { data, error } = await supabase.rpc('marcar_aplazamiento_contactado', { p_id: id, p_nota: nota || null })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo guardar: ' + error.message }
  return data as ResultadoAplazamiento
}

export async function deshacerAplazamiento(id: string): Promise<ResultadoAplazamiento> {
  const { data, error } = await supabase.rpc('deshacer_aplazamiento', { p_id: id })
  if (error) return { ok: false, codigo: 'error', mensaje: 'No se pudo deshacer: ' + error.message }
  return data as ResultadoAplazamiento
}

/** Fecha desde la cual el cliente debe ser contactado. */
export function fechaParaContactar(a: { desde: string; hasta: string | null }): string {
  if (a.hasta) return a.hasta
  const d = new Date(a.desde + 'T12:00:00')
  d.setDate(d.getDate() + DIAS_AVISO_SIN_FECHA)
  return d.toISOString().slice(0, 10)
}
