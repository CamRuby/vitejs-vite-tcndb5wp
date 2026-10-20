// src/utils/busqueda.ts
// Búsqueda de nombres SIN importar tildes ni mayúsculas.
// "jose" encuentra "José", "nunez" encuentra "Núñez", "MARIA" encuentra "María".

/** Quita tildes y pasa a minúsculas (para comparar en el navegador). */
export function sinTildes(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** ¿El texto contiene lo buscado, sin importar tildes ni mayúsculas? */
export function contieneSinTildes(texto: string, buscado: string): boolean {
  return sinTildes(texto).includes(sinTildes(buscado.trim()))
}

const VARIANTES: Record<string, string> = {
  a: 'aáàäâAÁÀÄÂ', e: 'eéèëêEÉÈËÊ', i: 'iíìïîIÍÌÏÎ', o: 'oóòöôOÓÒÖÔ', u: 'uúùüûUÚÙÜÛ', n: 'nñNÑ', c: 'cçCÇ',
}

/**
 * Patrón para buscar en la base de datos con `.regexIMatch('nombre', patron)`:
 * cada vocal (y la n) acepta su versión con o sin tilde.
 */
export function patronSinTildes(buscado: string): string {
  return sinTildes(buscado.trim())
    .split('')
    .map(ch => VARIANTES[ch] ? `[${VARIANTES[ch]}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('')
}
