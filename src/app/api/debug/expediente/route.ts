import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/debug/expediente
 * Diagnóstico temporal — lee patient_expediente SIN filtro de RLS (admin client).
 *
 * Modos:
 *   ?patientId=XXX  → diagnóstico de un paciente específico
 *   ?all=1          → lista TODOS los pacientes del terapeuta autenticado con sus expedientes
 */
export async function GET(req: NextRequest) {
  // 1. Verificar que el usuario está autenticado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const allMode = req.nextUrl.searchParams.get('all') === '1'

  if (allMode) {
    // Listar todos los pacientes del terapeuta
    const { data: patients } = await admin
      .from('therapist_patients')
      .select('patient_id, status, created_at')
      .eq('therapist_id', user.id)
      .order('created_at', { ascending: false })

    const patientIds = (patients ?? []).map(p => p.patient_id)

    // Buscar perfiles de esos pacientes
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', patientIds)

    // Buscar expedientes existentes
    const { data: expedientes } = await admin
      .from('patient_expediente')
      .select('patient_id, asesorado_nombre, updated_at')
      .eq('therapist_id', user.id)

    const expMap = new Map((expedientes ?? []).map(e => [e.patient_id, e]))
    const profMap = new Map((profiles ?? []).map(p => [p.id, p]))

    const summary = (patients ?? []).map(p => ({
      patient_id: p.patient_id,
      full_name: profMap.get(p.patient_id)?.full_name ?? '(sin perfil)',
      email: profMap.get(p.patient_id)?.email ?? '',
      tp_created_at: p.created_at,
      tp_status: p.status,
      expediente: expMap.has(p.patient_id)
        ? { existe: true, asesorado_nombre: expMap.get(p.patient_id)?.asesorado_nombre, updated_at: expMap.get(p.patient_id)?.updated_at }
        : { existe: false }
    }))

    return NextResponse.json({
      currentUserId: user.id,
      totalPatients: summary.length,
      patients: summary
    })
  }

  // Modo paciente específico
  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) {
    return NextResponse.json({ error: 'patientId requerido (o usa ?all=1)' }, { status: 400 })
  }

  // Buscar TODAS las filas para este patient_id (sin filtro therapist_id)
  const { data: rows, error } = await admin
    .from('patient_expediente')
    .select('therapist_id, patient_id, asesorado_nombre, asesorado_sexo, asesorado_edad, tipo_caso, updated_at')
    .eq('patient_id', patientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // También buscar en therapist_patients
  const { data: tpRows } = await admin
    .from('therapist_patients')
    .select('therapist_id, status, created_at')
    .eq('patient_id', patientId)

  return NextResponse.json({
    currentUserId: user.id,
    patientId,
    expedienteRows: rows ?? [],
    therapistPatientLinks: tpRows ?? [],
    message: rows?.length === 0
      ? 'NO hay filas en patient_expediente para este paciente con NINGÚN terapeuta'
      : `Se encontraron ${rows?.length} fila(s)`
  })
}
