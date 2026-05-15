import { supabase } from './supabase'

export async function auditar(
  accion: string,
  entidad: string,
  entidad_id?: string,
  detalle?: Record<string, any>
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('auditoria').insert({
    usuario_email: user.email,
    accion,
    entidad,
    entidad_id: entidad_id || null,
    detalle: detalle || null
  })
}
