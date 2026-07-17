import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/confirm-patient
 * Ejecuta server-side (con service_role) los 3 pasos del registro de paciente:
 *   1. Auto-confirma el email (sin verificación manual — muchos pacientes no tienen correo real)
 *   2. Marca el código de autorización como usado
 *   3. Vincula al paciente con su terapeuta en therapist_patients
 *
 * Se hace aquí porque después del signUp() con "Confirm email" activado en Supabase,
 * NO se crea sesión, por lo que las llamadas client-side fallan por RLS.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, codeId, therapistId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'userId requerido' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 1. Auto-confirmar email
    const { error: confirmError } = await supabase.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (confirmError) {
      console.error('[confirm-patient] Error al confirmar email:', confirmError)
      return NextResponse.json({ error: confirmError.message }, { status: 500 })
    }

    // 2. Marcar código como usado
    if (codeId) {
      const { error: codeError } = await supabase
        .from('authorization_codes')
        .update({ used_by: userId, used_at: new Date().toISOString(), is_active: false })
        .eq('id', codeId)
      if (codeError) console.error('[confirm-patient] Error al actualizar código:', codeError)
    }

    // 3. Vincular paciente con terapeuta
    if (therapistId) {
      const { error: linkError } = await supabase
        .from('therapist_patients')
        .insert({ therapist_id: therapistId, patient_id: userId, authorization_code_id: codeId ?? null })
      if (linkError) console.error('[confirm-patient] Error al vincular terapeuta-paciente:', linkError)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[confirm-patient] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
