// src/pages/TalleresInicio.tsx
// Inicio → Talleres, con 3 pestañas (todo desde el 1 jun 2026):
//   1. Pendientes  → inscripciones con saldo o sin valor (TalleresSinPago)
//   2. Por cliente → historial de un cliente: inscripciones, sesiones y pagos
//   3. Por taller  → talleres por última sesión; utilidad por mes (utils/utilidadTalleres)

import { useState } from 'react'
import SeccionInicio from './SeccionInicio'
import TalleresSinPago from './TalleresSinPago'
import TalleresPorCliente from './TalleresPorCliente'
import TalleresPorTaller from './TalleresPorTaller'

export const COLORES_TALLER = { header: '#6d28d9', headerBg: '#f5f3ff', border: '#ddd6fe' }

type Pestana = 'pendientes' | 'cliente' | 'taller'

export default function TalleresInicio({ esMovil }: { esMovil: boolean }) {
  const [pestana, setPestana] = useState<Pestana>('pendientes')
  const [pendientes, setPendientes] = useState<number | null>(null)
  const C = COLORES_TALLER
  const tabs: { id: Pestana; txt: string }[] = [
    { id: 'pendientes', txt: 'Pendientes' },
    { id: 'cliente', txt: 'Por cliente' },
    { id: 'taller', txt: 'Por taller' },
  ]
  return (
    <SeccionInicio titulo="Talleres" subtitulo={pendientes !== null ? `${pendientes} pendiente${pendientes !== 1 ? 's' : ''} de pago` : undefined}
      colores={C} esMovil={esMovil} anchoCompleto cantidad={pendientes}>
      <div style={{ display: 'flex', gap: '4px', padding: '10px 16px 0', borderBottom: `1px solid ${C.border}` }}>
        {tabs.map(t => {
          const activo = t.id === pestana
          return (
            <button key={t.id} onClick={() => setPestana(t.id)}
              style={{ flex: esMovil ? 1 : 'none', padding: '8px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: 'transparent',
                border: 'none', borderBottom: `3px solid ${activo ? C.header : 'transparent'}`, color: activo ? C.header : '#94a3b8', marginBottom: '-1px' }}>
              {t.txt}
            </button>
          )
        })}
      </div>
      {/* Pendientes se mantiene montada para conservar el conteo */}
      <div style={{ display: pestana === 'pendientes' ? 'block' : 'none' }}>
        <TalleresSinPago esMovil={esMovil} onCantidad={setPendientes} />
      </div>
      {pestana === 'cliente' && <TalleresPorCliente esMovil={esMovil} />}
      {pestana === 'taller' && <TalleresPorTaller esMovil={esMovil} />}
    </SeccionInicio>
  )
}
