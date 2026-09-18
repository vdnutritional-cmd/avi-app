import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/debug/expediente?patientId=XXX
 * Diagnóstico temporal — lee patient_expediente SIN filtro de RLS (admin client).
 * Solo accesible para usuarios autenticados. Se eliminará después del diagnóstico.
 */
export async function GET(req: NextRequest) {
  // 1. Verificar que el usuario está autenticado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const patientId = req.nextUrl.searchParams.get('patientId')
  if (!patientId) {
    return NextResponse.json({ error: 'patientId requerido' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 2. Buscar TODAS las filas para este patient_id (sin filtro therapist_id)
  const { data: rows, error } = await admin
    .from('patient_expediente')
    .select('therapist_id, patient_id, asesorado_nombre, asesorado_sexo, asesorado_edad, tipo_caso, updated_at')
    .eq('patient_id', patientId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 3. También buscar en therapist_patients para ver qué terapeutas tienen este paciente
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
