import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTerminologiaPersona, getTerminologiaTerapeuta } from '@/lib/terminologia-paciente'

/**
 * GET /api/therapist/terminologia-persona?patientId=...
 * Palabras para el perfil de una persona del terapeuta (Inventario de Terminología, página 5).
 * → { persona, terapeuta }: la de esa persona (su empresa; sin empresa, "Cómo me nombran")
 *   y la de las pantallas generales del terapeuta (enlace "← Mis <Users>").
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })

  const admin = createAdminClient()

  // Verificar que la persona es del terapeuta (también si está bloqueada)
  const { data: tp } = await admin
    .from('therapist_patients')
    .select('id')
    .eq('therapist_id', user.id)
    .eq('patient_id', patientId)
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle()
  if (!tp) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })

  const [persona, terapeuta] = await Promise.all([
    getTerminologiaPersona(admin, user.id, patientId),
    getTerminologiaTerapeuta(admin, user.id),
  ])
  return NextResponse.json({ persona, terapeuta })
}
