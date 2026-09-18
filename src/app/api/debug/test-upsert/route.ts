import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/debug/test-upsert
 * Prueba el upsert a patient_expediente con los mismos campos que
 * usa /registro-consultorio.  Usa el primer paciente real del terapeuta
 * para evitar FK violations. ELIMINAR después del diagnóstico.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createAdminClient()

  // ── 1. Obtener un patient_id real del terapeuta ───────────────────────────
  const { data: link } = await admin
    .from('therapist_patients')
    .select('patient_id')
    .eq('therapist_id', user.id)
    .limit(1)
    .single()

  if (!link?.patient_id) {
    return NextResponse.json({ error: 'No tienes pacientes vinculados para probar' }, { status: 400 })
  }

  const testPatientId = link.patient_id

  // ── 2. Intentar el upsert exactamente igual que registro-consultorio ──────
  const { error: upsertErr } = await admin
    .from('patient_expediente')
    .upsert({
      patient_id:               testPatientId,
      therapist_id:             user.id,
      asesorado_nombre:         'TEST-DIAGNÓSTICO',
      asesorado_sexo:           'M',
      asesorado_edad:           '30',
      asesorado_fecha_nacimiento: '',
      asesorado_lugar_nacimiento: '',
      asesorado_estado_civil:   '',
      asesorado_escolaridad:    '',
      asesorado_ocupacion:      '',
      asesorado_religion:       '',
      asesorado_parroquia:      '',
      contacto_telefono:        '',
      contacto_domicilio:       '',
      pareja_nombre:            '',
      pareja_sexo:              '',
      pareja_edad:              '',
      pareja_fecha_nacimiento:  '',
      hijos:                    [],
      salud_padece_enfermedad:  '',
      salud_ayuda_psicologica:  '',
      salud_ayuda_tiempo:       '',
      salud_medicamentos:       '',
      salud_medicamentos_cual:  '',
    }, { onConflict: 'therapist_id,patient_id' })

  // ── 3. Verificar qué columnas existen en la tabla ─────────────────────────
  // Leer una fila (o vacío) para ver qué devuelve Supabase
  const { data: sampleRow } = await admin
    .from('patient_expediente')
    .select('*')
    .eq('therapist_id', user.id)
    .eq('patient_id', testPatientId)
    .maybeSingle()

  return NextResponse.json({
    therapist_id: user.id,
    test_patient_id: testPatientId,
    upsert: upsertErr
      ? {
          ok: false,
          message:  upsertErr.message,
          code:     upsertErr.code,
          details:  upsertErr.details,
          hint:     upsertErr.hint,
        }
      : { ok: true },
    // Muestra qué columnas existen en la tabla (keys de la fila)
    table_columns_sample: sampleRow ? Object.keys(sampleRow) : 'sin fila aún',
  })
}
