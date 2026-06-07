// utils/numeracionClases.ts
export function calcularNumeracion(clases: any[]): Map<string, number> {
  const ordenadas = [...clases].sort((a, b) => 
    a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)
  )
  const mapa = new Map<string, number>()
  let conteo = 0
  ordenadas.forEach(c => {
    const esInasistencia = c.estado === 'cancelada' 
      && !c.cancelado_por_academia 
      && c.cancelado_tarde
    if ((c.estado === 'dada' && !c.es_cortesia) || esInasistencia) {
      conteo++
      mapa.set(c.id, conteo)
    }
  })
  return mapa
}
