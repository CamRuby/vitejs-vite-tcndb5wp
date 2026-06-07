// src/utils/numeracionClases.ts
// Fuente única de verdad para calcular la numeración de clases en un plan.
// Usar esta función en todos los módulos: Clientes, AdminApp, Reportes, Horarios.

export function calcularNumeracion(clases: any[], duracionPlan: number = 60): Map<string, number> {
  // Ordenar cronológicamente: fecha ascendente, luego hora ascendente
  const ordenadas = [...clases].sort((a, b) => {
    const fechaDiff = (a.fecha || '').localeCompare(b.fecha || '')
    if (fechaDiff !== 0) return fechaDiff
    return (a.hora || '').localeCompare(b.hora || '')
  })

  const mapa = new Map<string, number>()
  let conteo = 0

  ordenadas.forEach(c => {
   const esInasistencia = c.estado === 'cancelada'
      && c.cancelado_por_academia === false
      && c.cancelado_tarde === true
      && !c.inasistencia_perdonada

    const cuentaEnPlan = (c.estado === 'dada' && !c.es_cortesia) || esInasistencia

    if (cuentaEnPlan) {
      const durClase = Number(c.duracion_min) || duracionPlan
      const fraccion = parseFloat((durClase / duracionPlan).toFixed(4))
      conteo = parseFloat((conteo + fraccion).toFixed(4))
      mapa.set(c.id, conteo)
    }
  })

  return mapa
}
