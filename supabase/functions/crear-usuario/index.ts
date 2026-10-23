// supabase/functions/crear-usuario/index.ts
// Crea el acceso (usuario + rol) de un PROFESOR.
// SEGURIDAD: solo un usuario con sesión iniciada y rol admin o superadmin puede usarla,
// y solo puede crear usuarios con rol "profesor" (el rol que envíe la app se ignora).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function responder(cuerpo: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. ¿Quién está llamando? Debe traer una sesión válida de la app.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return responder({ error: 'No autorizado' }, 401)

    const { data: datosLlamador, error: errLlamador } = await supabaseAdmin.auth.getUser(token)
    const emailLlamador = datosLlamador?.user?.email
    if (errLlamador || !emailLlamador) return responder({ error: 'No autorizado' }, 401)

    // 2. ¿Tiene permiso? Solo admin o superadmin.
    const { data: rolLlamador, error: errRol } = await supabaseAdmin
      .from('roles')
      .select('rol')
      .eq('email', emailLlamador)
      .maybeSingle()
    if (errRol) throw errRol
    if (!rolLlamador || !['admin', 'superadmin'].includes(rolLlamador.rol)) {
      return responder({ error: 'Sin permiso para crear accesos' }, 403)
    }

    // 3. Datos del nuevo usuario. El rol SIEMPRE es "profesor".
    const cuerpo = await req.json()
    const password = cuerpo?.password
    // El correo se guarda siempre en minúsculas, igual que la cuenta de acceso.
    const email = typeof cuerpo?.email === 'string' ? cuerpo.email.trim().toLowerCase() : ''
    if (!email.includes('@') || typeof password !== 'string' || password.length < 8) {
      return responder({ error: 'Datos incompletos o inválidos' }, 400)
    }
    const rol = 'profesor'

    // Crear usuario en Supabase Auth.
    // Si la cuenta ya existe (por ejemplo, a un profesor se le revocó el acceso), se sigue
    // adelante para devolverle el rol.
    const { error: errUsuario } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    const yaExistia = !!errUsuario && /already/i.test(errUsuario.message ?? '')
    if (errUsuario && !yaExistia) throw errUsuario

    // Asignar rol "profesor" solo si el correo no tiene ningún rol.
    // Nunca cambia el rol de alguien que ya lo tiene (por ejemplo, un admin).
    const { data: rolExistente, error: errBusca } = await supabaseAdmin
      .from('roles')
      .select('rol')
      .eq('email', email)
      .maybeSingle()
    if (errBusca) throw errBusca

    if (!rolExistente) {
      const { error: errInsert } = await supabaseAdmin.from('roles').insert({ email, rol })
      if (errInsert) throw errInsert
    }

    return responder({ ok: true, yaExistia })
  } catch (e: any) {
    return responder({ error: e?.message ?? 'Error' }, 400)
  }
})
