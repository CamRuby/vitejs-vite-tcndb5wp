// src/pages/SeccionInicio.tsx
// Contenedor común para las secciones del Inicio.
// Celular: plegada por defecto; el encabezado muestra título y cantidad, y se abre al tocarlo.
// Computador: tarjeta siempre abierta.

import { useState } from 'react'
import type { ReactNode } from 'react'

export type ColoresSeccion = { header: string; headerBg: string; border: string }

export default function SeccionInicio({ titulo, subtitulo, cantidad, colores, esMovil, extraEncabezado, children, anchoCompleto }: {
  titulo: string
  subtitulo?: string
  cantidad?: number | null
  colores: ColoresSeccion
  esMovil: boolean
  extraEncabezado?: ReactNode   // ej. selector de mes (se muestra solo con la sección abierta)
  children: ReactNode
  anchoCompleto?: boolean       // en computador ocupa toda la fila
}) {
  const [abierta, setAbierta] = useState(false)
  const visible = !esMovil || abierta

  return (
    <div style={{ background: 'white', borderRadius: esMovil ? '14px' : '16px', border: `1px solid ${colores.border}`, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)', gridColumn: anchoCompleto && !esMovil ? '1 / -1' : undefined }}>
      <div onClick={esMovil ? () => setAbierta(a => !a) : undefined}
        style={{ padding: esMovil ? '14px 16px' : '14px 20px', background: colores.headerBg, borderBottom: visible ? `1px solid ${colores.border}` : 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', cursor: esMovil ? 'pointer' : 'default' }}>
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: '15px', color: colores.header, fontWeight: 700 }}>{titulo}</h3>
          {subtitulo && <p style={{ margin: '2px 0 0', fontSize: '12px', color: colores.header, opacity: 0.8 }}>{subtitulo}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {visible && extraEncabezado && <div onClick={e => e.stopPropagation()}>{extraEncabezado}</div>}
          {cantidad !== undefined && cantidad !== null && (
            <span style={{ minWidth: '24px', padding: '2px 8px', borderRadius: '10px', background: 'white', color: colores.header,
              fontSize: '13px', fontWeight: 700, textAlign: 'center', border: `1px solid ${colores.border}` }}>{cantidad}</span>
          )}
          {esMovil && (
            <span style={{ fontSize: '14px', color: colores.header, transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          )}
        </div>
      </div>
      {visible && children}
    </div>
  )
}
