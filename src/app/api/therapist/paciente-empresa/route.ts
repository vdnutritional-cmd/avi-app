import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { centroPorDefecto } from '@/lib/centros-atencion'

/**
 * PATCH /api/therapist/paciente-empresa
 * Asigna o des-asigna una empresa a un paciente del terapeuta, o su CentroAtención.
 * Body: { patient_id, empresa_id: string | null }  → empresa; el CentroAtención se pone solo
 *                                                    si el terapeuta tiene uno en esa empresa
 *       { patient_id, centro_id: string | null }   → CentroAtención (de su empresa y del terapeuta)
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
  const { patient_id, empresa_id, centro_id } = body as { patient_id?: string; empresa_id?: string | null; centro_id?: string | null }

  if (!patient_id) {
    return NextResponse.json({ error: 'patient_id requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificar que el paciente pertenece al terapeuta
  const { data: tp } = await admin
    .from('therapist_patients')
    .select('id, empresa_id')
    .eq('therapist_id', user.id)
    .eq('patient_id', patient_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!tp) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 })
  }

  // ── Solo el CentroAtención (7 nov 2026, src/lib/centros-atencion.ts) ──
  if (centro_id !== undefined && empresa_id === undefined) {
    if (centro_id) {
      const { data: rel } = await admin
        .from('therapist_centro_atencion')
        .select('centro_id, empresa_centros_atencion!inner(empresa_id, is_active)')
        .eq('therapist_id', user.id)
        .eq('centro_id', centro_id)
        .maybeSingle()
      const centro = rel?.empresa_centros_atencion as { empresa_id?: string; is_active?: boolean } | null
      if (!centro || !centro.is_active || centro.empresa_id !== tp.empresa_id) {
        return NextResponse.json({ error: 'No perteneces a ese CentroAtención de su empresa' }, { status: 403 })
      }
    }
    const { error } = await admin.from('therapist_patients').update({ centro_id: centro_id ?? null }).eq('id', tp.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, centro_id: centro_id ?? null })
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

  // Con otra empresa, su CentroAtención anterior ya no aplica: el único del terapeuta en ella, o ninguno
  const nuevoCentro = empresa_id && empresa_id === tp.empresa_id
    ? undefined
    : await centroPorDefecto(admin, user.id, empresa_id ?? null)
  const { error } = await admin
    .from('therapist_patients')
    .update({ empresa_id: empresa_id ?? null, ...(nuevoCentro !== undefined ? { centro_id: nuevoCentro } : {}) })
    .eq('therapist_id', user.id)
    .eq('patient_id', patient_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...(nuevoCentro !== undefined ? { centro_id: nuevoCentro } : {}) })
}
