// src/utils/honorarios.ts
// Fuente única de la regla: ¿esta clase se le paga al profesor?
// Usar en todos los módulos: Reportes, Profesores y app de profesores.
//
// Se paga:
//  - Toda clase "dada", incluidas las de cortesía (el profesor la dictó aunque el cliente no pague).
//  - Inasistencia del cliente (cancelada, no por la academia): su valor lo decide el admin
//    (mientras no se decide, cuenta como 0 / pendiente).
// No se paga: programada, confirmada, ni canceladas por la academia.

export function pagaHonorario(c: any): boolean {
  return c.estado === 'dada' || (c.estado === 'cancelada' && !c.cancelado_por_academia)
}
