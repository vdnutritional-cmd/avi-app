import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { avisarPacientePush } from '@/lib/push/avisar-paciente'

/**
 * POST { patientId } → aviso push al paciente de que tiene un cuestionario por contestar (28 oct 2026).
 * Lo llaman Cuestionarios y Derivaciones y Cierres (Sensación final) después de asignarlo.
 * Solo si el terapeuta tiene el vínculo y le acaba de asignar un cuestionario pendiente.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { patientId } = await req.json().catch(() => ({}))
  if (typeof patientId !== 'string') return NextResponse.json({ error: 'Falta patientId' }, { status: 400 })

  const admin = createAdminClient()
  const haceUnRato = new Date(Date.now() - 5 * 60_000).toISOString()
  const [{ data: tp }, { data: cuest }] = await Promise.all([
    admin.from('therapist_patients').select('id')
      .eq('therapist_id', user.id).eq('patient_id', patientId).eq('is_active', true).neq('status', 'archived')
      .limit(1).maybeSingle(),
    admin.from('patient_questionnaires').select('id')
      .eq('therapist_id', user.id).eq('patient_id', patientId).eq('status', 'pending').gte('assigned_at', haceUnRato)
      .limit(1).maybeSingle(),
  ])
  if (!tp || !cuest) return NextResponse.json({ ok: false })

  avisarPacientePush(user.id, patientId, 'cuestionario')
  return NextResponse.json({ ok: true })
}
