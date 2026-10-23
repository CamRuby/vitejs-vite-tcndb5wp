// src/utils/planesActivos.ts
// Evita planes duplicados: antes de crear un plan, revisa si el cliente ya tiene
// un plan ACTIVO del mismo instrumento que todavía tiene clases por tomar.

import { supabase } from '../supabase'

export type PlanActivoExistente = {
  id: string
  fecha_inicio: string | null
  total: number
  tomadas: number
  restantes: number
  instrumento: string
}

export async function buscarPlanActivoConClases(clienteId: string, instrumentoId: string): Promise<PlanActivoExistente | null> {
  if (!clienteId || !instrumentoId) return null
  const { data } = await supabase.from('contratos')
    .select('id, fecha_inicio, total_clases, clases_tomadas, instrumentos(nombre)')
    .eq('cliente_id', clienteId).eq('instrumento_id', instrumentoId).eq('estado', 'activo')
    .order('fecha_inicio', { ascending: false })
  for (const p of (data || []) as any[]) {
    const total = Number(p.total_clases || 0)
    const tomadas = Number(p.clases_tomadas || 0)
    const restantes = parseFloat((total - tomadas).toFixed(2))
    if (restantes > 0) {
      return { id: p.id, fecha_inicio: p.fecha_inicio, total, tomadas, restantes, instrumento: p.instrumentos?.nombre || 'este instrumento' }
    }
  }
  return null
}

/** Pregunta antes de crear un plan si ya hay uno activo con clases restantes. Devuelve true si se puede seguir. */
export async function confirmarSiHayPlanActivo(clienteId: string, instrumentoId: string): Promise<boolean> {
  const existente = await buscarPlanActivoConClases(clienteId, instrumentoId)
  if (!existente) return true
  return window.confirm(
    `Este cliente ya tiene un plan activo de ${existente.instrumento}` +
    `${existente.fecha_inicio ? ` (desde ${existente.fecha_inicio})` : ''} con ${existente.restantes} de ${existente.total} clases restantes.\n\n` +
    `Si creas otro, las clases futuras programadas se pasarán al plan nuevo.\n\n` +
    `¿Crear otro plan de todas formas?`
  )
}
