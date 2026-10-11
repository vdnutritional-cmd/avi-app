import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstadoSesionesAvi } from '@/lib/limite-sesiones-avi'

/**
 * GET /api/patient/sesiones-avi
 * Sesiones AVI disponibles del paciente (política en src/lib/limite-sesiones-avi.ts).
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const estado = await getEstadoSesionesAvi(createAdminClient(), user.id)
  return NextResponse.json(estado)
}
