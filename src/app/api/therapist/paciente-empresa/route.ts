import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * PATCH /api/therapist/paciente-empresa
 * Asigna o des-asigna una empresa a un paciente del terapeuta.
 * Body: { patient_id: string, empresa_id: string | null }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'therapist') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { patient_id, empresa_id } = body as { patient_id?: string; empresa_id?: string | null }

  if (!patient_id) {
    return NextResponse.json({ error: 'patient_id requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que el paciente pertenece al terapeuta
  const { data: tp } = await admin
    .from('therapist_patients')
    .select('id')
    .eq('therapist_id', user.id)
    .eq('patient_id', patient_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!tp) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
  }

  // Si se asigna una empresa, verificar que el terapeuta pertenece a esa empresa
  if (empresa_id) {
    const { data: rel } = await admin
      .from('therapist_empresa')
      .select('id')
      .eq('therapist_id', user.id)
      .eq('empresa_id', empresa_id)
      .maybeSingle()

    if (!rel) {
      return NextResponse.json({ error: 'No perteneces a esa empresa' }, { status: 403 })
    }
  }

  const { error } = await admin
    .from('therapist_patients')
    .update({ empresa_id: empresa_id ?? null })
    .eq('therapist_id', user.id)
    .eq('patient_id', patient_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
