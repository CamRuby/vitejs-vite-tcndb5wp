// src/utils/preciosTaller.ts
// Fuente única de los PRECIOS DE LISTA de talleres.
//  - Mensuales: precio según el número de clases (volante de la academia).
//  - Vacacionales: cada taller tiene su propio valor total (se define en Horarios).
// Cada inscripción guarda su "valor acordado", que se puede cambiar (descuentos).

export const PRECIOS_TALLER_MENSUAL: Record<number, number> = {
  4: 155000,
  8: 279000,
}

// Si el número de clases no está en la lista: valor por clase del paquete de 4
export const VALOR_CLASE_TALLER = 38750

export function precioTallerMensual(numClases: number): number {
  const n = Math.max(1, Math.round(Number(numClases) || 4))
  return PRECIOS_TALLER_MENSUAL[n] ?? VALOR_CLASE_TALLER * n
}

/** Precio propuesto para una inscripción nueva. */
export function precioPropuestoTaller(taller: any, numClases: number): number {
  const esVacacional = taller?.tipo === 'vacacional' || !!taller?.fecha_unica
  if (esVacacional) return Number(taller?.valor_mensual || 0)
  return precioTallerMensual(numClases)
}
