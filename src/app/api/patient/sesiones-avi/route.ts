import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstadoSesionesAvi } from '@/lib/limite-sesiones-avi'

/**
 * GET /api/patient/sesiones-avi
 * Sesiones AVI disponibles del paciente (política en src/lib/limite-sesiones-avi.ts)
 * + ultimoModo: cómo platicó la última vez ('hablada' | 'escrita'), para marcarlo de entrada.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const admin = createAdminClient()
  const [estado, { data: ultima }] = await Promise.all([
    getEstadoSesionesAvi(admin, user.id),
    admin.from('sessions').select('modo').eq('patient_id', user.id).not('modo', 'is', null)
      .order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  return NextResponse.json({ ...estado, ultimoModo: (ultima?.modo as string | null) ?? null })
}
