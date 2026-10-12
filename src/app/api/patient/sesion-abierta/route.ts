import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Si el paciente salió de "Habla" a mitad de una sesión (p. ej. fue a "Resumen") y regresa,
// se retoma la misma sesión con su conversación. Solo si la última actividad fue hace
// 30 min o menos (el mismo tiempo de inactividad que cierra la app del paciente);
// las más viejas se cierran al iniciar la siguiente o en el barrido diario.
const VENTANA_MS = 30 * 60_000

/**
 * GET /api/patient/sesion-abierta
 * → { sesion: null } | { sesion: { id, modo, messages: [{ role, content }] } }
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: sesion } = await supabase
    .from('sessions')
    .select('id, modo, started_at')
    .eq('patient_id', user.id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!sesion) return NextResponse.json({ sesion: null })

  const { data: mensajes } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sesion.id)
    .order('created_at', { ascending: true })
  if (!mensajes?.length) return NextResponse.json({ sesion: null })

  const ultima = new Date(mensajes[mensajes.length - 1].created_at as string).getTime()
  if (Date.now() - ultima > VENTANA_MS) return NextResponse.json({ sesion: null })

  return NextResponse.json({
    sesion: {
      id: sesion.id,
      modo: sesion.modo ?? null,
      messages: mensajes.map(m => ({ role: m.role, content: m.content })),
    },
  })
}
